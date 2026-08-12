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
  writeLegalAcceptanceToStorage,
} from '../../lib/legalDocs';
import {
  UniLivesInAppLegalScreen,
  UniLivesLegalNavigation,
  type InAppLegalDoc,
} from '../legal/brand';
import {
  UniLivesAuthStatus,
  UniLivesPrincessAuthActions,
  UniLivesPrincessAuthLayout,
  UniLivesPrincessAuthPanel,
  UniLivesPrincessForgotForm,
  UniLivesPrincessForgotLayout,
  authModeFromLaunchMode,
} from '../auth/brand';
import { markAuthGateThisSession } from '../../lib/splashSession';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';
type AuthGate = 'welcome' | 'email';

export function AuthScreen() {
  const db = useDB();
  const { showToast } = useToast();
  const { recoveryMode, clearRecoveryMode } = useSupabaseAuth();
  const useCloudAuth = isCloudAuthConfigured();
  const [mode, setMode] = useState<AuthMode>('login');
  const [gate, setGate] = useState<AuthGate>('welcome');
  const [legalDoc, setLegalDoc] = useState<InAppLegalDoc | null>(null);

  const passAuthGate = () => markAuthGateThisSession();

  // Already signed in this device: still show auth briefly, then continue the funnel.
  useEffect(() => {
    if (!db.isLoggedIn) return;
    const t = window.setTimeout(() => passAuthGate(), 1200);
    return () => window.clearTimeout(t);
  }, [db.isLoggedIn]);

  const [agreed, setAgreed] = useState(() => {
    try {
      return sessionStorage.getItem('unilives_auth_agreed') === '1';
    } catch {
      return false;
    }
  });

  const setAgreedPersist = (next: boolean | ((v: boolean) => boolean)) => {
    setAgreed((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      try {
        sessionStorage.setItem('unilives_auth_agreed', value ? '1' : '0');
      } catch {
        /* ignore */
      }
      return value;
    });
  };
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
      setGate('email');
      clearRecoveryMode();
    }
  }, [recoveryMode, clearRecoveryMode]);

  const openEmailGate = (next: AuthMode, authMode: 'signin' | 'signup' = 'signin') => {
    // Sign in / sign up require Terms checkbox; forgot password does not.
    if ((next === 'login' || next === 'signup') && !agreed) {
      showToast('Please agree to the Terms and Privacy Policy first.');
      setGate('welcome');
      setMode('login');
      return;
    }
    setMode(next);
    setEmailAuthMode(authMode);
    setGate('email');
  };

  const requireLegalAgree = (actionLabel = 'continue'): boolean => {
    if (agreed) return true;
    showToast(`Please agree to the Terms and Privacy Policy first to ${actionLabel}.`);
    setGate('welcome');
    setMode('login');
    return false;
  };

  const backToWelcome = () => {
    setMode('login');
    setEmailAuthMode('signin');
    setEmailMethod('password');
    setGate('welcome');
  };

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
      passAuthGate();
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
      passAuthGate();
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
      passAuthGate();
      return;
    }
    showToast('Welcome back!');
    passAuthGate();
  };

  const onLogin = async (loginEmail = email, loginPassword = password) => {
    if (!requireLegalAgree('sign in')) return;
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
            passAuthGate();
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
          passAuthGate();
          return;
        }
        showToast(demoCloud.reason);
        return;
      }

      if (useCloudAuth) {
        const demoLogin = tryLocalDemoLogin(normalizedEmail, loginPassword);
        if (demoLogin?.ok) {
          showToast('Welcome back! (demo account — offline dev only)');
          passAuthGate();
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
        passAuthGate();
        return;
      }
      const result = db.signInWithCredentials(loginEmail, loginPassword);
      if (!result.ok) {
        showToast(result.reason);
        return;
      }
      scheduleLiveSessionSync(result.userId);
      showToast('Welcome back!');
      passAuthGate();
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
    if (!requireLegalAgree('sign up')) return;
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
        passAuthGate();
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
      passAuthGate();
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
      setGate('welcome');
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
    if (!requireLegalAgree('continue with Google')) return;
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
      passAuthGate();
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

  const authInputClass = 'upa-input';
  const visualMode = authModeFromLaunchMode(
    mode,
    useCloudAuth && (mode === 'login' || mode === 'signup') ? emailMethod : 'password',
  );

  const showWelcome = gate === 'welcome' && mode === 'login';
  const showForgot = mode === 'forgot';
  const isEmailSignup = mode === 'signup';

  const backFromForgot = () => {
    setMode('login');
    setEmailAuthMode('signin');
    setGate('welcome');
  };

  const PrincessField = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <label className="upa-field">
      <span className="upa-field-label">{label}</span>
      {children}
    </label>
  );

  const formBody = (
    <>
      {/* Email signup sheet: match princess auth look — Google stays on welcome art */}
      {useCloudAuth && (mode === 'login' || mode === 'signup') ? (
        <div className="flex flex-col gap-3 w-full">
          {!isEmailSignup ? (
            <div className="upa-seg">
              <button
                type="button"
                className="upa-seg-btn"
                data-active={emailAuthMode === 'signin' ? 'true' : 'false'}
                onClick={() => {
                  setEmailAuthMode('signin');
                  setMode('login');
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                className="upa-seg-btn"
                data-active={emailAuthMode === 'signup' ? 'true' : 'false'}
                onClick={() => {
                  setEmailAuthMode('signup');
                  setMode('signup');
                }}
              >
                Create account
              </button>
            </div>
          ) : null}

          <div className="upa-seg" role="tablist" aria-label="Sign up method">
            <button
              type="button"
              className="upa-seg-btn"
              data-active={emailMethod === 'password' ? 'true' : 'false'}
              onClick={() => setEmailMethod('password')}
            >
              Password
            </button>
            <button
              type="button"
              className="upa-seg-btn"
              data-active={emailMethod === 'otp' ? 'true' : 'false'}
              onClick={() => setEmailMethod('otp')}
            >
              Email code
            </button>
          </div>

          {emailMethod === 'password' ? (
            <form
              className="flex flex-col gap-3 w-full"
              onSubmit={(e) => {
                e.preventDefault();
                if (!agreed) {
                  showToast('Please agree to the Terms and Privacy Policy first.');
                  return;
                }
                if (emailAuthMode === 'signin') void onLogin();
                else void onSignup();
              }}
            >
              {emailAuthMode === 'signup' && (
                <div className="upa-row">
                  <PrincessField label="Display name">
                    <input
                      className={authInputClass}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Display name"
                      required
                    />
                  </PrincessField>
                  <PrincessField label="Username">
                    <input
                      className={authInputClass}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      required
                      minLength={3}
                    />
                  </PrincessField>
                </div>
              )}
              <PrincessField label="Email">
                <input
                  className={authInputClass}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                />
              </PrincessField>
              <PrincessField label="Password">
                <input
                  className={authInputClass}
                  type="password"
                  autoComplete={emailAuthMode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  minLength={6}
                />
              </PrincessField>
              <button type="submit" className="upa-cta" disabled={busy || !agreed}>
                {emailAuthMode === 'signin' ? 'Log in' : 'Sign up'}
              </button>
            </form>
          ) : (
            <EmailOtpPanel
              mode={emailAuthMode}
              tone="princess"
              onModeChange={(m) => {
                setEmailAuthMode(m);
                setMode(m === 'signup' ? 'signup' : 'login');
              }}
              busy={busy}
              showModeToggle={false}
              showSignupFields={emailAuthMode === 'signup'}
              initialEmail={email}
              inputClass={authInputClass}
              onSendOtp={async (targetEmail, otpMode, profile) => {
                if (!agreed) return { ok: false, reason: 'Please agree to the Terms and Privacy Policy first.' };
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
          className="flex flex-col gap-3 w-full"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === 'login') {
              if (!agreed) {
                showToast('Please agree to the Terms and Privacy Policy first.');
                return;
              }
              void onLogin();
            } else if (mode === 'signup') {
              if (!agreed) {
                showToast('Please agree to the Terms and Privacy Policy first.');
                return;
              }
              void onSignup();
            } else if (mode === 'forgot') void onForgot();
            else void onReset();
          }}
        >
          {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
            <PrincessField label="Email">
              <input
                className={authInputClass}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </PrincessField>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <PrincessField label="Password">
              <input
                className={authInputClass}
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </PrincessField>
          )}

          {mode === 'signup' && (
            <>
              <PrincessField label="Display name">
                <input
                  className={authInputClass}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </PrincessField>
              <PrincessField label="Username">
                <input
                  className={authInputClass}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="creative_you"
                  required
                  minLength={3}
                />
              </PrincessField>
            </>
          )}

          {mode === 'reset' && (
            <PrincessField label="New password">
              <input
                className={authInputClass}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </PrincessField>
          )}

          <button type="submit" className="upa-cta" disabled={busy || ((mode === 'login' || mode === 'signup') && !agreed)}>
            {mode === 'login'
              ? 'Log in'
              : mode === 'signup'
                ? 'Sign up'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : 'Update password'}
          </button>
        </form>
      )}

      <footer className="upa-foot">
        {import.meta.env.DEV && mode === 'login' && (
          <button type="button" className="upa-link" disabled={busy} onClick={() => onDemoLogin()}>
            Try demo ({DEMO_EMAIL} / {DEMO_PASSWORD})
          </button>
        )}
        {mode === 'login' && (
          <button type="button" className="upa-link" onClick={() => openEmailGate('forgot')}>
            Forgot password?
          </button>
        )}
        {mode === 'signup' && (
          <span>
            Already have an account?{' '}
            <button
              type="button"
              className="upa-link"
              onClick={() => {
                setMode('login');
                setEmailAuthMode('signin');
              }}
            >
              Log in
            </button>
          </span>
        )}
        {(mode === 'forgot' || mode === 'reset') && (
          <button
            type="button"
            className="upa-link"
            onClick={() => {
              setMode('login');
              setEmailAuthMode('signin');
            }}
          >
            Back to log in
          </button>
        )}
        {!useCloudAuth && import.meta.env.DEV ? (
          <UniLivesAuthStatus tone="warning">
            Local demo only — copy .env.example → .env and restart dev server for Google sign-in
          </UniLivesAuthStatus>
        ) : null}
        <div className="upa-legal">
          {!isEmailSignup ? (
            <p>
              {APP_DISPLAY_NAME} is for users {LEGAL_AGE_REQUIREMENT_YEARS}+ only. We do not sell or share
              your personal data for advertising. Read our policies before you sign in or create an account.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold">
            <UniLivesLegalNavigation
              className="justify-center"
              items={[
                { label: 'Privacy Policy', onClick: () => setLegalDoc('privacy'), kind: 'privacy' },
                { label: 'Terms of Service', onClick: () => setLegalDoc('terms'), kind: 'terms' },
              ]}
            />
          </div>
        </div>
      </footer>
    </>
  );

  return (
    <>
      {showForgot ? (
        <UniLivesPrincessForgotLayout data-unilives-auth-mode={visualMode}>
          <UniLivesPrincessForgotForm
            email={email}
            busy={busy}
            onEmailChange={setEmail}
            onSubmit={() => void onForgot()}
            onBackToSignIn={backFromForgot}
          />
        </UniLivesPrincessForgotLayout>
      ) : (
        <UniLivesPrincessAuthLayout
          data-unilives-auth-mode={visualMode}
          showPanel={!showWelcome}
          panel={
            !showWelcome ? (
              <UniLivesPrincessAuthPanel
                title={title}
                subtitle={isEmailSignup ? undefined : subtitle || undefined}
                mode={mode}
                onBackToWelcome={backToWelcome}
                backLabel="Back to welcome"
              >
                {formBody}
              </UniLivesPrincessAuthPanel>
            ) : null
          }
        >
          {showWelcome ? (
            <UniLivesPrincessAuthActions
              agreed={agreed}
              busy={busy}
              onToggleAgree={() => setAgreedPersist((v) => !v)}
              onNeedAgree={() => showToast('Please agree to the Terms and Privacy Policy first.')}
              onGoogle={() => {
                if (!useCloudAuth) {
                  showToast('Google sign-in is not configured on this build.');
                  return;
                }
                void (async () => {
                  await onOAuth();
                  const uid = db.currentUserId;
                  if (uid) writeLegalAcceptanceToStorage(uid);
                })();
              }}
              onEmailSignup={() => openEmailGate('signup', 'signup')}
              onForgotPassword={() => openEmailGate('forgot')}
              onOpenTerms={() => setLegalDoc('terms')}
              onOpenPrivacy={() => setLegalDoc('privacy')}
            />
          ) : null}
        </UniLivesPrincessAuthLayout>
      )}
      {legalDoc ? (
        <UniLivesInAppLegalScreen
          kind={legalDoc}
          onBack={() => setLegalDoc(null)}
          backLabel="Back to welcome"
        />
      ) : null}
    </>
  );
}
