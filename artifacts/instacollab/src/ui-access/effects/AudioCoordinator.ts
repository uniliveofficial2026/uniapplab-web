export class AudioCoordinator {
  private current: HTMLAudioElement | null = null;

  play(url?: string | null): void {
    this.stop();
    if (!url || typeof Audio === "undefined") return;
    try {
      const audio = new Audio(url);
      audio.preload = "auto";
      void audio.play().catch(() => undefined);
      this.current = audio;
    } catch {
      /* silent visual fallback */
    }
  }

  stop(): void {
    if (!this.current) return;
    try {
      this.current.pause();
      this.current.src = "";
    } catch {
      /* ignore */
    }
    this.current = null;
  }
}
