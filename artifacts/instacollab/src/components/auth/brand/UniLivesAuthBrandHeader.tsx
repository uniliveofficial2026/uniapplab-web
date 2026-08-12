import React from 'react';
import { LaunchBrandMark } from '../../launch/LaunchBrandMark';
import { UniLivesWordmark } from '../../brand/UniLivesWordmark';

type Props = {
  title: string;
  subtitle?: string;
  footerNote?: React.ReactNode;
};

/**
 * Auth header brand + titles. Visual only — parent owns copy/state.
 * Preserves LaunchBrandMark size/placement (xl, centered).
 */
export function UniLivesAuthBrandHeader({ title, subtitle, footerNote }: Props) {
  return (
    <header className="flex w-full flex-col items-center gap-5 text-center">
      <LaunchBrandMark size="xl" mark="app" allowUpload={false} showUploadHint={false} />
      <div className="flex flex-col items-center gap-2">
        <UniLivesWordmark className="text-lg font-black tracking-tight text-[color:var(--color-unilives-auth-text)]" />
        <h1 className="text-2xl font-black tracking-tight text-[color:var(--color-unilives-auth-text)]">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm text-[color:var(--color-unilives-auth-muted)] leading-relaxed max-w-[320px]">
            {subtitle}
          </p>
        ) : null}
        {footerNote}
      </div>
    </header>
  );
}
