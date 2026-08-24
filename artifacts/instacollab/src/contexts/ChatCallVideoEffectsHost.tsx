import React, { createContext, useContext, type MutableRefObject, type RefObject } from 'react';
import type { CameraFacingMode } from '../lib/camera/useCameraStream';
import type { CallPresentation } from '../lib/chat/chatCallKit';
import {
  useChatCallTrtcPipeline,
  type ChatCallTrtcPipelineState,
} from '../lib/chat/useChatCallTrtcPipeline';
import { ChatCallLocalCameraStage } from '../components/messages/ChatCallLocalCameraStage';
import { MultiGuestEffectsSheet } from '../smule-rooms/components/MultiGuestEffectsSheet';
import { LiveBeautySheet } from '../smule-rooms/components/LiveBeautySheet';

export type ChatCallVideoEffectsValue = ChatCallTrtcPipelineState;

const ChatCallVideoEffectsContext = createContext<ChatCallVideoEffectsValue | null>(null);

export function ChatCallVideoEffectsHost({
  active,
  presentation = 'fullscreen',
  showCameraBackdrop = true,
  mirrorLocalPreview = true,
  localVideoStream,
  localStreamRef,
  localVideoRef,
  onReplaceVideoTrack,
  children,
}: {
  active: boolean;
  presentation?: CallPresentation;
  /** Full-bleed local camera layer behind call chrome (disabled during outgoing — stage owns preview). */
  showCameraBackdrop?: boolean;
  cameraFacingMode?: CameraFacingMode;
  mirrorLocalPreview?: boolean;
  localVideoStream: MediaStream | null;
  localStreamRef: MutableRefObject<MediaStream | null>;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  onReplaceVideoTrack: (track: MediaStreamTrack | null) => void;
  children: React.ReactNode;
}) {
  const pipeline = useChatCallTrtcPipeline({
    active,
    mirrorLocalPreview,
    localVideoStream,
    localStreamRef,
    localVideoRef,
    onReplaceVideoTrack,
  });

  const showFullscreenCamera = active && presentation === 'fullscreen' && showCameraBackdrop;
  const cameraStream = localStreamRef.current ?? localVideoStream ?? null;

  const value: ChatCallVideoEffectsValue | null = active ? pipeline : null;

  return (
    <ChatCallVideoEffectsContext.Provider value={value}>
      {active ? (
        <>
          {showFullscreenCamera ? (
            <div className="fixed inset-0 z-[198]">
              <ChatCallLocalCameraStage
                rawStream={cameraStream}
                beautySinkVideoRef={pipeline.beautyOutputVideoRef}
                beautyDisplayStream={pipeline.beautyOutputStream}
                deeparPreviewHostRef={pipeline.deeparPreviewHostRef}
                showBeautyPreview={pipeline.showBeautyPreview}
                showDeeparPreview={pipeline.showDeeparPreview}
                showProcessedPreview={pipeline.showProcessedPreview}
                layout="fullscreen"
                mirrored={mirrorLocalPreview}
                trtcConfigured={pipeline.beautyConfigured}
                trtcLoading={pipeline.beautyLoading && !pipeline.beautyWarm}
              />
            </div>
          ) : (
            <video
              ref={pipeline.beautyOutputVideoRef}
              autoPlay
              playsInline
              muted
              aria-hidden
              className="fixed h-px w-px opacity-0 pointer-events-none"
              style={{ left: -9999, top: -9999 }}
            />
          )}
        </>
      ) : null}
      {children}
      {active ? (
        <>
          {pipeline.deeparLicensed && !pipeline.beautyConfigured ? (
            <MultiGuestEffectsSheet
              isOpen={pipeline.deeparPanelOpen}
              onClose={pipeline.closeDeeparPanel}
              activeEffectId={pipeline.deeparEffectId}
              onSelectEffect={(id) => {
                pipeline.handleSelectDeepAR(id);
                if (id === pipeline.deeparEffectId) pipeline.toggleDeeparPanel();
              }}
              loading={pipeline.deeparActive && pipeline.deeparLoading}
              cameraReady={Boolean(localVideoStream || localStreamRef.current)}
              anchorBottom={100}
            />
          ) : null}
          <LiveBeautySheet
            isOpen={pipeline.beautyPanelOpen}
            onClose={pipeline.closeBeautyPanel}
            activeBeautyId={pipeline.beautyId}
            onSelectBeauty={pipeline.handleSelectBeauty}
            effects={pipeline.beautyEffects}
            onEffectsChange={pipeline.handleBeautyEffectsChange}
            bodyShape={pipeline.bodyShape}
            onBodyShapeChange={pipeline.handleBodyShapeChange}
            catalogs={pipeline.beautyCatalogs}
            readyEffectIds={pipeline.readyEffectIds}
            anchorBottom={pipeline.beautyPanelOpen ? 8 : 96}
            variant="call"
            webarConfigured={pipeline.beautyConfiguredFlag}
            webarLoading={pipeline.beautyLoading && !pipeline.beautyWarm}
            webarError={pipeline.beautyError}
          />
        </>
      ) : null}
    </ChatCallVideoEffectsContext.Provider>
  );
}

export function useChatCallVideoEffects(): ChatCallVideoEffectsValue | null {
  return useContext(ChatCallVideoEffectsContext);
}

export function useOptionalChatCallVideoEffects(): ChatCallVideoEffectsValue | null {
  return useContext(ChatCallVideoEffectsContext);
}
