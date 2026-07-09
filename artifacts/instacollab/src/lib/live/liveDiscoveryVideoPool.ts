/** Cap concurrent LiveKit discovery previews so the Live grid stays light. */
const MAX_PREVIEW_CONNECTIONS = 6;

let active = 0;
const waiters = new Set<() => void>();

function wakeNextWaiter() {
  const next = waiters.values().next().value as (() => void) | undefined;
  if (next) next();
}

export async function acquireLivePreviewSlot(
  isCancelled?: () => boolean,
): Promise<(() => void) | null> {
  if (isCancelled?.()) return null;

  if (active < MAX_PREVIEW_CONNECTIONS) {
    active += 1;
    return release;
  }

  const granted = await new Promise<boolean>((resolve) => {
    const wake = () => {
      waiters.delete(wake);
      resolve(!isCancelled?.());
    };
    waiters.add(wake);
  });

  if (!granted) {
    wakeNextWaiter();
    return null;
  }

  active += 1;
  return release;
}

function release() {
  active = Math.max(0, active - 1);
  wakeNextWaiter();
}
