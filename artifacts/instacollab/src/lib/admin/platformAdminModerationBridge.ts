/** postMessage bridge: Control Center watch chrome ↔ admin-embed room iframe */

export const PLATFORM_ADMIN_MOD_MSG = 'instacollab:platform-admin-moderation' as const;

export type PlatformAdminModAction = 'seats' | 'ban-seats' | 'viewers';

export type PlatformAdminModMessage = {
  source: typeof PLATFORM_ADMIN_MOD_MSG;
  action: PlatformAdminModAction;
  roomId?: string;
};

export function isPlatformAdminModMessage(data: unknown): data is PlatformAdminModMessage {
  if (!data || typeof data !== 'object') return false;
  const row = data as Record<string, unknown>;
  if (row.source !== PLATFORM_ADMIN_MOD_MSG) return false;
  return row.action === 'seats' || row.action === 'ban-seats' || row.action === 'viewers';
}

export function postPlatformAdminModeration(
  iframe: HTMLIFrameElement | null | undefined,
  action: PlatformAdminModAction,
  roomId?: string | null,
): boolean {
  const win = iframe?.contentWindow;
  if (!win) return false;
  const payload: PlatformAdminModMessage = {
    source: PLATFORM_ADMIN_MOD_MSG,
    action,
    ...(roomId ? { roomId: String(roomId) } : {}),
  };
  win.postMessage(payload, '*');
  return true;
}
