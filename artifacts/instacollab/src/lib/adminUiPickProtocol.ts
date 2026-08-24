/** postMessage protocol between admin panel and live app embed pick mode. */

export const ADMIN_UI_PICK_READY = 'unilives-admin-ui-pick-ready';
export const ADMIN_UI_PICK_SELECTED = 'unilives-admin-ui-pick-selected';
export const ADMIN_UI_PICK_NAVIGATE = 'unilives-admin-ui-pick-navigate';
export const ADMIN_UI_PICK_HIGHLIGHT = 'unilives-admin-ui-pick-highlight';
export const ADMIN_UI_PICK_PING = 'unilives-admin-ui-pick-ping';
export const ADMIN_UI_PICK_SET_ENABLED = 'unilives-admin-ui-pick-set-enabled';
export const ADMIN_UI_PICK_SNAPSHOT = 'unilives-admin-ui-pick-snapshot';
export const ADMIN_UI_PICK_SNAPSHOT_REQUEST = 'unilives-admin-ui-pick-snapshot-request';
/** Live ImageBitmap frame from the single left-canvas app instance (transferable). */
export const ADMIN_UI_PICK_FRAME = 'unilives-admin-ui-pick-frame';
/** Parent enables/disables rAF mirror streaming. */
export const ADMIN_UI_PICK_MIRROR_SET = 'unilives-admin-ui-pick-mirror-set';
export const ADMIN_UI_DEBUG_LOG = 'unilives-admin-ui-debug-log';

export type AdminUiPickSelection = {
  resourceId?: string | null;
  nodeId?: string | null;
  componentId?: string | null;
  unilivesAttr?: string | null;
  /** Micro pick role: button, icon, text, container, body, frame, screen, … */
  kind?: string | null;
  tagName: string;
  label: string;
  className?: string;
  rect: { top: number; left: number; width: number; height: number };
  domPath: string;
  /** Inner viewport of the left live canvas when the pick was made. */
  viewportWidth?: number | null;
  viewportHeight?: number | null;
};

export type AdminUiPickSnapshot = {
  label: string;
  tagName: string;
  width: number;
  height: number;
  dataUrl?: string | null;
  html?: string | null;
  at: string;
  nodeId?: string | null;
  componentId?: string | null;
  resourceId?: string | null;
  /** viewport = full live canvas frame; selection = picked element */
  mode?: 'viewport' | 'selection' | null;
  kind?: string | null;
  /** Capture origin in iframe viewport coords (for scaling pick.rect onto the mirror). */
  originTop?: number | null;
  originLeft?: number | null;
};

export type AdminUiPickNavigate = {
  tab?: string;
  appTab?: string;
  profileUserId?: string | null;
  chatId?: string | null;
  roomsPath?: string | null;
};

const LOCAL_ADMIN_ORIGINS = ['http://127.0.0.1:5180', 'http://localhost:5180', 'http://127.0.0.1:5181', 'http://localhost:5181'];

function parseOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Accept local admin + HTTPS cloud admin origins passed via adminOrigin query param. */
export function resolveAdminPanelOrigin(raw: string | null | undefined): string | null {
  const origin = parseOrigin(raw);
  if (!origin) return null;
  if (LOCAL_ADMIN_ORIGINS.includes(origin)) return origin;
  try {
    const u = new URL(origin);
    if (u.protocol === 'https:') return origin;
  } catch {
    return null;
  }
  return null;
}

export function isAdminPanelMessage(event: MessageEvent): boolean {
  if (typeof window === 'undefined') return false;
  if (event.source === window) return false;
  if (LOCAL_ADMIN_ORIGINS.includes(event.origin)) return true;
  if (event.origin === window.location.origin) return true;
  try {
    const u = new URL(event.origin);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}
