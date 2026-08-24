import { EffectQueue } from "./EffectQueue.ts";
import { EffectWatchdog, type WatchdogSignal } from "./EffectWatchdog.ts";
import { ResourcePool } from "./ResourcePool.ts";
import { AudioCoordinator } from "./AudioCoordinator.ts";
import { disposeRendererHandles } from "./rendererCleanup.ts";
import { giftRendererFallback } from "../renderers/giftRendererRegistry.ts";
import type { DeviceTier } from "../runtime/capabilityProfile.ts";

export type ScheduledEffect = {
  id: string;
  kind: "gift" | "animation" | "face" | "beauty";
  rendererId: string;
  priority: number;
  fullscreen?: boolean;
  audioUrl?: string;
  maxDurationMs?: number;
};

export type SchedulerHooks = {
  play: (effect: ScheduledEffect) => Promise<void> | void;
  fallback: (effect: ScheduledEffect, reason: WatchdogSignal | "queue-overflow" | "reduced-motion") => void;
};

const MAX_SIMULTANEOUS = 2;

export class EffectScheduler {
  private queue = new EffectQueue<ScheduledEffect>(24);
  private active: ScheduledEffect[] = [];
  private watchdog = new EffectWatchdog();
  private pool = new ResourcePool();
  private audio = new AudioCoordinator();
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private suspended = false;
  private readonly hooks: SchedulerHooks;
  private readonly tier: DeviceTier;

  constructor(hooks: SchedulerHooks, tier: DeviceTier = "tier-2-medium") {
    this.hooks = hooks;
    this.tier = tier;
  }

  enqueue(effect: ScheduledEffect): void {
    if (this.tier === "tier-0-static") {
      this.hooks.fallback(effect, "reduced-motion");
      return;
    }
    const { accepted, dropped } = this.queue.enqueue(effect, effect.id, effect.priority);
    for (const row of dropped) {
      this.hooks.fallback(row, "queue-overflow");
    }
    if (!accepted) return;
    this.pump();
  }

  suspend(): void {
    this.suspended = true;
    this.audio.stop();
  }

  resume(): void {
    this.suspended = false;
    this.pump();
  }

  cancel(id: string): void {
    this.active = this.active.filter((e) => e.id !== id);
    this.pump();
  }

  dispose(): void {
    this.queue.clear();
    this.active = [];
    this.audio.stop();
    this.watchdog.dispose();
    this.pool.disposeAll();
    disposeRendererHandles({ timers: this.timers });
    this.timers = [];
  }

  snapshot() {
    return { queued: this.queue.length, active: this.active.length, pool: this.pool.snapshot() };
  }

  private pump(): void {
    if (this.suspended) return;
    while (this.active.length < MAX_SIMULTANEOUS) {
      if (this.active.some((e) => e.fullscreen)) break;
      const next = this.queue.dequeue();
      if (!next) break;
      if (next.fullscreen && this.active.length > 0) {
        this.queue.enqueue(next, `${next.queueKey}:retry`, next.priority);
        break;
      }
      this.start(next);
    }
  }

  private start(effect: ScheduledEffect): void {
    this.active.push(effect);
    this.pool.acquire("texture");
    this.watchdog.start((signal) => {
      this.fail(effect, signal);
    }, 2500);
    const maxMs = effect.maxDurationMs || 8000;
    const timer = setTimeout(() => this.complete(effect), maxMs);
    this.timers.push(timer);
    if (this.tier !== "tier-1-low") this.audio.play(effect.audioUrl);
    void Promise.resolve(this.hooks.play(effect)).catch(() => this.fail(effect, "decode-failure"));
  }

  private complete(effect: ScheduledEffect): void {
    this.active = this.active.filter((e) => e.id !== effect.id);
    this.pool.release("texture");
    this.audio.stop();
    this.pump();
  }

  private fail(effect: ScheduledEffect, reason: WatchdogSignal | "queue-overflow" | "reduced-motion"): void {
    this.active = this.active.filter((e) => e.id !== effect.id);
    this.pool.release("texture");
    this.audio.stop();
    this.hooks.fallback(effect, reason);
    void giftRendererFallback();
    this.pump();
  }
}
