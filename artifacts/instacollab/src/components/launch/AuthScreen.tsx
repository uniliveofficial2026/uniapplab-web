import React, { useEffect, useState } from 'react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';
import { isCloudAuthConfigured } from '../../lib/auth/config';
import {
  cloudRequestPasswordReset,
  cloudSignIn,
  cloudSignInWithGoogle,
  cloudSignUp,
  cloudUpdatePassword,
} from '../../lib/auth/cloudAuthApi';
import { authSendEmailOtp, authVerifyEmailOtp } from '../../lib/auth/authService';
import { EmailOtpPanel } from '../auth/EmailOtpPanel';
import { GoogleAuthButton } from './GoogleAuthButton';
import { isCloudUsernameAvailable } from '../../lib/auth/cloudProfile';
import { syncCloudSessionNow } from '../../lib/auth/syncSession';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import { clearSupabaseUnhealthy } from '../../lib/auth/providerState';
import { completeSupabaseOAuthReturnOnce, completeFirebaseOAuthRedirectOnce } from '../../lib/auth/oauthReturnGuard';
import { DEMO_EMAIL, DEMO_PASSWORD, isKnownLocalDemoEmail, loginDemoAccountLocal, tryLocalDemoLogin } from '../../lib/auth/localDemoAuth';
import { signInDemoWithCloudSync } from '../../lib/auth/demoCloudAuth';
import { isSupabaseOAuthReturnInUrl } from '../../lib/auth/supabaseOAuthReturn';
import { shouldCompleteFirebaseOAuthRedirect } from '../../lib/firebase/oauth';
import { scheduleLiveSessionSync } from '../../lib/liveSessionSync';
import { APP_DISPLAY_NAME } from '../../lib/appBrand';
import {
  LEGAL_AGE_REQUIREMENT_YEARS,
  openPrivacyPolicy,
  openTermsOfService,
} from '../../lib/legalDocs';
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
  const [emailAuthMode, setEmailAuthMode] = useState<'signin' | 'signup'>('signin');
  const [emailMethod, setEmailMethod] = useState<'password' | 'otp'>('password');

  useEffect(() => {
    if (mode === 'login') setEmailAuthMode('signin');
    if (mode === 'signup') setEmailAuthMode('signup');
  }, [mode]);

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

  useEffect(() => {
    if (!useCloudAuth || !shouldCompleteFirebaseOAuthRedirect()) return;
    let cancelled = false;
    void (async () => {
      const result = await completeFirebaseOAuthRedirectOnce();
      if (cancelled) return;
      if (!result) return;
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

  const onEmailOtpVerified = async () => {
    const sync = await syncCloudSessionNow();
    if (!sync.ok) {
      showToast(sync.reason);
      return;
    }
    if (emailAuthMode === 'signup') {
      const newUserId = db.currentUserId;
      if (newUserId) {
        db.resetLaunchGatesForNewAccount(newUserId);
        db.advanceLaunchProgressAfterLogin(false);
      }
      showToast('Account created — finish your profile');
      return;
    }
    showToast('Welcome back!');
  };

  const onLogin = async (loginEmail = email, loginPassword = password) => {
    setBusy(true);
    try {
      const normalizedEmail = loginEmail.trim().toLowerCase();

      if (useCloudAuth && isKnownLocalDemoEmail(normalizedEmail)) {
        if (loginPassword !== DEMO_PASSWORD) {
          showToast(`Demo password is ${DEMO_PASSWORD}.`);
          return;
        }

        // Dev: local demo first — cloud sync can race and log the user out if Supabase is slow/down.
        if (import.meta.env.DEV) {
          const demoLocal = loginDemoAccountLocal(normalizedEmail, loginPassword);
          if (demoLocal.ok) {
            showToast('Welcome back! (demo account)');
            void signInDemoWithCloudSync(normalizedEmail, loginPassword).then((cloud) => {
              if (cloud.ok) showToast('Demo synced to cloud');
            });
            return;
          }
          showToast(demoLocal.reason);
          return;
        }

        const demoCloud = await signInDemoWithCloudSync(normalizedEmail, loginPassword);
        if (demoCloud.ok) {
          showToast('Welcome back! (demo — synced to cloud)');
          return;
        }
        showToast(demoCloud.reason);
        return;
      }

      if (useCloudAuth) {
        const demoLogin = tryLocalDemoLogin(normalizedEmail, loginPassword);
        if (demoLogin?.ok) {
          showToast('Welcome back! (demo account — offline dev only)');
          return;
        }
        if (demoLogin && !demoLogin.ok) {
          showToast(demoLogin.reason);
          return;
        }

        clearSupabaseUnhealthy();
        const result = await cloudSignIn(loginEmail, loginPassword);
        if (!result.ok) {
          const hint = import.meta.env.DEV
            ? ` Try demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}.`
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
      const result = db.signInWithCredentials(loginEmail, loginPassword);
      if (!result.ok) {
        showToast(result.reason);
        return;
      }
      scheduleLiveSessionSync(result.userId);
      showToast('Welcome back!');
    } finally {
      setBusy(false);
    }
  };

  const onDemoLogin = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setEmailMethod('password');
    setEmailAuthMode('signin');
    void onLogin(DEMO_EMAIL, DEMO_PASSWORD);
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
          showToast(
            'Check your email for a confirmation link (not a code). Open spam/promotions if needed, then log in.',
          );
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
      scheduleLiveSessionSync(result.userId);
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

  const onOAuth = async () => {
    setBusy(true);
    try {
      const result = await cloudSignInWithGoogle();
      if (!result.ok) {
        console.warn('[auth] OAuth failed:', result.reason);
        showToast(result.reason);
        return;
      }
      if ('backupNotice' in result && result.backupNotice) {
        showToast(result.backupNotice);
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
          ? `Cloud: email or Google. Demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (or button below).`
          : ''
        : import.meta.env.DEV
          ? 'Demo mode — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a .env file, then restart npm run dev.'
          : `Sign in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`
      : mode === 'signup'
        ? `Join ${APP_DISPLAY_NAME} and set up your profile.`
        : mode === 'forgot'
          ? useCloudAuth
            ? 'We will email you a secure reset link.'
            : 'Demo mode uses code 123456 on the next screen.'
          : useCloudAuth
            ? 'Choose a new password for your account.'
            : 'Enter demo code 123456 and a new password.';

  return (
    <LaunchShell className="p-4 sm:p-6 overflow-y-auto">
      <div className="flex flex-1 w-full min-h-0 flex-col items-center justify-center py-6 sm:py-10 pb-[max(1.5rem,var(--app-safe-bottom))]">
        <div className="w-full max-w-[420px] flex flex-col items-center gap-8">
          <header className="flex w-full flex-col items-center gap-5 text-center">
            <LaunchBrandMark size="xl" allowUpload showUploadHint={false} />
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">{title}</h1>
              {subtitle ? (
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[320px]">
                  {subtitle}
                </p>
              ) : null}
              {!useCloudAuth && import.meta.env.DEV ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 pt-1 max-w-[320px]">
                  Local demo only — copy .env.example → .env and restart dev server for Google sign-in
                </span>
              ) : null}
            </div>
          </header>

          <div className="w-full flex flex-col gap-5">
            {useCloudAuth && (mode === 'login' || mode === 'signup') && (
              <div className="flex flex-col gap-3 w-full">
                <GoogleAuthButton
                  disabled={busy}
                  label={mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
                  onClick={() => void onOAuth()}
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

            {useCloudAuth && (mode === 'login' || mode === 'signup') ? (
              <div className="flex flex-col gap-3 w-full">
                <div className="flex gap-2 p-1 rounded-xl bg-secondary/30 border border-border">
                  <button
                    type="button"
                    onClick={() => setEmailAuthMode('signin')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black transition-colors ${
                      emailAuthMode === 'signin'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailAuthMode('signup')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black transition-colors ${
                      emailAuthMode === 'signup'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Create account
                  </button>
                </div>

                <div className="flex gap-2 p-1 rounded-xl bg-secondary/30 border border-border">
                  <button
                    type="button"
                    onClick={() => setEmailMethod('password')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black transition-colors ${
                      emailMethod === 'password'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailMethod('otp')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black transition-colors ${
                      emailMethod === 'otp'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Email code
                  </button>
                </div>

                {emailMethod === 'password' ? (
                  <form
                    className="flex flex-col gap-4 w-full"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (emailAuthMode === 'signin') void onLogin();
                      else void onSignup();
                    }}
                  >
                    {emailAuthMode === 'signup' && (
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
                    <LaunchField label="Password">
                      <input
                        className={launchInputClass}
                        type="password"
                        autoComplete={emailAuthMode === 'signin' ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                    </LaunchField>
                    <LaunchPrimaryButton type="submit" disabled={busy}>
                      {emailAuthMode === 'signin' ? 'Log in' : 'Sign up'}
                    </LaunchPrimaryButton>
                  </form>
                ) : (
                  <EmailOtpPanel
                    mode={emailAuthMode}
                    onModeChange={setEmailAuthMode}
                    busy={busy}
                    showModeToggle={false}
                    showSignupFields={emailAuthMode === 'signup'}
                    initialEmail={email}
                    inputClass={launchInputClass}
                    onSendOtp={async (targetEmail, otpMode, profile) => {
                      setEmail(targetEmail);
                      if (otpMode === 'signup' && profile?.username) {
                        const available = await isCloudUsernameAvailable(profile.username);
                        if (!available) return { ok: false, reason: 'Username is taken' };
                      }
                      clearSupabaseUnhealthy();
                      return authSendEmailOtp(targetEmail, {
                        shouldCreateUser: otpMode === 'signup',
                        displayName: profile?.displayName,
                        username: profile?.username,
                      });
                    }}
                    onVerifyOtp={async (targetEmail, code) => {
                      setBusy(true);
                      try {
                        return await authVerifyEmailOtp(targetEmail, code);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    onVerified={() => void onEmailOtpVerified()}
                  />
                )}
              </div>
            ) : (
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
            )}

            <footer className="flex flex-col items-center gap-2.5 text-sm text-center pt-1">
              {import.meta.env.DEV && mode === 'login' && (
                <LaunchTextButton disabled={busy} onClick={() => onDemoLogin()}>
                  Try demo ({DEMO_EMAIL} / {DEMO_PASSWORD})
                </LaunchTextButton>
              )}
              {mode === 'login' && (
                <LaunchTextButton onClick={() => setMode('forgot')}>
                  Forgot password?
                </LaunchTextButton>
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
              <div className="w-full pt-2 mt-1 border-t border-border/60 space-y-1.5">
                <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[320px] mx-auto">
                  {APP_DISPLAY_NAME} is for users {LEGAL_AGE_REQUIREMENT_YEARS}+ only. Read our policies
                  before you sign in or create an account.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={openPrivacyPolicy}
                    className="text-primary hover:underline underline-offset-2"
                  >
                    Privacy Policy
                  </button>
                  <span className="text-muted-foreground/50" aria-hidden>
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={openTermsOfService}
                    className="text-primary hover:underline underline-offset-2"
                  >
                    Terms of Service
                  </button>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </LaunchShell>
  );
}
