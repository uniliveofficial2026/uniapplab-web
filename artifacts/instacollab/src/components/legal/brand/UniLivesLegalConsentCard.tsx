import React from 'react';
import { UniLivesLegalHeader } from './UniLivesLegalHeader';

type Props = {
  className?: string;
  children: React.ReactNode;
  showHeader?: boolean;
};

/**
 * Visual consent card chrome only.
 * Checkbox checked state, handlers, and copy remain in the parent / children.
 */
export function UniLivesLegalConsentCard({
  className = '',
  children,
  showHeader = false,
}: Props) {
  return (
    <div
      className={`rounded-[var(--radius-unilives-xl)] border border-[color:var(--color-unilives-border)] bg-[color:var(--color-unilives-control-hover)]/20 p-4 space-y-3 text-left ${className}`.trim()}
      data-unilives-legal-consent-card=""
    >
      {showHeader ? <UniLivesLegalHeader className="mb-1" /> : null}
      {children}
    </div>
  );
}
