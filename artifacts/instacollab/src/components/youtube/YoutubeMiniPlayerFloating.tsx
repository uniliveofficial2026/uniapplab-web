import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripHorizontal, X, Youtube } from 'lucide-react';
import { WatchTogetherYoutubePlayer } from '../../smule-rooms/components/WatchTogetherYoutubePlayer';
import {
  clampYoutubeMiniPlayerPosition,
  closeYoutubeMiniPlayer,
  openYoutubeMiniPlayerPicker,
  patchYoutubeMiniPlayerState,
} from '../../lib/youtubeMiniPlayer';
import { useYoutubeMiniPlayer } from '../../hooks/useYoutubeMiniPlayer';

/** Expanded chrome header — taller so controls stay tappable. */
const HEADER_HEIGHT = 52;
/** Spinning disc size when minimized (playback continues off-screen). */
const DISC_SIZE = 76;

function youtubeThumbUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function YoutubeMiniPlayerFloating() {
  const state = useYoutubeMiniPlayer();
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const dragMovedRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const panelWidth = state.minimized ? DISC_SIZE : state.width;
  const panelHeight = state.minimized ? DISC_SIZE : state.height;

  useEffect(() => {
    if (!state.open) return;
    const clamped = clampYoutubeMiniPlayerPosition(state.x, state.y, panelWidth, panelHeight);
    if (clamped.x !== state.x || clamped.y !== state.y) {
      patchYoutubeMiniPlayerState(clamped);
    }
  }, [state.open, state.minimized, panelWidth, panelHeight, state.x, state.y]);

  const onDragMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMovedRef.current = true;
      const next = clampYoutubeMiniPlayerPosition(
        drag.originX + dx,
        drag.originY + dy,
        panelWidth,
        panelHeight,
      );
      patchYoutubeMiniPlayerState(next);
    },
    [panelHeight, panelWidth],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
  }, [onDragMove]);

  const startDrag = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragMovedRef.current = false;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: state.x,
      originY: state.y,
    };
    setDragging(true);
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };

  useEffect(() => () => endDrag(), [endDrag]);

  if (!state.open || !state.videoId) return null;

  const panel = (
    <div
      className={`youtube-mini-player fixed z-[380] overflow-hidden border border-white/15 bg-[#0b0612]/95 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl ${
        state.minimized ? 'rounded-full' : 'rounded-2xl'
      } ${dragging ? 'cursor-grabbing select-none' : ''}`}
      style={{
        left: state.x,
        top: state.y,
        width: panelWidth,
        height: panelHeight,
        touchAction: 'none',
      }}
    >
      {state.minimized ? (
        <button
          type="button"
          onPointerDown={startDrag}
          onPointerUp={() => {
            const wasDrag = dragMovedRef.current;
            window.setTimeout(() => {
              if (!wasDrag) patchYoutubeMiniPlayerState({ minimized: false });
            }, 0);
          }}
          className="group relative flex h-full w-full cursor-grab items-center justify-center active:cursor-grabbing"
          aria-label="Expand mini player"
          title={`${state.title || 'YouTube'} — tap to expand`}
        >
          <span
            className="youtube-mini-disc absolute inset-[5px] overflow-hidden rounded-full border-2 border-white/25 shadow-[inset_0_0_0_11px_rgba(0,0,0,0.5)]"
            style={{
              backgroundImage: `url(${youtubeThumbUrl(state.videoId)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 via-transparent to-black/50" />
          <span className="relative z-[1] h-3.5 w-3.5 rounded-full border border-white/35 bg-[#0b0612] shadow-inner" />
        </button>
      ) : (
        <div
          className="relative z-[2] flex cursor-grab items-center gap-2 border-b border-white/10 bg-black/35 px-2.5 active:cursor-grabbing"
          style={{ height: HEADER_HEIGHT }}
          onPointerDown={startDrag}
        >
          <GripHorizontal size={16} className="shrink-0 text-gray-500" aria-hidden />
          <Youtube size={16} className="shrink-0 text-red-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-bold leading-tight text-white">
              {state.title || 'YouTube'}
            </p>
            {state.channelTitle ? (
              <p className="truncate text-[11px] text-gray-400">{state.channelTitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => openYoutubeMiniPlayerPicker()}
            className="rounded-full p-2 text-gray-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Change video"
            title="Change video"
          >
            <Youtube size={16} />
          </button>
          <button
            type="button"
            onClick={() => patchYoutubeMiniPlayerState({ minimized: true })}
            className="rounded-full p-2 text-gray-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Minimize mini player"
            title="Minimize"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => closeYoutubeMiniPlayer()}
            className="rounded-full p-2 text-gray-300 transition hover:bg-red-500/20 hover:text-red-200"
            aria-label="Close mini player"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Keep iframe mounted so audio continues while the disc is showing */}
      <div
        className={
          state.minimized
            ? 'pointer-events-none fixed left-[-9999px] top-0 h-[200px] w-[360px] opacity-0'
            : 'absolute inset-x-0 bottom-0 z-[1]'
        }
        style={
          state.minimized
            ? undefined
            : { top: HEADER_HEIGHT, height: `calc(100% - ${HEADER_HEIGHT}px)` }
        }
        aria-hidden={state.minimized}
      >
        <WatchTogetherYoutubePlayer
          videoId={state.videoId}
          title={state.title}
          className="h-full w-full"
        />
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
