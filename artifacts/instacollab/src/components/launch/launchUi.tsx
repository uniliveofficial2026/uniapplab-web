import React from 'react';
import { motion } from 'motion/react';

export function LaunchShell({
  children,
  className = '',
  backgroundUrl,
  backgroundMediaType = 'image',
}: {
  children: React.ReactNode;
  className?: string;
  /** Full-screen cover background (e.g. onboarding upload) */
  backgroundUrl?: string | null;
  backgroundMediaType?: 'image' | 'video';
}) {
  const hasBackground = Boolean(backgroundUrl);

  return (
    <div
      className={`min-h-dvh max-w-[100vw] w-full overflow-x-hidden text-foreground flex flex-col ${hasBackground ? 'bg-black' : 'bg-background'} ${className}`}
    >
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {hasBackground ? (
          <>
            {backgroundMediaType === 'video' ? (
              <video
                src={backgroundUrl!}
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                aria-hidden
              />
            ) : (
              <img src={backgroundUrl!} alt="" className="h-full w-full object-cover" aria-hidden />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/70 to-background/90" />
          </>
        ) : (
          <>
            <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-vibe-pink/20 blur-3xl" />
            <div className="absolute top-1/3 -left-20 h-64 w-64 rounded-full bg-vibe-blue/20 blur-3xl" />
            <div className="absolute bottom-0 right-1/4 h-56 w-56 rounded-full bg-vibe-violet/25 blur-3xl" />
          </>
        )}
      </div>
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  );
}

export { LaunchBrandMark } from './LaunchBrandMark';
export type { LaunchBrandMarkSize } from './LaunchBrandMark';

export function LaunchPrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-[#fd5949] via-[#d6249f] to-[#285AEB] shadow-lg shadow-vibe-pink/25 disabled:opacity-50"
    >
      {children}
    </motion.button>
  );
}

export function LaunchTextButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-semibold text-primary hover:underline"
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
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export const launchInputClass =
  'w-full rounded-xl border border-border bg-card/80 px-4 py-3 text-[15px] font-medium outline-none focus:ring-2 focus:ring-primary/40';
