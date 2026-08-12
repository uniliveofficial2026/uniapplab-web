import React from 'react';
import type { RefObject } from 'react';
import { SoloLiveSelfMediaHost } from './SoloLiveSelfMediaHost';
import { safeAvatarUrl } from '../../lib/safe';

type HostPlaceholder = {
  name: string;
  avatar: string;
};

export type SoloLiveVideoStageProps = {
  selfMediaMounted: boolean;
  selfCameraActive: boolean;
  mirrorSelf: boolean;
  showHostRemote: boolean;
  showStatusText: boolean;
  statusText: string;
  onRetryCamera?: () => void;
  hostPoster: HostPlaceholder | null;
  rawVideoRef?: RefObject<HTMLVideoElement | null>;
  deeparPreviewRef?: RefObject<HTMLDivElement | null>;
  showDeeparPreview?: boolean;
  beautyVideoRef?: RefObject<HTMLVideoElement | null>;
  showBeautyPreview?: boolean;
  beautyFilter?: string | null;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
};

/** Isolated video stage — poster/avatar first; LiveKit remote upgrades on top. */
export const SoloLiveVideoStage = React.memo(function SoloLiveVideoStage({
  selfMediaMounted,
  selfCameraActive,
  mirrorSelf,
  showHostRemote,
  showStatusText,
  statusText,
  onRetryCamera,
  hostPoster,
  rawVideoRef,
  deeparPreviewRef,
  showDeeparPreview = false,
  beautyVideoRef,
  showBeautyPreview = false,
  beautyFilter = null,
  remoteVideoRef,
}: SoloLiveVideoStageProps) {
  return (
    <div className="solo-live-stage absolute inset-0 z-0 overflow-hidden bg-black">
      {/* Poster always under remote video so viewers never see a blank stage */}
      {hostPoster && !selfCameraActive ? (
        <img
          src={safeAvatarUrl(hostPoster.avatar)}
          alt={hostPoster.name}
          className="solo-live-video solo-live-video--poster"
        />
      ) : null}
      {rawVideoRef && deeparPreviewRef ? (
        <SoloLiveSelfMediaHost
          mounted={selfMediaMounted}
          visible={selfCameraActive}
          rawVideoRef={rawVideoRef}
          deeparPreviewRef={deeparPreviewRef}
          showDeeparPreview={showDeeparPreview}
          mirrorSelf={mirrorSelf}
          beautyVideoRef={beautyVideoRef}
          showBeautyPreview={showBeautyPreview}
          beautyFilter={beautyFilter}
        />
      ) : null}
      {showHostRemote ? (
        <video ref={remoteVideoRef} muted playsInline autoPlay className="solo-live-video" />
      ) : null}
      {showStatusText ? (
        <div className="solo-live-stage-placeholder solo-live-stage-placeholder--overlay">
          <p className="solo-live-stage-placeholder-text">{statusText}</p>
          {onRetryCamera ? (
            <button
              type="button"
              onClick={onRetryCamera}
              className="mt-3 rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-[11px] font-black uppercase tracking-wide text-white"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="solo-live-stage-vignette" aria-hidden />
    </div>
  );
});
