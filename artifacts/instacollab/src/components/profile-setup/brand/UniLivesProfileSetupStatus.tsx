import React from 'react';

type Props = {
  tone?: 'info' | 'error' | 'success' | 'warning';
  children: React.ReactNode;
  className?: string;
  role?: React.AriaRole;
};

/** Status / helper styling only — messages come from parent. */
export function UniLivesProfileSetupStatus({
  tone = 'info',
  children,
  className = 'w-full rounded-xl border px-4 py-3 text-left text-sm',
  role,
}: Props) {
  const toneClass =
    tone === 'error'
      ? 'border-[color:var(--color-unilives-profile-setup-error)]/50 bg-[color:var(--color-unilives-profile-setup-error)]/10 text-[color:var(--color-unilives-profile-setup-text)]'
      : tone === 'success'
        ? 'border-[color:var(--color-unilives-profile-setup-success)]/40 bg-[color:var(--color-unilives-profile-setup-success)]/10 text-[color:var(--color-unilives-profile-setup-text)]'
        : tone === 'warning'
          ? 'border-amber-500/50 bg-amber-500/10 text-[color:var(--color-unilives-profile-setup-text)]'
          : 'border-[color:var(--color-unilives-profile-setup-border)] bg-[color:var(--color-unilives-profile-setup-surface)] text-[color:var(--color-unilives-profile-setup-text)]';

  return (
    <div className={`${className} ${toneClass}`} role={role} data-unilives-profile-setup-status={tone}>
      {children}
    </div>
  );
}
