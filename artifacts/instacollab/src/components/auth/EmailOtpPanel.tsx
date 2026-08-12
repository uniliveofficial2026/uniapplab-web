import React, { useEffect, useState } from 'react';

const OTP_RESEND_SECONDS = 60;

export type EmailOtpPanelProps = {
  mode: 'signin' | 'signup';
  initialEmail?: string;
  onModeChange?: (mode: 'signin' | 'signup') => void;
  busy?: boolean;
  showModeToggle?: boolean;
  showSignupFields?: boolean;
  inputClass: string;
  /** Match princess auth email sheet (gold / glass). */
  tone?: 'default' | 'princess';
  onSendOtp: (
    email: string,
    mode: 'signin' | 'signup',
    profile?: { displayName?: string; username?: string },
  ) => Promise<{ ok: boolean; reason?: string }>;
  onVerifyOtp: (email: string, code: string) => Promise<{ ok: boolean; reason?: string }>;
  onVerified?: () => void;
};

export function EmailOtpPanel({
  mode,
  initialEmail = '',
  onModeChange,
  busy = false,
  showModeToggle = true,
  showSignupFields = true,
  inputClass,
  tone = 'default',
  onSendOtp,
  onVerifyOtp,
  onVerified,
}: EmailOtpPanelProps) {
  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [otpCode, setOtpCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [localBusy, setLocalBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const princess = tone === 'princess';

  const isBusy = busy || localBusy;

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const sendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    if (mode === 'signup' && showSignupFields) {
      const normalizedUser = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (normalizedUser.length < 3) {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Username must be at least 3 characters.' }));
        return;
      }
    }
    setLocalBusy(true);
    try {
      const result = await onSendOtp(
        trimmed,
        mode,
        mode === 'signup' && showSignupFields
          ? {
              displayName: displayName.trim() || undefined,
              username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            }
          : undefined,
      );
      if (result.ok) {
        setPhase('code');
        setOtpCode('');
        setResendIn(OTP_RESEND_SECONDS);
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: '6-digit code sent — check Gmail inbox, spam, and Promotions.',
          }),
        );
      } else if (result.reason) {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: result.reason }));
      }
    } finally {
      setLocalBusy(false);
    }
  };

  const verifyCode = async () => {
    const trimmed = email.trim();
    const code = otpCode.replace(/\D/g, '');
    if (!trimmed || code.length < 6) return;
    setLocalBusy(true);
    try {
      const result = await onVerifyOtp(trimmed, code);
      if (result.ok) {
        onVerified?.();
        return;
      }
      if (result.reason) {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: result.reason }));
      }
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <div className={princess ? 'flex flex-col gap-3 w-full' : 'space-y-3'}>
      {showModeToggle && onModeChange ? (
        princess ? (
          <div className="upa-seg">
            <button
              type="button"
              className="upa-seg-btn"
              data-active={mode === 'signin' ? 'true' : 'false'}
              onClick={() => {
                onModeChange('signin');
                setPhase('email');
                setOtpCode('');
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className="upa-seg-btn"
              data-active={mode === 'signup' ? 'true' : 'false'}
              onClick={() => {
                onModeChange('signup');
                setPhase('email');
                setOtpCode('');
              }}
            >
              Create account
            </button>
          </div>
        ) : (
          <div className="flex gap-2 p-1 rounded-xl bg-[color:var(--color-unilives-auth-surface)] border border-[color:var(--color-unilives-auth-border)]">
            <button
              type="button"
              onClick={() => {
                onModeChange('signin');
                setPhase('email');
                setOtpCode('');
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-black transition-colors ${
                mode === 'signin'
                  ? 'bg-[color:var(--color-unilives-primary)] text-white'
                  : 'text-[color:var(--color-unilives-auth-muted)] hover:text-[color:var(--color-unilives-auth-text)]'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                onModeChange('signup');
                setPhase('email');
                setOtpCode('');
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-black transition-colors ${
                mode === 'signup'
                  ? 'bg-[color:var(--color-unilives-primary)] text-white'
                  : 'text-[color:var(--color-unilives-auth-muted)] hover:text-[color:var(--color-unilives-auth-text)]'
              }`}
            >
              Create account
            </button>
          </div>
        )
      ) : null}

      {phase === 'email' ? (
        <>
          {mode === 'signup' && showSignupFields ? (
            <>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                autoComplete="name"
                className={inputClass}
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                className={inputClass}
              />
            </>
          ) : null}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className={inputClass}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void sendCode();
            }}
          />
          <p
            className={
              princess
                ? 'text-[11px] text-white/60 font-semibold leading-relaxed px-1'
                : 'text-[11px] text-[color:var(--color-unilives-auth-muted)] font-semibold leading-relaxed px-1'
            }
          >
            We email a 6-digit code.
          </p>
          <button
            type="button"
            disabled={isBusy || !email.trim()}
            onClick={() => void sendCode()}
            className={
              princess
                ? 'upa-cta'
                : 'w-full py-3 rounded-xl bg-[color:var(--color-unilives-primary)] text-white font-black text-sm hover:opacity-95 disabled:opacity-60'
            }
          >
            {isBusy ? 'Sending code…' : 'Send 6-digit code'}
          </button>
        </>
      ) : (
        <>
          <p
            className={
              princess
                ? 'text-sm text-white/70 font-semibold px-1'
                : 'text-sm text-[color:var(--color-unilives-auth-muted)] font-semibold px-1'
            }
          >
            Code sent to{' '}
            <span className={princess ? 'text-[#f0d78c]' : 'text-[color:var(--color-unilives-auth-text)]'}>
              {email}
            </span>
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            className={`${inputClass} text-center text-lg tracking-[0.35em] font-black`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void verifyCode();
            }}
          />
          <button
            type="button"
            disabled={isBusy || otpCode.replace(/\D/g, '').length < 6}
            onClick={() => void verifyCode()}
            className={
              princess
                ? 'upa-cta'
                : 'w-full py-3 rounded-xl bg-[color:var(--color-unilives-primary)] text-white font-black text-sm hover:opacity-95 disabled:opacity-60'
            }
          >
            {isBusy ? 'Verifying…' : 'Verify & continue'}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                setPhase('email');
                setOtpCode('');
              }}
              className={
                princess
                  ? 'upa-link flex-1'
                  : 'flex-1 py-2.5 rounded-xl border border-[color:var(--color-unilives-auth-border)] text-xs font-bold text-[color:var(--color-unilives-auth-muted)] hover:bg-[color:var(--color-unilives-auth-surface)]'
              }
            >
              Change email
            </button>
            <button
              type="button"
              disabled={isBusy || resendIn > 0}
              onClick={() => void sendCode()}
              className={
                princess
                  ? 'upa-link flex-1 disabled:opacity-60'
                  : 'flex-1 py-2.5 rounded-xl border border-[color:var(--color-unilives-auth-border)] text-xs font-bold text-[color:var(--color-unilives-primary)] hover:bg-[color:var(--color-unilives-auth-surface)] disabled:opacity-60'
              }
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
