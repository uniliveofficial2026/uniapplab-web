/**
 * Map LiveKit participants to 1v1 PK cameras by canonical user_id only.
 * Never map by email, display name, username, or participant list order.
 */
export function pkCameraSideForUserId(
  userId: string,
  hostUserId: string,
  opponentUserId: string | null | undefined,
): 'left' | 'right' | null {
  const id = userId.trim();
  if (!id) return null;
  if (id === hostUserId.trim()) return 'left';
  if (opponentUserId?.trim() && id === opponentUserId.trim()) return 'right';
  return null;
}

export function isPkPreviewAssetUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\/assets\/live\/pk\/(luna|rico)-camera\.webp(?:\?|$)/i.test(url);
}
