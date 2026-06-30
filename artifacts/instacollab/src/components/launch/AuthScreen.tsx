import React, { useEffect, useState } from 'react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';
import { isCloudAuthConfigured } from '../../lib/auth/config';
import {
  cloudRequestPasswordReset,
  cloudSignIn,
  cloudSignInWithApple,
  cloudSignInWithGoogle,
  cloudSignUp,
  cloudUpdatePassword,
} from '../../lib/auth/cloudAuthApi';
import { AppleAuthButton } from './AppleAuthButton';
import { GoogleAuthButton } from './GoogleAuthButton';
import { isCloudUsernameAvailable } from '../../lib/auth/cloudProfile';
import { syncCloudSessionNow } from '../../lib/auth/syncSession';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import { clearSupabaseUnhealthy } from '../../lib/auth/providerState';
import { completeSupabaseOAuthReturnOnce } from '../../lib/auth/oauthReturnGuard';
import { isKnownLocalDemoEmail, tryLocalDemoLogin } from '../../lib/auth/localDemoAuth';
import { signInDemoWithCloudSync } from '../../lib/auth/demoCloudAuth';
import { isSupabaseOAuthReturnInUrl } from '../../lib/auth/supabaseOAuthReturn';
import { reconcileWalletAndKstarCoins } from '../../lib/walletKstarSync';
import {
  LaunchBrandMark,
  LaunchField,
  LaunchPrimaryButton,
  LaunchShell,
  LaunchTextButton,
  launchInputClass,
} from './launchUi';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

