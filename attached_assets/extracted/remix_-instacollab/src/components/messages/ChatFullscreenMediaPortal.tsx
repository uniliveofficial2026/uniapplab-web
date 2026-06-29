import { useEffect, useRef, type MutableRefObject } from 'react';
import {
  createBackdropCloseHandler,
  useFullscreenOpenGuard,
  useMediaOverlayAcquire,
} from '../../lib/mediaOverlayLock';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatMentionsAndTags, handleMediaError } from '../../lib/utils';
import { safeMediaUrl } from '../../lib/safe';
import { PLAYBACK_SCOPE } from '../../lib/playbackScope';
import { pauseAllChatMediaPlayers } from '../../lib/chatMediaPlayback';
import { useChatMediaVideo } from '../../lib/useChatMediaVideo';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { MusicDiscPlayer } from './MusicDiscPlayer';
import type { FullscreenMediaState } from './messages/types';

type ChatFullscreenMediaPortalProps = {
  fullscreenMedia: FullscreenMediaState;
  globalMuted: boolean;
  onGlobalMutedChange: (muted: boolean) => void;
  onClose: () => void;
  onMediaIndexChange: (index: number) => void;
  inlineVideoRefs: MutableRefObject<Map<string, HTMLVideoElement>>;
};

export function ChatFullscreenMediaPortal({
  fullscreenMedia,
  globalMuted,
  onGlobalMutedChange,
  onClose,
  onMediaIndexChange,
  inlineVideoRefs,
}: ChatFullscreenMediaPortalProps) {
  const currentItem = fullscreenMedia.items[fullscreenMedia.mediaIndex];
  const mediaUrl = safeMediaUrl(currentItem?.url) || currentItem?.url || '';
  const portalVideoRef = useRef<HTMLVideoElement | null>(null);
  const { onPlay: onPortalVideoPlay } = useChatMediaVideo(portalVideoRef);
  const { shouldIgnoreClose } = useFullscreenOpenGuard(true);
  useMediaOverlayAcquire(true);

  const onBackdropClose = createBackdropCloseHandler(onClose, shouldIgnoreClose);

  useEffect(() => {
    pauseAllChatMediaPlayers();
    inlineVideoRefs.current.forEach((el) => {
      try {
        el.pause();
      } catch {
        /* ignore */
      }
    });
  }, [fullscreenMedia.mediaIndex, inlineVideoRefs]);

  const goPrev = () => {
    if (fullscreenMedia.mediaIndex > 0) {
      onMediaIndexChange(fullscreenMedia.mediaIndex - 1);
    }
  };

  const goNext = () => {
    if (fullscreenMedia.mediaIndex < fullscreenMedia.items.length - 1) {
      onMediaIndexChange(fullscreenMedia.mediaIndex + 1);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/95 pointer-events-auto animate-in fade-in duration-200"
      onPointerUp={onBackdropClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-[410] text-white p-2 hover:bg-white/10 rounded-full transition-colors"
      >
        <X className="w-8 h-8 drop-shadow-md" />
      </button>

      {fullscreenMedia.items.length > 1 && fullscreenMedia.mediaIndex > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-4 z-[410] text-white p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ChevronLeft className="w-10 h-10 drop-shadow-md" />
        </button>
      )}

      <div className="w-full h-full flex flex-col items-center justify-center p-4 relative">
        <div className="relative max-w-full max-h-[85vh] flex items-center justify-center overflow-hidden rounded-xl border border-white/10 shadow-2xl bg-black min-w-[280px]">
          {currentItem.title || currentItem.caption ? (
            <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-20 flex items-center gap-3">
              {currentItem.avatarUrl && (
                <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20 shrink-0">
                  <img src={currentItem.avatarUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex flex-col leading-none min-w-0">
                <span className="text-white font-bold text-sm drop-shadow">
                  {currentItem.title || 'User'}
                </span>
                {currentItem.caption && (
                  <span className="post-caption-text text-zinc-200 text-xs mt-1 font-medium drop-shadow-sm truncate max-w-[240px] sm:max-w-md">
                    {formatMentionsAndTags(currentItem.caption)}
                  </span>
                )}
              </div>
            </div>
          ) : null}

          {currentItem.isAudio ? (
            <div className="w-full max-w-md px-6 py-10 pt-14">
              {currentItem.name ? (
                <MusicDiscPlayer
                  url={mediaUrl}
                  name={currentItem.name}
                  color="primary"
                />
              ) : (
                <VoiceMessagePlayer url={mediaUrl} color="primary" />
              )}
            </div>
          ) : currentItem.isVideo ? (
            <video
              data-playback-scope={PLAYBACK_SCOPE.INLINE}
              key={`vid-${fullscreenMedia.mediaIndex}-${mediaUrl.slice(0, 32)}`}
              ref={(el) => {
                portalVideoRef.current = el;
                const key = `portal-${fullscreenMedia.mediaIndex}`;
                if (el) inlineVideoRefs.current.set(key, el);
                else inlineVideoRefs.current.delete(key);
              }}
              src={mediaUrl}
              className="max-w-full max-h-[80vh] object-contain"
              onError={handleMediaError}
              controls
              autoPlay
              playsInline
              muted={globalMuted}
              preload="auto"
              onPlay={onPortalVideoPlay}
              onVolumeChange={(e) => onGlobalMutedChange(e.currentTarget.muted)}
            />
          ) : (
            <img
              key={`img-${fullscreenMedia.mediaIndex}-${mediaUrl.slice(0, 32)}`}
              src={mediaUrl}
              className="max-w-full max-h-[80vh] object-contain"
              alt={`Fullscreen media ${fullscreenMedia.mediaIndex + 1}`}
              onError={handleMediaError}
            />
          )}
        </div>

        {fullscreenMedia.items.length > 1 ? (
          <div className="absolute bottom-6 flex gap-2">
            {fullscreenMedia.items.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMediaIndexChange(idx);
                }}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  idx === fullscreenMedia.mediaIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`View item ${idx + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>

      {fullscreenMedia.items.length > 1 &&
        fullscreenMedia.mediaIndex < fullscreenMedia.items.length - 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-4 z-[410] text-white p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ChevronRight className="w-10 h-10 drop-shadow-md" />
          </button>
        )}
    </div>,
    document.body
  );
}
