/**
 * Cross-context demo call bus (BroadcastChannel).
 * Active only when force_demo=1 (or uni.forceDemo). Production cloud path unchanged.
 */
export type DemoCallBusMessage =
  | {
      type: 'invite' | 'accept' | 'decline' | 'end' | 'busy';
      chatId: string;
      fromUserId: string;
      callKind: 'audio' | 'video';
      callSessionId: string;
      threadId?: string;
      ts: number;
    };

const CHANNEL = 'uni.demo.call.bus.v1';

export function isDemoCallBusEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('force_demo') === '1') return true;
    if (url.searchParams.get('launch') === 'main' && url.searchParams.has('as')) return true;
  } catch {
    /* ignore */
  }
  try {
    return sessionStorage.getItem('uni.forceDemo') === '1';
  } catch {
    return false;
  }
}

export function newDemoCallSessionId(): string {
  return `demo-call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function publishDemoCallSignal(msg: DemoCallBusMessage): void {
  if (!isDemoCallBusEnabled() || typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage(msg);
    ch.close();
  } catch {
    /* ignore */
  }
}

export function subscribeDemoCallSignal(
  handler: (msg: DemoCallBusMessage) => void,
): () => void {
  if (!isDemoCallBusEnabled() || typeof BroadcastChannel === 'undefined') {
    return () => undefined;
  }
  const ch = new BroadcastChannel(CHANNEL);
  const onMessage = (event: MessageEvent) => {
    const data = event.data as DemoCallBusMessage | null;
    if (!data || typeof data !== 'object') return;
    if (!data.type || !data.chatId || !data.fromUserId) return;
    handler(data);
  };
  ch.addEventListener('message', onMessage);
  return () => {
    ch.removeEventListener('message', onMessage);
    ch.close();
  };
}
