import { cloudSignOut } from '../../auth/cloudAuthApi';
import { isCloudAuthConfigured } from '../../auth/config';
import type { LaunchProgress, AuthAccountRecord } from '../../dbTypes';
import type { User } from '../../../types';
import type { AuthLaunchLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';

const LAUNCH_KEY = 'launch_progress';
const LAUNCH_USER_GATES_KEY = 'launch_user_gates';
const ACCOUNTS_KEY = 'auth_accounts';
const DEMO_RESET_CODE = '123456';

const DEFAULT_LAUNCH: LaunchProgress = {
  hasSeenSplash: false,
  hasCompletedOnboarding: false,
  profileSetupComplete: false,
  hasSeenTrending: false,
  pendingPasswordResetEmail: null,
};

const DEFAULT_USER_GATES = {
  profileSetupComplete: false,
  hasSeenTrending: false,
};

type UserLaunchGates = typeof DEFAULT_USER_GATES;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isLegacySeedUserId(userId: string): boolean {
  return /^u\d+$/.test(userId);
}

function slugUsername(raw: string): string {
  const base = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return base.length >= 3 ? base.slice(0, 24) : `user_${Date.now().toString(36).slice(-6)}`;
}

export function WithAuthLaunch<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, AuthLaunchLayer> {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }

    private loadDeviceLaunch(): Omit<LaunchProgress, keyof UserLaunchGates> {
      const stored = this.load<LaunchProgress>(LAUNCH_KEY, null as unknown as LaunchProgress);
      if (stored && typeof stored === 'object') {
        return {
          hasSeenSplash: stored.hasSeenSplash ?? false,
          hasCompletedOnboarding: stored.hasCompletedOnboarding ?? false,
          pendingPasswordResetEmail: stored.pendingPasswordResetEmail ?? null,
        };
      }
      return {
        hasSeenSplash: false,
        hasCompletedOnboarding: false,
        pendingPasswordResetEmail: null,
      };
    }

    private loadUserGatesMap(): Record<string, UserLaunchGates> {
      const map = this.load<Record<string, UserLaunchGates>>(LAUNCH_USER_GATES_KEY, {});
      return map && typeof map === 'object' ? map : {};
    }

    private saveUserGatesMap(map: Record<string, UserLaunchGates>) {
      this.save(LAUNCH_USER_GATES_KEY, map);
    }

    private getUserLaunchGates(userId: string): UserLaunchGates {
      if (isLegacySeedUserId(userId)) {
        return { profileSetupComplete: true, hasSeenTrending: true };
      }
      const map = this.loadUserGatesMap();
      const stored = map[userId];
      if (stored) return { ...DEFAULT_USER_GATES, ...stored };
      return { ...DEFAULT_USER_GATES };
    }

    private saveUserLaunchGates(userId: string, patch: Partial<UserLaunchGates>) {
      const map = this.loadUserGatesMap();
      map[userId] = { ...this.getUserLaunchGates(userId), ...patch };
      this.saveUserGatesMap(map);
    }

    getLaunchProgress(): LaunchProgress {
      const device = this.loadDeviceLaunch();
      const userId = this.asLocalDB().currentUserId;
      const gates =
        this.asLocalDB().isLoggedIn && userId
          ? this.getUserLaunchGates(userId)
          : { ...DEFAULT_USER_GATES };
      return { ...DEFAULT_LAUNCH, ...device, ...gates };
    }

    private saveLaunchProgress(patch: Partial<LaunchProgress>) {
      const { profileSetupComplete, hasSeenTrending, ...devicePatch } = patch;
      const userId = this.asLocalDB().currentUserId;

      if (
        userId &&
        this.asLocalDB().isLoggedIn &&
        (profileSetupComplete !== undefined || hasSeenTrending !== undefined)
      ) {
        this.saveUserLaunchGates(userId, {
          ...(profileSetupComplete !== undefined ? { profileSetupComplete } : {}),
          ...(hasSeenTrending !== undefined ? { hasSeenTrending } : {}),
        });
      }

      const device = { ...this.loadDeviceLaunch(), ...devicePatch };
      this.save(LAUNCH_KEY, device);
    }

    resetLaunchGatesForNewAccount(userId: string) {
      if (!userId) return;
      this.saveUserLaunchGates(userId, {
        profileSetupComplete: false,
        hasSeenTrending: false,
      });
    }

    markSplashSeen() {
      this.saveLaunchProgress({ hasSeenSplash: true });
    }

    completeOnboarding() {
      this.saveLaunchProgress({ hasCompletedOnboarding: true });
    }

    completeProfileSetup() {
      const userId = this.asLocalDB().currentUserId;
      if (userId) this.saveUserLaunchGates(userId, { profileSetupComplete: true });
    }

    markTrendingSeen() {
      const userId = this.asLocalDB().currentUserId;
      if (userId) this.saveUserLaunchGates(userId, { hasSeenTrending: true });
    }

    /**
     * After sign-in: splash/onboarding marked done.
     * Returning accounts (cloud profile_setup_complete or prior completion) skip profile + trending.
     * New accounts must complete both gates.
     */
    advanceLaunchProgressAfterLogin(profileSetupCompleteFromServer: boolean) {
      const userId = this.asLocalDB().currentUserId;
      const priorGates = userId ? this.getUserLaunchGates(userId) : { ...DEFAULT_USER_GATES };
      const returning =
        Boolean(profileSetupCompleteFromServer) ||
        priorGates.profileSetupComplete ||
        priorGates.hasSeenTrending;

      this.saveLaunchProgress({
        hasSeenSplash: true,
        hasCompletedOnboarding: true,
      });

      if (userId) {
        this.saveUserLaunchGates(userId, {
          profileSetupComplete: returning || priorGates.profileSetupComplete,
          hasSeenTrending: returning || priorGates.hasSeenTrending,
        });
      }
    }

    hasReachedMainApp(): boolean {
      const p = this.getLaunchProgress();
      return (
        p.hasSeenSplash &&
        p.hasCompletedOnboarding &&
        p.profileSetupComplete &&
        p.hasSeenTrending &&
        this.asLocalDB().isLoggedIn
      );
    }

    private getAuthAccounts(): AuthAccountRecord[] {
      const list = this.load<AuthAccountRecord[]>(ACCOUNTS_KEY, []);
      return Array.isArray(list) ? list : [];
    }

    private saveAuthAccounts(accounts: AuthAccountRecord[]) {
      this.save(ACCOUNTS_KEY, accounts);
    }

    ensureDemoAuthAccounts() {
      const accounts = this.getAuthAccounts();
      const demos: AuthAccountRecord[] = [
        { userId: 'u1', email: 'demo@instacollab.app', password: 'demo123' },
        { userId: 'u2', email: 'sarah@instacollab.app', password: 'demo123' },
      ];
      let changed = false;
      const next = [...accounts];
      demos.forEach((demo) => {
        if (!next.some((a) => a.email === demo.email)) {
          next.push(demo);
          changed = true;
        }
      });
      if (changed) this.saveAuthAccounts(next);
    }

    findAuthAccountByEmail(email: string): AuthAccountRecord | undefined {
      const normalized = normalizeEmail(email);
      return this.getAuthAccounts().find((a) => a.email === normalized);
    }

    signInWithCredentials(
      email: string,
      password: string
    ): { ok: true; userId: string } | { ok: false; reason: string } {
      this.ensureDemoAuthAccounts();
      const account = this.findAuthAccountByEmail(email);
      if (!account) return { ok: false, reason: 'No account found for that email.' };
      if (account.password !== password) return { ok: false, reason: 'Incorrect password.' };
      this.asLocalDB().login(account.userId);
      const returning =
        isLegacySeedUserId(account.userId) ||
        this.getUserLaunchGates(account.userId).profileSetupComplete;
      this.advanceLaunchProgressAfterLogin(returning);
      return { ok: true, userId: account.userId };
    }

    signUpWithCredentials(payload: {
      email: string;
      password: string;
      username: string;
      displayName: string;
    }): { ok: true; userId: string } | { ok: false; reason: string } {
      const email = normalizeEmail(payload.email);
      if (!email.includes('@')) return { ok: false, reason: 'Enter a valid email.' };
      if ((payload.password || '').length < 6) {
        return { ok: false, reason: 'Password must be at least 6 characters.' };
      }
      this.ensureDemoAuthAccounts();
      if (this.findAuthAccountByEmail(email)) {
        return { ok: false, reason: 'An account with this email already exists.' };
      }
      const username = slugUsername(payload.username);
      const users = this.asLocalDB().users;
      if (users.some((u) => u.username.toLowerCase() === username)) {
        return { ok: false, reason: 'Username is taken. Try another.' };
      }
      const userId = `u_${Date.now().toString(36)}`;
      const newUser: User = {
        id: userId,
        username,
        displayName: payload.displayName.trim() || username,
        avatarUrl:
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
        followers: 0,
        following: 0,
        bio: '',
        status: 'none',
      };
      this.asLocalDB().registerUser(newUser);
      this.saveAuthAccounts([
        ...this.getAuthAccounts(),
        { userId, email, password: payload.password },
      ]);
      this.resetLaunchGatesForNewAccount(userId);
      return { ok: true, userId };
    }

    requestPasswordReset(email: string): { ok: true } | { ok: false; reason: string } {
      this.ensureDemoAuthAccounts();
      const account = this.findAuthAccountByEmail(email);
      if (!account) return { ok: false, reason: 'No account found for that email.' };
      this.saveLaunchProgress({ pendingPasswordResetEmail: normalizeEmail(email) });
      return { ok: true };
    }

    resetPasswordWithCode(
      email: string,
      code: string,
      newPassword: string
    ): { ok: true } | { ok: false; reason: string } {
      const normalized = normalizeEmail(email);
      const progress = this.getLaunchProgress();
      if (progress.pendingPasswordResetEmail !== normalized) {
        return { ok: false, reason: 'Start password reset from the forgot password screen.' };
      }
      if (code.trim() !== DEMO_RESET_CODE) {
        return { ok: false, reason: `Invalid code. Demo code is ${DEMO_RESET_CODE}.` };
      }
      if (newPassword.length < 6) {
        return { ok: false, reason: 'Password must be at least 6 characters.' };
      }
      const accounts = this.getAuthAccounts().map((a) =>
        a.email === normalized ? { ...a, password: newPassword } : a
      );
      this.saveAuthAccounts(accounts);
      this.saveLaunchProgress({ pendingPasswordResetEmail: null });
      return { ok: true };
    }

    logoutSession() {
      if (isCloudAuthConfigured()) {
        void cloudSignOut();
      }
      this.asLocalDB().logout();
    }
  } as unknown as MixinCtor<T, AuthLaunchLayer>;
}
