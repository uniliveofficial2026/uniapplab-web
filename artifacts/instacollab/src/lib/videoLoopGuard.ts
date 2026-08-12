/**
 * Keep a short clip looping without freezing on the last frame.
 * Uses native `loop` while active + stall / near-end watchdogs (iOS often drops `ended`).
 */

export const LOOP_CLIP_MS = 5042;

export type VideoLoopGuardOptions = {
  /** When true, keep looping. When false, stop after the current cycle. */
  shouldLoop: () => boolean;
  /** Called once per ~5s cycle (best-effort). */
  onCycle?: () => void;
  /** Called when looping should stop and the clip has finished (or timed out). */
  onFinished?: () => void;
  /** Nominal clip length in ms. */
  durationMs?: number;
};

export function installVideoLoopGuard(
  video: HTMLVideoElement,
  options: VideoLoopGuardOptions,
): () => void {
  const durationMs = options.durationMs ?? LOOP_CLIP_MS;
  let cycles = 0;
  let finished = false;
  let lastTime = 0;
  let stallTicks = 0;
  let awaitingFinalEnd = false;

  const safePlay = () => {
    video.muted = true;
    video.playsInline = true;
    video.controls = false;
    void video.play().catch(() => undefined);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    video.loop = false;
    options.onFinished?.();
  };

  const markCycle = () => {
    cycles += 1;
    options.onCycle?.();
  };

  const armFinalOrContinue = () => {
    if (finished) return;
    if (options.shouldLoop()) {
      video.loop = true;
      awaitingFinalEnd = false;
      safePlay();
      return;
    }
    // Stop looping — finish on natural end or one-cycle timeout.
    video.loop = false;
    awaitingFinalEnd = true;
    window.setTimeout(() => {
      if (!finished && awaitingFinalEnd) finish();
    }, durationMs + 400);
  };

  const onEnded = () => {
    if (finished) return;
    markCycle();
    if (!options.shouldLoop()) {
      finish();
      return;
    }
    // Native loop may not fire ended; if it did, restart explicitly.
    video.loop = true;
    try {
      video.currentTime = 0;
    } catch {
      /* ignore */
    }
    safePlay();
  };

  const onTimeUpdate = () => {
    if (finished) return;
    const t = video.currentTime;
    const dur = video.duration;

    // Detect wrap when native loop jumps to start.
    if (video.loop && lastTime > 1.5 && t < 0.45) {
      markCycle();
      armFinalOrContinue();
    }

    // Near end without `ended` (common on iOS) — nudge restart while looping.
    if (
      options.shouldLoop() &&
      Number.isFinite(dur) &&
      dur > 0 &&
      t >= dur - 0.12
    ) {
      try {
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
      safePlay();
      markCycle();
      armFinalOrContinue();
    }

    lastTime = t;
  };

  const onPlaying = () => {
    stallTicks = 0;
  };

  const stallWatch = window.setInterval(() => {
    if (finished) return;
    if (!options.shouldLoop() && awaitingFinalEnd) return;

    if (video.paused && !video.ended) {
      stallTicks += 1;
      if (stallTicks >= 2) {
        stallTicks = 0;
        if (options.shouldLoop()) {
          video.loop = true;
          safePlay();
        }
      }
      return;
    }

    // Playing but currentTime stuck.
    if (!video.paused && Math.abs(video.currentTime - lastTime) < 0.01) {
      stallTicks += 1;
      if (stallTicks >= 3) {
        stallTicks = 0;
        try {
          video.currentTime = Math.min(
            video.currentTime + 0.05,
            Math.max(0, (video.duration || 5) - 0.05),
          );
        } catch {
          /* ignore */
        }
        safePlay();
      }
    } else {
      stallTicks = 0;
    }
  }, 700);

  // Hard cycle metronome — guarantees a restart every ~5s while looping.
  const metronome = window.setInterval(() => {
    if (finished) return;
    if (!options.shouldLoop()) {
      armFinalOrContinue();
      return;
    }
    video.loop = true;
    if (video.paused || video.ended) {
      try {
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
      safePlay();
      markCycle();
    }
  }, durationMs);

  video.loop = options.shouldLoop();
  video.addEventListener('ended', onEnded);
  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('playing', onPlaying);
  video.addEventListener('error', finish);
  safePlay();

  return () => {
    finished = true;
    video.removeEventListener('ended', onEnded);
    video.removeEventListener('timeupdate', onTimeUpdate);
    video.removeEventListener('playing', onPlaying);
    video.removeEventListener('error', finish);
    window.clearInterval(stallWatch);
    window.clearInterval(metronome);
  };
}
