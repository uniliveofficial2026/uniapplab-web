export function disposeRendererHandles(input: {
  timers?: Array<ReturnType<typeof setTimeout> | number>;
  listeners?: Array<{ target: EventTarget; type: string; fn: EventListener }>;
  audio?: { pause(): void; src?: string };
}): void {
  for (const t of input.timers || []) clearTimeout(t as ReturnType<typeof setTimeout>);
  for (const l of input.listeners || []) {
    try {
      l.target.removeEventListener(l.type, l.fn);
    } catch {
      /* ignore */
    }
  }
  if (input.audio) {
    try {
      input.audio.pause();
      if ("src" in input.audio) input.audio.src = "";
    } catch {
      /* ignore */
    }
  }
}