export function AuthScreen() {
  const db = useDB();
  const { showToast } = useToast();
  const { recoveryMode, clearRecoveryMode } = useSupabaseAuth();
  const useCloudAuth = isCloudAuthConfigured();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (recoveryMode) {
      setMode('reset');
      clearRecoveryMode();
    }
  }, [recoveryMode, clearRecoveryMode]);

  useEffect(() => {
    if (!useCloudAuth || !isSupabaseConfigured() || !isSupabaseOAuthReturnInUrl()) return;
    let cancelled = false;
    void (async () => {
      const result = await completeSupabaseOAuthReturnOnce();
      if (cancelled) return;
      if (!result.handled) return;
      if (!result.ok) {
        if (result.reason) showToast(result.reason);
        return;
      }
      const sync = await syncCloudSessionNow();
      if (cancelled) return;
      if (!sync.ok) {
        showToast(sync.reason);
        return;
      }
      showToast('Signed in!');
    })();
    return () => {
      cancelled = true;
    };
  }, [useCloudAuth, showToast]);

  const onLogin = async () => {
    setBusy(true);
    try {
      if (useCloudAuth) {
        if (isKnownLocalDemoEmail(email)) {
          const demoCloud = await signInDemoWithCloudSync(email, password);
          if (demoCloud.ok) {
            showToast('Welcome back! (demo — synced to cloud)');
            return;
          }
          if (!import.meta.env.DEV) {
            showToast(demoCloud.reason);
            return;
          }
        }

        const demoLogin = tryLocalDemoLogin(email, password);
        if (demoLogin?.ok) {
          showToast('Welcome back! (demo account — offline dev only)');
          return;
        }
        if (demoLogin && !demoLogin.ok) {
          showToast(demoLogin.reason);
          return;
        }

        clearSupabaseUnhealthy();
        const result = await cloudSignIn(email, password);
        if (!result.ok) {
          const hint = isKnownLocalDemoEmail(email)
            ? ' Demo password is demo123 for demo@instacollab.app and sarah@instacollab.app.'
            : import.meta.env.DEV
              ? ' No cloud account? Sign up, or use demo@instacollab.app / demo123 (dev).'
              : ' Try Sign up if you have not created a cloud account yet.';
          showToast(result.reason + hint);
          return;
        }
        const sync = await syncCloudSessionNow();
        if (!sync.ok) {
          showToast(sync.reason);
          return;
        }
        showToast('Welcome back!');
        return;
      }
      const result = db.signInWithCredentials(email, password);
      if (!result.ok) {
        showToast(result.reason);
        return;
      }
      reconcileWalletAndKstarCoins(result.userId);
      showToast('Welcome back!');
    } finally {
      setBusy(false);
    }
  };

  const onSignup = async () => {
    setBusy(true);
    try {
      if (useCloudAuth) {
        const normalizedUser = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (normalizedUser.length < 3) {
          showToast('Username must be at least 3 characters');
          return;
        }
        const available = await isCloudUsernameAvailable(normalizedUser);
        if (!available) {
          showToast('Username is taken');
          return;
        }
        clearSupabaseUnhealthy();
        const result = await cloudSignUp({
          email,
          password,
          username: normalizedUser,
          displayName,
        });
        if (!result.ok) {
          showToast(result.reason);
          return;
        }
        if (result.needsEmailConfirmation) {
          showToast('Check your email to confirm your account, then log in.');
          setMode('login');
          return;
        }
        const sync = await syncCloudSessionNow();
        if (!sync.ok) {
          showToast(sync.reason);
          return;
        }
        const newUserId = db.currentUserId;
        if (newUserId) {
          db.resetLaunchGatesForNewAccount(newUserId);
          db.advanceLaunchProgressAfterLogin(false);
        }
        showToast('Account created — finish your profile');
        return;
      }
      const result = db.signUpWithCredentials({ email, password, username, displayName });
      if (!result.ok) {
        showToast(result.reason);
        return;
      }
      db.resetLaunchGatesForNewAccount(result.userId);
      db.login(result.userId);
      reconcileWalletAndKstarCoins(result.userId);
      db.advanceLaunchProgressAfterLogin(false);
      showToast('Account created — finish your profile');
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async () => {
    setBusy(true);
    if (useCloudAuth) {
      const result = await cloudRequestPasswordReset(email);
      setBusy(false);
      if (!result.ok) {
        showToast(result.reason);
        return;
      }
      showToast('Password reset link sent — check your email');
      setMode('login');
      return;
    }
    const result = db.requestPasswordReset(email);
    setBusy(false);
    if (!result.ok) {
      showToast(result.reason);
      return;
    }
    showToast('Demo reset code: 123456');
    setMode('reset');
  };

  const onOAuth = async (provider: 'google' | 'apple') => {
    setBusy(true);
    try {
      const result =
        provider === 'google' ? await cloudSignInWithGoogle() : await cloudSignInWithApple();
      if (!result.ok) {
        console.warn('[auth] OAuth failed:', result.reason);
        showToast(result.reason);
        return;
      }
      if (result.redirecting) return;

      const sync = await syncCloudSessionNow();
      if (!sync.ok) {
        showToast(sync.reason);
        return;
      }
      showToast('Signed in!');
    } finally {
      setBusy(false);
    }
  };

  const onReset = async () => {
    setBusy(true);
    if (useCloudAuth) {
      if (newPassword.length < 6) {
        setBusy(false);
        showToast('Password must be at least 6 characters');
        return;
      }
      const result = await cloudUpdatePassword(newPassword);
      setBusy(false);
      if (!result.ok) {
        showToast(result.reason);
        return;
      }
      showToast('Password updated — you are signed in');
      setMode('login');
      return;
    }
    const result = db.resetPasswordWithCode(email, '123456', newPassword);
    setBusy(false);
    if (!result.ok) {
      showToast(result.reason);
      return;
    }
    showToast('Password updated — sign in');
    setMode('login');
  };

  const title =
    mode === 'login'
      ? 'Welcome back'
      : mode === 'signup'
        ? 'Create account'
        : mode === 'forgot'
          ? 'Forgot password'
          : 'New password';

  const subtitle =
    mode === 'login'
      ? useCloudAuth
        ? import.meta.env.DEV
          ? 'Cloud: email, Google, or Apple. Demo (syncs live): demo@instacollab.app / demo123.'
          : 'Sign in with email, Google, or Apple (syncs across devices).'
        : import.meta.env.DEV
          ? 'Demo mode — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a .env file, then restart npm run dev.'
          : 'Sign in with demo@instacollab.app / demo123'
      : mode === 'signup'
        ? 'Join InstaCollab and set up your profile.'
        : mode === 'forgot'
          ? useCloudAuth
            ? 'We will email you a secure reset link.'
            : 'Demo mode uses code 123456 on the next screen.'
          : useCloudAuth
            ? 'Choose a new password for your account.'
            : 'Enter demo code 123456 and a new password.';

  return (
    <LaunchShell className="p-4 sm:p-6 overflow-y-auto">
      <div className="flex flex-1 w-full min-h-0 flex-col items-center justify-center py-6 sm:py-10">
        <div className="w-full max-w-[420px] flex flex-col items-center gap-8">
          <header className="flex w-full flex-col items-center gap-5 text-center">
            <LaunchBrandMark size="xl" allowUpload showUploadHint={false} />
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[320px]">
                {subtitle}
              </p>
              {!useCloudAuth && import.meta.env.DEV ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 pt-1 max-w-[320px]">
                  Local demo only — copy .env.example → .env and restart dev server for Google / Apple
                </span>
              ) : null}
            </div>
          </header>

          <div className="w-full flex flex-col gap-5">
            {useCloudAuth && (mode === 'login' || mode === 'signup') && (
              <div className="flex flex-col gap-3 w-full">
                <AppleAuthButton
                  disabled={busy}
                  label={mode === 'signup' ? 'Sign up with Apple' : 'Continue with Apple'}
                  onClick={() => void onOAuth('apple')}
                />
                <GoogleAuthButton
                  disabled={busy}
                  label={mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
                  onClick={() => void onOAuth('google')}
                />
                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">
                    or email
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              </div>
            )}

            <form
              className="flex flex-col gap-4 w-full"
              onSubmit={(e) => {
                e.preventDefault();
                if (mode === 'login') void onLogin();
                else if (mode === 'signup') void onSignup();
                else if (mode === 'forgot') void onForgot();
                else void onReset();
              }}
            >
              {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
                <LaunchField label="Email">
                  <input
                    className={launchInputClass}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </LaunchField>
              )}

              {(mode === 'login' || mode === 'signup') && (
                <LaunchField label="Password">
                  <input
                    className={launchInputClass}
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </LaunchField>
              )}

              {mode === 'signup' && (
                <>
                  <LaunchField label="Display name">
                    <input
                      className={launchInputClass}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      required
                    />
                  </LaunchField>
                  <LaunchField label="Username">
                    <input
                      className={launchInputClass}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="creative_you"
                      required
                      minLength={3}
                    />
                  </LaunchField>
                </>
              )}

              {mode === 'reset' && (
                <LaunchField label="New password">
                  <input
                    className={launchInputClass}
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </LaunchField>
              )}

              <LaunchPrimaryButton type="submit" disabled={busy}>
              {mode === 'login'
                ? 'Log in'
                : mode === 'signup'
                  ? 'Sign up'
                  : mode === 'forgot'
                    ? 'Send reset link'
                    : 'Update password'}
            </LaunchPrimaryButton>
            </form>

            <footer className="flex flex-col items-center gap-2.5 text-sm text-center pt-1">
              {mode === 'login' && (
                <>
                  <LaunchTextButton onClick={() => setMode('forgot')}>
                    Forgot password?
                  </LaunchTextButton>
                  <span className="text-muted-foreground">
                    New here?{' '}
                    <LaunchTextButton onClick={() => setMode('signup')}>Sign up</LaunchTextButton>
                  </span>
                </>
              )}
              {mode === 'signup' && (
                <span className="text-muted-foreground">
                  Already have an account?{' '}
                  <LaunchTextButton onClick={() => setMode('login')}>Log in</LaunchTextButton>
                </span>
              )}
              {(mode === 'forgot' || mode === 'reset') && (
                <LaunchTextButton onClick={() => setMode('login')}>Back to log in</LaunchTextButton>
              )}
            </footer>
          </div>
        </div>
      </div>
    </LaunchShell>
  );
}
