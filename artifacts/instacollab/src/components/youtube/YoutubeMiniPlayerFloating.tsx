import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripHorizontal, Maximize2, Minimize2, X, Youtube } from 'lucide-react';
import { WatchTogetherYoutubePlayer } from '../../smule-rooms/components/WatchTogetherYoutubePlayer';
import {
  clampYoutubeMiniPlayerPosition,
  closeYoutubeMiniPlayer,
  openYoutubeMiniPlayerPicker,
  patchYoutubeMiniPlayerState,
} from '../../lib/youtubeMiniPlayer';
import { useYoutubeMiniPlayer } from '../../hooks/useYoutubeMiniPlayer';

const MINIMIZED_HEIGHT = 46;

export function YoutubeMiniPlayerFloating() {
  const state = useYoutubeMiniPlayer();
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!state.open || state.minimized) return;
    const clamped = clampYoutubeMiniPlayerPosition(
      state.x,
      state.y,
      state.width,
      state.height,
    );
    if (clamped.x !== state.x || clamped.y !== state.y) {
      patchYoutubeMiniPlayerState(clamped);
    }
  }, [state.open, state.minimized, state.width, state.height, state.x, state.y]);

  const onDragMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = clampYoutubeMiniPlayerPosition(
        drag.originX + (event.clientX - drag.startX),
        drag.originY + (event.clientY - drag.startY),
        state.width,
        state.minimized ? MINIMIZED_HEIGHT : state.height,
      );
      patchYoutubeMiniPlayerState(next);
    },
    [state.height, state.minimized, state.width],
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

  const panelHeight = state.minimized ? MINIMIZED_HEIGHT : state.height;

  const panel = (
    <div
      className={`youtube-mini-player fixed z-[380] overflow-hidden rounded-2xl border border-white/15 bg-[#0b0612]/95 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl ${
        dragging ? 'cursor-grabbing select-none' : ''
      }`}
      style={{
        left: state.x,
        top: state.y,
        width: state.width,
        height: panelHeight,
        touchAction: 'none',
      }}
    >
      <div
        className="flex h-[46px] cursor-grab items-center gap-2 border-b border-white/10 bg-black/35 px-2 active:cursor-grabbing"
        onPointerDown={startDrag}
      >
        <GripHorizontal size={14} className="shrink-0 text-gray-500" aria-hidden />
        <Youtube size={14} className="shrink-0 text-red-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold text-white">{state.title || 'YouTube'}</p>
          {state.channelTitle ? (
            <p className="truncate text-[10px] text-gray-400">{state.channelTitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => openYoutubeMiniPlayerPicker()}
          className="rounded-full p-1.5 text-gray-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Change video"
          title="Change video"
        >
          <Youtube size={14} />
        </button>
        <button
          type="button"
          onClick={() => patchYoutubeMiniPlayerState({ minimized: !state.minimized })}
          className="rounded-full p-1.5 text-gray-300 transition hover:bg-white/10 hover:text-white"
          aria-label={state.minimized ? 'Expand mini player' : 'Minimize mini player'}
          title={state.minimized ? 'Expand' : 'Minimize'}
        >
          {state.minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
        </button>
        <button
          type="button"
          onClick={() => closeYoutubeMiniPlayer()}
          className="rounded-full p-1.5 text-gray-300 transition hover:bg-red-500/20 hover:text-red-200"
          aria-label="Close mini player"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {!state.minimized ? (
        <div className="h-[calc(100%-46px)] bg-black">
          <WatchTogetherYoutubePlayer
            videoId={state.videoId}
            title={state.title}
            className="h-full w-full"
          />
        </div>
      ) : null}
    </div>
  );

  return createPortal(panel, document.body);
}
