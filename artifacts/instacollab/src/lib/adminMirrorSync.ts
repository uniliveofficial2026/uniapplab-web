import { isAdminMirrorFollower, lockAdminMirrorRoleFromBootstrap } from './adminMirrorRole';

/**
 * Lockstep sync: left LiveAppCanvas embed (primary) → Inspect mirror iframe (follower).
 * Uses BroadcastChannel (same origin) so scroll + screen stay mirrored without delay.
 */

const CHANNEL = 'unilives-studio-mirror-v1';

export type MirrorSyncRole = 'primary' | 'follower';

type ScrollItem = { i: number; top: number; left: number; yRatio?: number; xRatio?: number };

type MirrorNavMessage = {
  kind: 'nav';
  tab?: string;
  appTab?: string;
  profileUserId?: string | null;
  chatId?: string | null;
  roomsPath?: string | null;
  path?: string;
  at: number;
};

type MirrorScrollsMessage = {
  kind: 'scrolls';
  items: ScrollItem[];
  winX: number;
  winY: number;
  winYRatio?: number;
  winXRatio?: number;
  at: number;
};

type MirrorHelloMessage = {
  kind: 'hello';
  role: MirrorSyncRole;
  at: number;
};

type MirrorSyncMessage = MirrorNavMessage | MirrorScrollsMessage | MirrorHelloMessage;

function readRole(): MirrorSyncRole {
  lockAdminMirrorRoleFromBootstrap();
  return isAdminMirrorFollower() ? 'follower' : 'primary';
}

function isStudioEmbed(): boolean {
  try {
    if (window.parent !== window) return true;
  } catch {
    return true;
  }
  return /(?:^|[?&])(?:pick=|mirror=|adminOrigin=)/.test(window.location.search || '');
}

function currentTabHint(): string | undefined {
  const fromDom = document.documentElement.getAttribute('data-admin-mirror-tab');
  if (fromDom) return fromDom;
  const params = new URLSearchParams(window.location.search);
  return params.get('appTab') || undefined;
}

/** Stable ordered list of scrollable elements (same tree order in both embeds). */
function listScrollables(): HTMLElement[] {
  const root =
    (document.querySelector('[data-admin-embed-app]') as HTMLElement | null) ||
    document.getElementById('root') ||
    document.body;
  if (!root) return [];
  const out: HTMLElement[] = [];
  const walk = (el: Element) => {
    if (el instanceof HTMLElement) {
      const st = getComputedStyle(el);
      const oy = st.overflowY;
      const ox = st.overflowX;
      const canY = (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 2;
      const canX = (ox === 'auto' || ox === 'scroll' || ox === 'overlay') && el.scrollWidth > el.clientWidth + 2;
      if (canY || canX) out.push(el);
    }
    for (let i = 0; i < el.children.length; i += 1) walk(el.children[i]!);
  };
  walk(root);
  return out;
}

function scrollRatio(offset: number, size: number, client: number): number {
  const max = Math.max(0, size - client);
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, offset / max));
}

function applyScrollRatio(el: HTMLElement, axis: 'top' | 'left', ratio: number | undefined, fallback: number): void {
  if (typeof ratio === 'number' && Number.isFinite(ratio)) {
    if (axis === 'top') {
      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      el.scrollTop = max * Math.min(1, Math.max(0, ratio));
    } else {
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      el.scrollLeft = max * Math.min(1, Math.max(0, ratio));
    }
    return;
  }
  if (axis === 'top') el.scrollTop = fallback;
  else el.scrollLeft = fallback;
}

function snapshotScrolls(): MirrorScrollsMessage {
  const items = listScrollables().map((el, i) => ({
    i,
    top: el.scrollTop,
    left: el.scrollLeft,
    yRatio: scrollRatio(el.scrollTop, el.scrollHeight, el.clientHeight),
    xRatio: scrollRatio(el.scrollLeft, el.scrollWidth, el.clientWidth),
  }));
  const doc = document.documentElement;
  const body = document.body;
  const maxY = Math.max(
    0,
    Math.max(doc.scrollHeight, body?.scrollHeight || 0) - window.innerHeight,
  );
  const maxX = Math.max(
    0,
    Math.max(doc.scrollWidth, body?.scrollWidth || 0) - window.innerWidth,
  );
  return {
    kind: 'scrolls',
    items,
    winX: window.scrollX || 0,
    winY: window.scrollY || 0,
    winYRatio: maxY > 0 ? (window.scrollY || 0) / maxY : 0,
    winXRatio: maxX > 0 ? (window.scrollX || 0) / maxX : 0,
    at: performance.now(),
  };
}

function applyScrolls(msg: MirrorScrollsMessage): void {
  const list = listScrollables();
  for (const item of msg.items) {
    const el = list[item.i];
    if (!el) continue;
    applyScrollRatio(el, 'top', item.yRatio, item.top);
    applyScrollRatio(el, 'left', item.xRatio, item.left);
  }
  const doc = document.documentElement;
  const body = document.body;
  const maxY = Math.max(
    0,
    Math.max(doc.scrollHeight, body?.scrollHeight || 0) - window.innerHeight,
  );
  const maxX = Math.max(
    0,
    Math.max(doc.scrollWidth, body?.scrollWidth || 0) - window.innerWidth,
  );
  const nextY =
    typeof msg.winYRatio === 'number' && Number.isFinite(msg.winYRatio)
      ? maxY * Math.min(1, Math.max(0, msg.winYRatio))
      : msg.winY;
  const nextX =
    typeof msg.winXRatio === 'number' && Number.isFinite(msg.winXRatio)
      ? maxX * Math.min(1, Math.max(0, msg.winXRatio))
      : msg.winX;
  if (Math.abs(window.scrollX - nextX) > 0.5 || Math.abs(window.scrollY - nextY) > 0.5) {
    window.scrollTo(nextX, nextY);
  }
}

