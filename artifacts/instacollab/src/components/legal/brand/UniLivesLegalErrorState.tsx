import React from 'react';
import { AlertCircle } from 'lucide-react';
import { UniLivesLegalMedia } from './UniLivesLegalMedia';

type Props = {
  className?: string;
  message?: string;
};

export function UniLivesLegalErrorState({
  className = '',
  message = 'Unable to load this legal document.',
}: Props) {
  return (
    <div
      className={`flex items-start gap-2 text-sm text-destructive ${className}`.trim()}
      data-unilives-legal-error=""
      role="alert"
    >
      <UniLivesLegalMedia
        kind="error"
        legacyNode={<AlertCircle className="w-4 h-4 shrink-0" aria-hidden />}
        imgClassName="w-4 h-4 shrink-0"
        decorative
      />
      <span>{message}</span>
    </div>
  );
}
