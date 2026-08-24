/**
 * Paid gift FX / room credit must be traceable to settlement.
 * Client-crafted gift_play without a settlement id is not authoritative.
 */

export type GiftAuthorityFields = {
  starValue?: number;
  giftTransactionId?: string | null;
};

/** Settlement ids minted only after wallet settle (API / Firebase / local demo ledger). */
export function isAuthoritativeGiftSettlementId(id: unknown): boolean {
  if (typeof id !== 'string') return false;
  const t = id.trim();
  if (t.length < 8) return false;
  // playId-shaped ids are NOT settlement ids
  if (/^gift_\d+_[a-z0-9]+$/i.test(t) && !t.includes('settle') && !t.includes('tx')) {
    return false;
  }
  return true;
}

/**
 * Remote paid FX / host credit require giftTransactionId.
 * Zero-star / preview paths may omit it (admin embed preview).
 */
export function canAcceptGiftPlayForFx(
  gift: GiftAuthorityFields,
  opts?: { allowPreview?: boolean },
): boolean {
  if (opts?.allowPreview) return true;
  const stars = typeof gift.starValue === 'number' ? gift.starValue : 0;
  if (stars <= 0) return Boolean(opts?.allowPreview);
  return isAuthoritativeGiftSettlementId(gift.giftTransactionId);
}

/** Room seat/chat credit from remote gift_play — same bar as FX for paid gifts. */
export function canAcceptGiftPlayForRoomCredit(gift: GiftAuthorityFields): boolean {
  return canAcceptGiftPlayForFx(gift);
}

export function mintLocalDemoSettlementId(clientRequestId: string): string {
  const base = clientRequestId.trim() || `demo_${Date.now()}`;
  return `local_settle_${base}`;
}
