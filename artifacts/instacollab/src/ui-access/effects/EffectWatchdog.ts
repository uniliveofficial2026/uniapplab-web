export type WatchdogSignal =
  | "init-timeout"
  | "render-stall"
  | "excessive-frame-time"
  | "context-loss"
  | "memory-pressure"
  | "missing-dependency"
  | "decode-failure"
  | "background";

export type WatchdogHandler = (signal: WatchdogSignal) => void;

export class EffectWatchdog {
  private initTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFrameAt = 0;
  private handler: WatchdogHandler | null = null;

  start(onSignal: WatchdogHandler, initTimeoutMs = 2500): void {
    this.handler = onSignal;
    this.lastFrameAt = Date.now();
    this.initTimer = setTimeout(() => this.signal("init-timeout"), initTimeoutMs);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibility);
    }
  }

  markFrame(frameTimeMs?: number): void {
    this.lastFrameAt = Date.now();
    if (this.initTimer) {
      clearTimeout(this.initTimer);
      this.initTimer = null;
    }
    if (typeof frameTimeMs === "number" && frameTimeMs > 50) this.signal("excessive-frame-time");
  }

  signal(signal: WatchdogSignal): void {
    this.handler?.(signal);
  }

  dispose(): void {
    if (this.initTimer) clearTimeout(this.initTimer);
    this.initTimer = null;
    this.handler = null;
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibility);
    }
  }

  private onVisibility = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") this.signal("background");
  };
}