function applyNav(msg: MirrorNavMessage): void {
  const tab = msg.tab || msg.appTab || currentTabHint();
  if (msg.path && msg.path !== window.location.pathname) {
    try {
      window.history.replaceState(window.history.state, '', `${msg.path}${window.location.search}`);
    } catch {
      /* ignore */
    }
  }
  if (tab) {
    window.dispatchEvent(
      new CustomEvent('admin-ui-set-tab', {
        detail: {
          tab,
          profileUserId: msg.profileUserId ?? null,
          chatId: msg.chatId ?? null,
          roomsPath: msg.roomsPath ?? undefined,
        },
      }),
    );
  }
}

export function startAdminMirrorSync(): () => void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return () => undefined;
  if (!isStudioEmbed()) return () => undefined;

  const role = readRole();
  const channel = new BroadcastChannel(CHANNEL);
  let applying = false;
  let lastNavAt = 0;
  let lastScrollSig = '';
  let raf = 0;
  let stopped = false;

  const publish = (msg: MirrorSyncMessage) => {
    if (applying || stopped) return;
    try {
      channel.postMessage(msg);
    } catch {
      /* ignore */
    }
  };

  const publishNav = (detail: Partial<MirrorNavMessage> = {}) => {
    const at = Date.now();
    const tab = detail.tab || detail.appTab || currentTabHint();
    if (at < lastNavAt) return;
    lastNavAt = at;
    publish({
      kind: 'nav',
      tab,
      appTab: detail.appTab || detail.tab || tab,
      profileUserId: detail.profileUserId ?? null,
      chatId: detail.chatId ?? null,
      roomsPath: detail.roomsPath ?? null,
      path: detail.path || window.location.pathname,
      at,
    });
  };

  channel.onmessage = (event: MessageEvent<MirrorSyncMessage>) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    if (role === 'primary') {
      if (msg.kind === 'hello' && msg.role === 'follower') {
        publishNav();
        publish(snapshotScrolls());
      }
      return;
    }

    if (msg.kind === 'hello') return;

    if (msg.kind === 'nav') {
      if (msg.at && msg.at < lastNavAt) return;
      lastNavAt = msg.at || Date.now();
      applying = true;
      try {
        applyNav(msg);
      } finally {
        window.setTimeout(() => {
          applying = false;
          publish({ kind: 'hello', role: 'follower', at: Date.now() });
        }, 40);
      }
      return;
    }

    if (msg.kind === 'scrolls') {
      applying = true;
      try {
        applyScrolls(msg);
      } finally {
        applying = false;
      }
    }
  };

  const onParentNav = (event: Event) => {
    if (role !== 'primary') return;
    const detail = (event as CustomEvent).detail || {};
    publishNav({
      tab: detail.tab || detail.appTab,
      appTab: detail.appTab || detail.tab,
      profileUserId: detail.profileUserId ?? null,
      chatId: detail.chatId ?? null,
      roomsPath: detail.roomsPath ?? null,
      path: window.location.pathname,
    });
  };

  const onSetTab = (event: Event) => {
    if (role !== 'primary' || applying) return;
    const detail = (event as CustomEvent).detail || {};
    publishNav({
      tab: detail.tab,
      appTab: detail.tab,
      profileUserId: detail.profileUserId ?? null,
      chatId: detail.chatId ?? null,
      roomsPath: detail.roomsPath ?? null,
      path: window.location.pathname,
    });
  };

  const onMirrorState = (event: Event) => {
    if (role !== 'primary' || applying) return;
    const detail = (event as CustomEvent).detail || {};
    if (detail.tab) {
      document.documentElement.setAttribute('data-admin-mirror-tab', String(detail.tab));
    }
    publishNav({
      tab: detail.tab,
      appTab: detail.tab,
      profileUserId: detail.profileUserId ?? null,
      chatId: detail.chatId ?? null,
      roomsPath: detail.roomsPath ?? null,
      path: detail.path || window.location.pathname,
    });
  };

  window.addEventListener('admin-ui-navigate', onParentNav);
  window.addEventListener('admin-ui-set-tab', onSetTab);
  window.addEventListener('admin-ui-mirror-state', onMirrorState);

  // Primary: continuous scroll mirror via rAF (covers nested feed overflow containers).
  if (role === 'primary') {
    const tick = () => {
      if (stopped) return;
      raf = window.requestAnimationFrame(tick);
      if (applying) return;
      const snap = snapshotScrolls();
      const sig = `${snap.winXRatio ?? snap.winX}|${snap.winYRatio ?? snap.winY}|${snap.items
        .map((it) => `${it.i}:${it.yRatio ?? it.top}:${it.xRatio ?? it.left}`)
        .join(';')}`;
      if (sig === lastScrollSig) return;
      lastScrollSig = sig;
      publish(snap);
    };
    raf = window.requestAnimationFrame(tick);
  }

  publish({ kind: 'hello', role, at: Date.now() });
  if (role === 'follower') {
    window.setTimeout(() => publish({ kind: 'hello', role: 'follower', at: Date.now() }), 50);
    window.setTimeout(() => publish({ kind: 'hello', role: 'follower', at: Date.now() }), 400);
    window.setTimeout(() => publish({ kind: 'hello', role: 'follower', at: Date.now() }), 1200);
  }

  return () => {
    stopped = true;
    if (raf) window.cancelAnimationFrame(raf);
    window.removeEventListener('admin-ui-navigate', onParentNav);
    window.removeEventListener('admin-ui-set-tab', onSetTab);
    window.removeEventListener('admin-ui-mirror-state', onMirrorState);
    channel.close();
  };
}
