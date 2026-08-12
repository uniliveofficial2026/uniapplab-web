import React from 'react';
import { motion } from 'motion/react';
import { AppNativeVideo } from '../common/AppNativeVideo';

export function LaunchShell({
  children,
  className = '',
  backgroundUrl,
  backgroundMediaType = 'image',
  decorationTone = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  /** Full-screen cover background (e.g. onboarding upload) */
  backgroundUrl?: string | null;
  backgroundMediaType?: 'image' | 'video';
  /** Visual-only decoration palette. Default preserves existing vibe orbs. */
  decorationTone?: 'default' | 'onboarding';
}) {
  const hasBackground = Boolean(backgroundUrl);

  return (
    <div
      className={`h-dvh max-h-dvh min-h-0 max-w-[100vw] w-full overflow-x-hidden text-[color:var(--color-unilives-text)] flex flex-col ${hasBackground ? 'bg-black' : 'bg-[color:var(--color-unilives-background)]'} ${className}`}
    >
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {hasBackground ? (
          <>
            {backgroundMediaType === 'video' ? (
              <AppNativeVideo
                src={backgroundUrl!}
                className="h-full w-full object-cover pointer-events-auto"
                autoPlay
                muted
                loop
                aria-hidden
              />
            ) : (
              <img src={backgroundUrl!} alt="" className="h-full w-full object-cover" aria-hidden />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/70 to-background/90" />
          </>
        ) : decorationTone === 'onboarding' ? (
          <>
            <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[color:var(--color-unilives-onboarding-decoration)]/25 blur-3xl" />
            <div className="absolute top-1/3 -left-20 h-64 w-64 rounded-full bg-[color:var(--color-unilives-primary)]/20 blur-3xl" />
            <div className="absolute bottom-0 right-1/4 h-56 w-56 rounded-full bg-[color:var(--color-unilives-accent)]/20 blur-3xl" />
          </>
        ) : (
          <>
            <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-vibe-pink/20 blur-3xl" />
            <div className="absolute top-1/3 -left-20 h-64 w-64 rounded-full bg-vibe-blue/20 blur-3xl" />
            <div className="absolute bottom-0 right-1/4 h-56 w-56 rounded-full bg-vibe-violet/25 blur-3xl" />
          </>
        )}
      </div>
      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain">{children}</div>
    </div>
  );
}

export { LaunchBrandMark } from './LaunchBrandMark';
export type { LaunchBrandMarkSize, LaunchBrandMarkKind } from './LaunchBrandMark';

export function LaunchPrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
  tone = 'default',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  /** Visual tone only — default keeps existing gradient. */
  tone?: 'default' | 'onboarding';
}) {
  const surface =
    tone === 'onboarding'
      ? 'bg-[color:var(--color-unilives-primary)] shadow-[var(--shadow-unilives-md)] shadow-[color:var(--color-unilives-primary)]/25'
      : 'bg-gradient-to-r from-[#fd5949] via-[#d6249f] to-[#285AEB] shadow-[var(--shadow-unilives-md)] shadow-vibe-pink/25';
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      className={`w-full py-3.5 rounded-[var(--radius-unilives-xl)] font-bold text-white disabled:opacity-50 unilives-focus-ring unilives-transition-fast ${surface}`}
    >
      {children}
    </motion.button>
  );
}

export function LaunchTextButton({
  children,
  onClick,
  disabled,
  tone = 'default',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'default' | 'onboarding';
}) {
  const color =
    tone === 'onboarding'
      ? 'text-[color:var(--color-unilives-primary)]'
      : 'text-[color:var(--color-unilives-primary)]';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`text-sm font-semibold hover:underline disabled:opacity-50 disabled:no-underline unilives-focus-ring ${color}`}
    >
      {children}
    </button>
  );
}

export function LaunchField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[length:var(--text-unilives-label)] font-bold uppercase tracking-wide text-[color:var(--color-unilives-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

export const launchInputClass =
  'w-full rounded-[var(--radius-unilives-lg)] border border-[color:var(--color-unilives-input-border)] bg-[color:var(--color-unilives-input-background)] px-4 py-3 text-[length:var(--text-unilives-body)] font-medium text-[color:var(--color-unilives-text)] outline-none focus:ring-2 focus:ring-[color:var(--color-unilives-focus)]/40';
