import React, { useEffect, useRef, useState } from 'react';
import type {
  KaraokeProfileBackgroundFocus,
  KaraokeProfileBackgroundMediaKind,
} from '../../lib/karaokeProfileBackground';
import { layoutKaraokeProfileBackgroundMedia } from '../../lib/karaokeProfileBackground';
import { useKaraokeProfileBackgroundUrl } from './useKaraokeProfileBackgroundUrl';

type KaraokeProfileBackgroundProps = {
  url?: string | null;
  mediaId?: string | null;
  mimeType?: string;
  mediaKind?: KaraokeProfileBackgroundMediaKind;
  focus?: KaraokeProfileBackgroundFocus | null;
  className?: string;
  overlayClassName?: string;
  children?: React.ReactNode;
};

function KaraokeProfileBackgroundMedia({
  url,
  mediaId,
  mimeType,
  mediaKind,
  focus,
}: {
  url: string;
  mediaId?: string | null;
  mimeType?: string;
  mediaKind: KaraokeProfileBackgroundMediaKind;
  focus?: KaraokeProfileBackgroundFocus | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const [mediaSize, setMediaSize] = useState({ w: 0, h: 0 });
  const { playableUrl, loading } = useKaraokeProfileBackgroundUrl({
    url,
    mediaId,
    mediaKind,
    mimeType,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const rect = container.getBoundingClientRect();
      setFrameSize({ w: rect.width, h: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setMediaSize({ w: 0, h: 0 });
  }, [playableUrl, mediaKind]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || mediaKind !== 'video' || !playableUrl) return;
    video.muted = true;
    const play = () => {
      void video.play().catch(() => {
        /* autoplay policy */
      });
    };
    play();
    video.addEventListener('loadeddata', play);
    return () => video.removeEventListener('loadeddata', play);
  }, [playableUrl, mediaKind]);

  const layout = layoutKaraokeProfileBackgroundMedia(
    frameSize.w,
    frameSize.h,
    mediaSize.w,
    mediaSize.h,
    focus,
  );

  const useFocusLayout = Boolean(layout && mediaSize.w && mediaSize.h && playableUrl);

  if (!playableUrl) {
    return (
      <div
        ref={containerRef}
        className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-br from-zinc-800 via-zinc-900 to-black"
      >
        {loading ? (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-700/40 via-transparent to-zinc-900/60" />
        ) : null}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {mediaKind === 'video' ? (
        <video
          ref={videoRef}
          src={playableUrl}
          className={
            useFocusLayout
              ? 'absolute left-1/2 top-1/2 max-w-none'
              : 'absolute inset-0 h-full w-full object-cover'
          }
          style={
            useFocusLayout
              ? {
                  width: layout!.width,
                  height: layout!.height,
                  transform: layout!.transform,
                }
              : undefined
          }
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setMediaSize({ w: video.videoWidth, h: video.videoHeight });
          }}
        />
      ) : (
        <img
          src={playableUrl}
          alt=""
          className={
            useFocusLayout
              ? 'absolute left-1/2 top-1/2 max-w-none'
              : 'absolute inset-0 h-full w-full object-cover'
          }
          style={
            useFocusLayout
              ? {
                  width: layout!.width,
                  height: layout!.height,
                  transform: layout!.transform,
                }
              : undefined
          }
          aria-hidden
          onLoad={(event) => {
            const img = event.currentTarget;
            setMediaSize({ w: img.naturalWidth, h: img.naturalHeight });
          }}
        />
      )}
    </div>
  );
}

export function KaraokeProfileBackground({
  url,
  mediaId = null,
  mimeType,
  mediaKind = 'image',
  focus = null,
  className = 'relative h-48 overflow-hidden',
  overlayClassName = 'absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-black/25',
  children,
}: KaraokeProfileBackgroundProps) {
  const hasMedia = Boolean(url || mediaId);

  return (
    <div className={className}>
      {hasMedia ? (
        <KaraokeProfileBackgroundMedia
          url={url ?? ''}
          mediaId={mediaId}
          mimeType={mimeType}
          mediaKind={mediaKind}
          focus={focus}
        />
      ) : (
        <>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600" />
          <div className="pointer-events-none absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay" />
        </>
      )}
      <div className={`pointer-events-none ${overlayClassName}`} aria-hidden />
      {children ? (
        <div className="pointer-events-none relative z-10 h-full w-full [&_button]:pointer-events-auto [&_label]:pointer-events-auto [&_a]:pointer-events-auto">
          {children}
        </div>
      ) : null}
    </div>
  );
}
