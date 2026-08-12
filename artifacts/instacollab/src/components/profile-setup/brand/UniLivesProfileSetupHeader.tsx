import React from 'react';
import { UniLivesWordmark } from '../../brand/UniLivesWordmark';

type Props = {
  title: string;
  subtitle?: string;
};

/**
 * Profile setup header — visual only. Parent owns copy and state.
 * Preserves centered title/subtitle hierarchy from ProfileSetupScreen.
 */
export function UniLivesProfileSetupHeader({ title, subtitle }: Props) {
  return (
    <header className="flex w-full flex-col items-center gap-2 text-center">
      <UniLivesWordmark className="text-sm font-black tracking-tight text-[color:var(--color-unilives-profile-setup-muted)]" />
      <h1 className="text-2xl font-black tracking-tight text-[color:var(--color-unilives-profile-setup-text)]">
        {title}
      </h1>
      {subtitle ? (
        <p className="text-sm text-[color:var(--color-unilives-profile-setup-muted)] leading-relaxed max-w-[320px]">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}
