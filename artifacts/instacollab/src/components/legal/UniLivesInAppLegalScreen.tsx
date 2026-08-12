import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  PRIVACY_POLICY_PATH,
  PRIVACY_POLICY_TITLE,
  TERMS_OF_SERVICE_PATH,
  TERMS_OF_SERVICE_TITLE,
} from '../../lib/legalDocs';
import { UniLivesLegalHeader } from './brand/UniLivesLegalHeader';
import { UniLivesLegalLoadingState } from './brand/UniLivesLegalLoadingState';
import { UniLivesLegalErrorState } from './brand/UniLivesLegalErrorState';

export type InAppLegalDoc = 'terms' | 'privacy';

type Props = {
  kind: InAppLegalDoc;
  onBack: () => void;
  /** Defaults to “Back”. */
  backLabel?: string;
};

/**
 * Full-screen in-app Terms / Privacy viewer.
 * Loads the same public HTML docs used on the web; Back returns to the previous screen.
 */
export function UniLivesInAppLegalScreen({
  kind,
  onBack,
  backLabel = 'Back',
}: Props) {
  const title = kind === 'privacy' ? PRIVACY_POLICY_TITLE : TERMS_OF_SERVICE_TITLE;
  const src = kind === 'privacy' ? PRIVACY_POLICY_PATH : TERMS_OF_SERVICE_PATH;
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  return (
    <div
      className="fixed inset-0 z-[1200] flex flex-col bg-[#0b0612] text-[#f5f0fa]"
      data-unilives-in-app-legal={kind}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header
        className="shrink-0 flex items-center gap-2 px-2 pb-2 border-b border-white/10"
        style={{ paddingTop: 'max(0.65rem, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-0.5 shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-white/95 hover:bg-white/10 unilives-focus-ring"
          aria-label={backLabel}
        >
          <ChevronLeft className="w-5 h-5" aria-hidden />
          <span>{backLabel}</span>
        </button>
        <div className="min-w-0 flex-1">
          <UniLivesLegalHeader className="justify-end sm:justify-start" />
        </div>
      </header>

      <div className="px-4 pt-3 pb-1 shrink-0">
        <h1 className="text-base font-extrabold tracking-tight truncate">{title}</h1>
      </div>

      <div className="relative flex-1 min-h-0">
        {loadState === 'loading' ? (
          <div className="absolute inset-x-0 top-4 flex justify-center pointer-events-none z-10">
            <UniLivesLegalLoadingState />
          </div>
        ) : null}
        {loadState === 'error' ? (
          <div className="absolute inset-0 flex items-start justify-center p-6 z-10 bg-[#0b0612]">
            <UniLivesLegalErrorState message={`Unable to load ${title}.`} />
          </div>
        ) : null}
        <iframe
          title={title}
          src={src}
          className="absolute inset-0 w-full h-full border-0 bg-transparent"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom)',
            opacity: loadState === 'ready' ? 1 : 0,
          }}
          onLoad={() => setLoadState('ready')}
          onError={() => setLoadState('error')}
        />
      </div>
    </div>
  );
}
