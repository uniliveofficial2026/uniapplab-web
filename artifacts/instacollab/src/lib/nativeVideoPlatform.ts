type VideoWithWebkit = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

export function isIosLikeDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

/** Whether the given video is in native element fullscreen (standard or iOS webkit). */
export function isVideoElementNativeFullscreen(
  video: HTMLVideoElement | null | undefined
): boolean {
  if (!video) return false;
  if (document.fullscreenElement === video) return true;
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  if (doc.webkitFullscreenElement === video) return true;
  const webkitVideo = video as VideoWithWebkit;
  return !!webkitVideo.webkitDisplayingFullscreen;
}

/** iOS uses webkitEnterFullscreen; Android/desktop use requestFullscreen with webkit fallback. */
export function tryEnterVideoFullscreen(video: HTMLVideoElement | null | undefined): void {
  if (!video) return;
  const webkitVideo = video as VideoWithWebkit;

  if (isIosLikeDevice() && typeof webkitVideo.webkitEnterFullscreen === 'function') {
    webkitVideo.webkitEnterFullscreen();
    return;
  }

  if (typeof video.requestFullscreen === 'function') {
    void video.requestFullscreen().catch(() => {
      if (typeof webkitVideo.webkitEnterFullscreen === 'function') {
        webkitVideo.webkitEnterFullscreen();
      }
    });
    return;
  }

  if (typeof webkitVideo.webkitEnterFullscreen === 'function') {
    webkitVideo.webkitEnterFullscreen();
  }
}

export function tryExitVideoFullscreen(video: HTMLVideoElement | null | undefined): void {
  if (!video) return;
  const webkitVideo = video as VideoWithWebkit;

  if (webkitVideo.webkitDisplayingFullscreen && typeof webkitVideo.webkitExitFullscreen === 'function') {
    webkitVideo.webkitExitFullscreen();
    return;
  }

  if (document.fullscreenElement === video && typeof document.exitFullscreen === 'function') {
    void document.exitFullscreen().catch(() => {});
  }
}

/** Inline playback attrs for iOS Safari + Android WebView (X5). */
export function applyMobileInlineVideoAttrs(video: HTMLVideoElement): void {
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', 'true');
  video.setAttribute('x5-playsinline', 'true');
  video.setAttribute('x5-video-player-type', 'h5-page');
  video.setAttribute('x5-video-player-fullscreen', 'false');
}

export function setNativeVideoMuted(
  video: HTMLVideoElement | null | undefined,
  muted: boolean,
): void {
  if (!video) return;
  video.muted = muted;
  if (muted) {
    video.setAttribute('muted', '');
  } else {
    video.removeAttribute('muted');
  }
}

export function toggleNativeVideoMuted(
  video: HTMLVideoElement | null | undefined,
): boolean {
  if (!video) return true;
  const next = !video.muted;
  setNativeVideoMuted(video, next);
  return next;
}
