import React, { useEffect, useRef, useState } from 'react';
import { Move, X, Check, ZoomIn, Video } from 'lucide-react';
import type {
  KaraokeProfileBackground,
  KaraokeProfileBackgroundFocus,
} from '../../lib/karaokeProfileBackground';
import {
  layoutKaraokeProfileBackgroundMedia,
  normalizeKaraokeProfileBackgroundFocus,
  panKaraokeProfileBackgroundByPixels,
} from '../../lib/karaokeProfileBackground';

type KaraokeProfileBackgroundEditorProps = {
  draft: KaraokeProfileBackground;
  onSave: (background: KaraokeProfileBackground) => void;
  onCancel: () => void;
};

function usePreloadMediaSize(url: string, mediaKind: KaraokeProfileBackground['mediaKind']) {
  const [mediaSize, setMediaSize] = useState({ w: 0, h: 0 });
  const [mediaReady, setMediaReady] = useState(false);

  useEffect(() => {
    setMediaSize({ w: 0, h: 0 });
    setMediaReady(false);
    let cancelled = false;

    if (mediaKind === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = () => {
        if (cancelled) return;
        setMediaSize({ w: video.videoWidth, h: video.videoHeight });
        setMediaReady(true);
      };
      video.onerror = () => {
        if (!cancelled) setMediaReady(true);
      };
      video.src = url;
      return () => {
        cancelled = true;
        video.onloadedmetadata = null;
        video.onerror = null;
        video.removeAttribute('src');
        video.load();
      };
    }

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setMediaSize({ w: img.naturalWidth, h: img.naturalHeight });
      setMediaReady(true);
    };
    img.onerror = () => {
      if (!cancelled) setMediaReady(true);
    };
    img.src = url;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
      img.src = '';
    };
  }, [url, mediaKind]);

  return { mediaSize, mediaReady };
}

export function KaraokeProfileBackgroundEditor({
  draft,
  onSave,
  onCancel,
}: KaraokeProfileBackgroundEditorProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const { mediaSize, mediaReady } = usePreloadMediaSize(draft.url, draft.mediaKind);
  const [focus, setFocus] = useState<KaraokeProfileBackgroundFocus>(
    () => normalizeKaraokeProfileBackgroundFocus(draft.focus),
  );

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => {
      const rect = frame.getBoundingClientRect();
      setFrameSize({ w: rect.width, h: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || draft.mediaKind !== 'video') return;
    video.muted = true;
    const play = () => {
      void video.play().catch(() => {
        /* autoplay policy */
      });
    };
    play();
    video.addEventListener('loadeddata', play);
    return () => video.removeEventListener('loadeddata', play);
  }, [draft.mediaKind, draft.url, mediaReady]);

  const layout = layoutKaraokeProfileBackgroundMedia(
    frameSize.w,
    frameSize.h,
    mediaSize.w,
    mediaSize.h,
    focus,
  );
  const useFocusLayout = Boolean(layout && mediaSize.w && mediaSize.h && frameSize.w && frameSize.h);

  const onPointerDown = (event: React.PointerEvent) => {
    if (!mediaSize.w || !mediaSize.h) return;
    dragRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const start = dragRef.current;
    if (!start || !mediaSize.w || !mediaSize.h) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (deltaX === 0 && deltaY === 0) return;
    dragRef.current = { x: event.clientX, y: event.clientY };
    setFocus((current) =>
      panKaraokeProfileBackgroundByPixels(
        current,
        frameSize.w,
        frameSize.h,
        mediaSize.w,
        mediaSize.h,
        deltaX,
        deltaY,
      ),
    );
  };

  const onPointerUp = (event: React.PointerEvent) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleSave = () => {
    onSave({
      ...draft,
      focus: normalizeKaraokeProfileBackgroundFocus(focus),
      updatedAt: Date.now(),
    });
  };

  const mediaClassName = useFocusLayout
    ? 'absolute left-1/2 top-1/2 max-w-none pointer-events-none'
    : 'absolute inset-0 h-full w-full object-cover pointer-events-none';

  const mediaStyle = useFocusLayout
    ? {
        width: layout!.width,
        height: layout!.height,
        transform: layout!.transform,
      }
    : undefined;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      data-app-overlay-root
    >
      <div className="w-full max-w-3xl rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Position background</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live preview · drag to move · zoom to frame
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-full hover:bg-secondary transition"
            aria-label="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div
            ref={frameRef}
            className="relative w-full aspect-[2.4/1] overflow-hidden rounded-2xl border border-border bg-black touch-none select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {!mediaReady ? (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
            ) : null}
            {draft.mediaKind === 'video' ? (
              <video
                ref={videoRef}
                src={draft.url}
                className={mediaClassName}
                style={mediaStyle}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                aria-label="Background video preview"
              />
            ) : (
              <img
                src={draft.url}
                alt=""
                className={mediaClassName}
                style={mediaStyle}
                draggable={false}
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10 rounded-2xl" />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl" />
            <div className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm">
              {draft.mediaKind === 'video' ? (
                <Video className="w-3.5 h-3.5" />
              ) : (
                <Move className="w-3.5 h-3.5" />
              )}
              {draft.mediaKind === 'video'
                ? useFocusLayout
                  ? 'Video · drag to reposition'
                  : 'Loading video preview…'
                : useFocusLayout
                  ? 'Drag to reposition'
                  : 'Loading preview…'}
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm font-semibold">
            <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground shrink-0">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={focus.scale}
              onChange={(event) =>
                setFocus((current) => ({
                  ...current,
                  scale: Number(event.target.value),
                }))
              }
              className="flex-1 accent-primary"
              disabled={!useFocusLayout}
            />
            <span className="text-xs text-muted-foreground w-10 text-right">
              {focus.scale.toFixed(1)}×
            </span>
          </label>
        </div>

        <div className="flex gap-3 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-border font-bold text-sm hover:bg-secondary transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!mediaReady}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:shadow-lg transition inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Check className="w-4 h-4" />
            Set background
          </button>
        </div>
      </div>
    </div>
  );
}
