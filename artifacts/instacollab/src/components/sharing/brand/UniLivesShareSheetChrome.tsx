import React from 'react';
import { APP_DISPLAY_NAME } from '../../../lib/appBrand';
import { UniLivesSharingMedia } from './UniLivesSharingMedia';

type Props = {
  className?: string;
  children: React.ReactNode;
  title?: string;
};

/**
 * Share sheet chrome for ShareModal.
 * Does not copy links, send DMs, or generate URLs.
 */
export function UniLivesShareSheetChrome({
  className = '',
  children,
  title,
}: Props) {
  return (
    <div className={className} data-unilives-share-sheet="">
      <div className="flex items-center justify-center gap-2 mb-3">
        <UniLivesSharingMedia
          kind="card-logo"
          legacyUrl="/brand/app-logo.png"
          imgClassName="h-6 w-6 rounded-md object-contain pointer-events-none"
          decorative
        />
        <span className="text-[11px] font-bold uppercase tracking-wide text-white/70">
          {APP_DISPLAY_NAME}
        </span>
      </div>
      {title ? <h3 className="text-lg font-bold mb-4 text-center">{title}</h3> : null}
      {children}
    </div>
  );
}
