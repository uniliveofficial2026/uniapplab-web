const UNSAFE = new Set([
  "payment",
  "gift-transaction",
  "message-send",
  "authentication",
  "seat-transition",
  "pk-transition",
  "call-connection",
  "media-upload",
  "destructive-confirm",
]);

let activeUnsafe = new Set<string>();
let pending: (() => void) | null = null;

export function enterUnsafeBoundary(name: string): () => void {
  activeUnsafe.add(name);
  return () => {
    activeUnsafe.delete(name);
    flushIfSafe();
  };
}

export function isActivationSafe(): boolean {
  for (const name of activeUnsafe) {
    if (UNSAFE.has(name)) return false;
  }
  return true;
}

export function scheduleAtomicActivation(fn: () => void): void {
  if (isActivationSafe()) {
    fn();
    return;
  }
  pending = fn;
}

function flushIfSafe(): void {
  if (pending && isActivationSafe()) {
    const next = pending;
    pending = null;
    next();
  }
}
