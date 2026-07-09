/** Serialize TRTC effect/background applies — prevents overlapping setBackground races. */
let chain: Promise<void> = Promise.resolve();

export function enqueueTencentWebAREffect(task: () => Promise<void>): Promise<void> {
  const run = chain.then(task, task);
  chain = run.catch(() => undefined);
  return run;
}

export function resetTencentWebAREffectQueue(): void {
  chain = Promise.resolve();
}
