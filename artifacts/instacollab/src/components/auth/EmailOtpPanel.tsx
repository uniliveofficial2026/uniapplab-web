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
    <div className="space-y-3">
      {showModeToggle && onModeChange ? (
        <div className="flex gap-2 p-1 rounded-xl bg-secondary/30 border border-border">
          <button
            type="button"
            onClick={() => {
              onModeChange('signin');
              setPhase('email');
              setOtpCode('');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-black transition-colors ${
              mode === 'signin'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
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
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Create account
          </button>
        </div>
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
          <p className="text-[11px] text-muted-foreground font-semibold leading-relaxed px-1">
            We email a 6-digit code (not a password). If nothing arrives, configure Supabase SMTP
            (run <span className="text-foreground">pnpm run email-otp:setup</span>).
          </p>
          <button
            type="button"
            disabled={isBusy || !email.trim()}
            onClick={() => void sendCode()}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:opacity-95 disabled:opacity-60"
          >
            {isBusy ? 'Sending code…' : 'Send 6-digit code'}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground font-semibold px-1">
            Code sent to <span className="text-foreground">{email}</span>
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
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:opacity-95 disabled:opacity-60"
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
              className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-secondary/50"
            >
              Change email
            </button>
            <button
              type="button"
              disabled={isBusy || resendIn > 0}
              onClick={() => void sendCode()}
              className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold text-primary hover:bg-secondary/50 disabled:opacity-60"
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
