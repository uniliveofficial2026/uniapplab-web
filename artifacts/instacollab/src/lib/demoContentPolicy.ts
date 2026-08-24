/**
 * Demo / seed content policy.
 * Real (production) builds must never inject seed users, posts, stories, rooms, or DMs.
 * Dev can opt in via Vite DEV, or force with VITE_ENABLE_DEMO_CONTENT=1 / =0.
 */

function readViteEnv(): Record<string, unknown> {
  try {
    return (import.meta as ImportMeta & { env?: Record<string, unknown> }).env ?? {};
  } catch {
    return {};
  }
}

export function isDemoContentEnabled(): boolean {
  const env = readViteEnv();
  const flag = String(env.VITE_ENABLE_DEMO_CONTENT ?? '').trim();
  if (flag === '1' || flag.toLowerCase() === 'true') return true;
  if (flag === '0' || flag.toLowerCase() === 'false') return false;
  return Boolean(env.DEV);
}

/** Bundled seed identities from `lib/data` (u1, u2, …) — never real cloud accounts. */
export function isLegacySeedUserId(userId: string | null | undefined): boolean {
  return /^u\d+$/.test(String(userId || '').trim());
}

export function isDemoSeedChatId(chatId: string | null | undefined): boolean {
  return isLegacySeedUserId(chatId);
}

export function isDemoSeedMessageId(messageId: string | null | undefined): boolean {
  return /^demo_/.test(String(messageId || '').trim());
}

export function isDemoManagedRoomId(roomId: string | null | undefined): boolean {
  const id = String(roomId || '').trim();
  return id === '1167298' || id === '1181033';
}
