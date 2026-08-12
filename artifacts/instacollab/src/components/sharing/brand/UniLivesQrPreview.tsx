import React from 'react';
import { UniLivesQrFrame } from './UniLivesQrFrame';

type Props = {
  children: React.ReactNode;
  className?: string;
  destinationLabel?: string;
};

/** Preview chrome for an already-encoded QR. Destination label is display-only. */
export function UniLivesQrPreview({
  children,
  className = '',
  destinationLabel,
}: Props) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`.trim()} data-unilives-qr-preview="">
      <UniLivesQrFrame label={destinationLabel}>{children}</UniLivesQrFrame>
      {destinationLabel ? (
        <p className="text-xs text-muted-foreground text-center break-all max-w-xs">{destinationLabel}</p>
      ) : null}
    </div>
  );
}
