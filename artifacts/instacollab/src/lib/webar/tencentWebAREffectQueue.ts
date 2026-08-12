/**
 * Latest-wins queue for heavy TRTC work (preload / setBackground).
 * Older tasks are skipped so rapid beauty taps never pile up and freeze the UI.
 */
let chain: Promise<void> = Promise.resolve();
let latestGen = 0;

export function enqueueTencentWebAREffect(task: () => Promise<void>): Promise<void> {
  const gen = ++latestGen;
  const run = chain.then(
    async () => {
      if (gen !== latestGen) return;
      await task();
    },
    async () => {
      if (gen !== latestGen) return;
      await task();
    },
  );
  chain = run.catch(() => undefined);
  return run;
}

export function resetTencentWebAREffectQueue(): void {
  latestGen += 1;
  chain = Promise.resolve();
}
