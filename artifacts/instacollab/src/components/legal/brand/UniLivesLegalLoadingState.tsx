import React from 'react';
import { Loader2 } from 'lucide-react';
import { UniLivesLegalMedia } from './UniLivesLegalMedia';

type Props = {
  className?: string;
  label?: string;
};

export function UniLivesLegalLoadingState({
  className = '',
  label = 'Loading legal document…',
}: Props) {
  return (
    <div
      className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`.trim()}
      data-unilives-legal-loading=""
      role="status"
      aria-live="polite"
    >
      <UniLivesLegalMedia
        kind="loading"
        legacyNode={<Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
        imgClassName="w-4 h-4"
        decorative
      />
      <span>{label}</span>
    </div>
  );
}
