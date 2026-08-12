import React from 'react';
import { UniLivesWordmark } from '../../brand/UniLivesWordmark';

type Props = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
};

/** Discovery page header — visual only. */
export function UniLivesDiscoveryHeader({ title, subtitle, icon }: Props) {
  return (
    <header className="flex flex-col gap-1">
      <UniLivesWordmark className="text-xs font-black tracking-tight text-[color:var(--color-unilives-discovery-muted)]" />
      <div className="flex items-center gap-2 text-[color:var(--color-unilives-discovery-selected)]">
        {icon}
        <h1 className="text-2xl font-black text-[color:var(--color-unilives-discovery-text)]">{title}</h1>
      </div>
      {subtitle ? (
        <p className="text-sm text-[color:var(--color-unilives-discovery-muted)] mt-1">{subtitle}</p>
      ) : null}
    </header>
  );
}
