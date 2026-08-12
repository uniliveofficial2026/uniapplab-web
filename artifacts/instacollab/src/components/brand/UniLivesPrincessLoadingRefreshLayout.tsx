import React, { useEffect, useRef } from 'react';
import { AppNativeVideo } from '../common/AppNativeVideo';
import {
  PRINCESS_LOADING_REFRESH_ART_SIZE,
  PRINCESS_LOADING_REFRESH_BG_EXTEND_SRC,
  PRINCESS_LOADING_REFRESH_LOCKED_POSTER_SRC,
  PRINCESS_LOADING_REFRESH_LOCKED_VIDEO_SRC,
  PRINCESS_LOADING_REFRESH_DURATION_MS,
} from './princessLoadingRefreshAssets';
import { installVideoLoopGuard } from '../../lib/videoLoopGuard';
import './princessLoadingRefresh.css';

type Props = {
  children?: React.ReactNode;
  className?: string;
  overlay?: boolean;
  /**
   * Keep the ~5s clip looping. When false, finish the current cycle then stop.
   * Guard prevents freeze/stuck on last frame.
   */
  loop?: boolean;
  staticPoster?: boolean;
  onVideoEnded?: () => void;
  onVideoError?: () => void;
};

/**
 * In-app loading — second locked 9:16 video.
 * Reliable ~5s loop via videoLoopGuard (never stuck).
 */
export function UniLivesPrincessLoadingRefreshLayout({
  children,
  className = '',
  overlay = false,
  loop = false,
  staticPoster = false,
  onVideoEnded,
  onVideoError,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const onEndedRef = useRef(onVideoEnded);
  onEndedRef.current = onVideoEnded;
  const onErrorRef = useRef(onVideoError);
  onErrorRef.current = onVideoError;

  useEffect(() => {
    if (staticPoster) return;
    const el = videoRef.current;
    if (!el) return;

    el.muted = true;
    el.playsInline = true;
    el.controls = false;
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }

    const kick = () => {
      void el.play().catch(() => undefined);
    };
    kick();
    el.addEventListener('loadeddata', kick, { once: true });
    el.addEventListener('canplay', kick, { once: true });

    const stop = installVideoLoopGuard(el, {
      durationMs: PRINCESS_LOADING_REFRESH_DURATION_MS,
      shouldLoop: () => loopRef.current,
      onCycle: () => {
        if (!loopRef.current) onEndedRef.current?.();
      },
      onFinished: () => {
        onEndedRef.current?.();
      },
    });

    return () => {
      el.removeEventListener('loadeddata', kick);
      el.removeEventListener('canplay', kick);
      stop();
    };
  }, [staticPoster]);

  return (
    <div
      className={`upr-root ${className}`.trim()}
      data-unilives-princess-loading-refresh=""
      data-unilives-inapp-loading=""
      data-overlay={overlay ? 'true' : undefined}
      data-art-w={PRINCESS_LOADING_REFRESH_ART_SIZE.w}
      data-art-h={PRINCESS_LOADING_REFRESH_ART_SIZE.h}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="upr-sr">UniLive’s loading</span>

      <div className="upr-extend" aria-hidden>
        <img src={PRINCESS_LOADING_REFRESH_BG_EXTEND_SRC} alt="" />
        <img
          src={PRINCESS_LOADING_REFRESH_LOCKED_POSTER_SRC}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            opacity: 0.55,
            filter: 'blur(28px) saturate(1.15)',
            transform: 'scale(1.12)',
          }}
        />
      </div>

      <div className="upr-frame" data-unilives-princess-loading-refresh-frame="">
        {staticPoster ? (
          <img
            className="upr-art"
            data-motion="poster"
            src={PRINCESS_LOADING_REFRESH_LOCKED_POSTER_SRC}
            alt="UniLive’s"
            width={PRINCESS_LOADING_REFRESH_ART_SIZE.w}
            height={PRINCESS_LOADING_REFRESH_ART_SIZE.h}
            decoding="async"
            fetchPriority="high"
            draggable={false}
          />
        ) : (
          <>
            <img
              className="upr-art"
              data-motion="poster"
              src={PRINCESS_LOADING_REFRESH_LOCKED_POSTER_SRC}
              alt=""
              width={PRINCESS_LOADING_REFRESH_ART_SIZE.w}
              height={PRINCESS_LOADING_REFRESH_ART_SIZE.h}
              decoding="async"
              fetchPriority="high"
              draggable={false}
              aria-hidden
              style={{ zIndex: 0 }}
            />
            <AppNativeVideo
              ref={videoRef}
              className="upr-art"
              data-motion="video"
              src={PRINCESS_LOADING_REFRESH_LOCKED_VIDEO_SRC}
              poster={PRINCESS_LOADING_REFRESH_LOCKED_POSTER_SRC}
              width={PRINCESS_LOADING_REFRESH_ART_SIZE.w}
              height={PRINCESS_LOADING_REFRESH_ART_SIZE.h}
              autoPlay
              muted
              playsInline
              loop={false}
              controls={false}
              preload="auto"
              onError={() => onErrorRef.current?.()}
              aria-label="UniLive’s loading animation"
              style={{ zIndex: 1 }}
            />
          </>
        )}
        {children}
      </div>
    </div>
  );
}
