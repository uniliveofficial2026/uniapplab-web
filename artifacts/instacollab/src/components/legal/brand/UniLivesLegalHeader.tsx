import React from 'react';
import { APP_DISPLAY_NAME } from '../../../lib/appBrand';
import { UniLivesLegalMedia } from './UniLivesLegalMedia';

type Props = {
  className?: string;
  showWordmark?: boolean;
};

/** Decorative legal header — no navigation or document logic. */
export function UniLivesLegalHeader({ className = '', showWordmark = true }: Props) {
  return (
    <header
      className={`flex items-center gap-2 shrink-0 ${className}`.trim()}
      data-unilives-legal-header=""
      aria-label={APP_DISPLAY_NAME}
    >
      <UniLivesLegalMedia
        kind="document-header"
        legacyUrl="/brand/app-logo.png"
        imgClassName="h-8 w-8 rounded-lg object-contain pointer-events-none"
        decorative
      />
      {showWordmark ? (
        <span className="text-sm font-extrabold tracking-tight text-foreground">{APP_DISPLAY_NAME}</span>
      ) : null}
    </header>
  );
}
