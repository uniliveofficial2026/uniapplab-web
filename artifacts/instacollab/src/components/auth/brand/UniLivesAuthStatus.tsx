import React from 'react';

type Props = {
  tone?: 'info' | 'error' | 'success' | 'warning';
  children: React.ReactNode;
  className?: string;
};

/** Status / helper text styling only — messages come from parent. */
export function UniLivesAuthStatus({
  tone = 'info',
  children,
  className = 'text-[10px] font-bold uppercase tracking-wider pt-1 max-w-[320px]',
}: Props) {
  const color =
    tone === 'error'
      ? 'text-[color:var(--color-unilives-auth-error)]'
      : tone === 'success'
        ? 'text-[color:var(--color-unilives-auth-success)]'
        : tone === 'warning'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-[color:var(--color-unilives-auth-muted)]';
  return <span className={`${className} ${color}`}>{children}</span>;
}
