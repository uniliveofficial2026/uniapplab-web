import React from 'react';
import { APP_DISPLAY_NAME } from '../../../lib/appBrand';
import { UniLivesSharingMedia } from './UniLivesSharingMedia';

type Props = {
  className?: string;
  children: React.ReactNode;
  kind?: string;
  title?: string;
};

/**
 * Share-card chrome only. Title/URL/media come from parent props — no generation.
 */
export function UniLivesShareCard({
  className = '',
  children,
  kind,
  title,
}: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-card ${className}`.trim()}
      data-unilives-share-card=""
      data-share-kind={kind || undefined}
    >
      <div className="pointer-events-none absolute top-2 right-2 opacity-40" aria-hidden>
        <UniLivesSharingMedia
          kind="card-watermark"
          legacyUrl="/brand/app-logo.png"
          imgClassName="h-5 w-5 object-contain"
          decorative
        />
      </div>
      {title ? <h3 className="sr-only">{title}</h3> : null}
      {children}
      <p className="sr-only">{APP_DISPLAY_NAME}</p>
    </div>
  );
}
