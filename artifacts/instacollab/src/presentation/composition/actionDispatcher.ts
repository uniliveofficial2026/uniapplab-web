import type { ActionId } from './actionRegistry';
import { isActionId, validateActionParams } from './actionRegistry';
import { purchaseCoinPackage } from '../../domain/wallet/walletDomain';
import { sendGiftCommand } from '../../domain/gifts/giftDomain';
import { sendChatCommand } from '../../domain/chat/chatDomain';

export type DispatchResult = { ok: true } | { ok: false; errorKey: string };

/**
 * Presentation → domain command. Never writes wallet/ledger/seats locally.
 */
export async function dispatchPresentationAction(
  id: string,
  params: Record<string, unknown>,
  ctx: { userId: string },
): Promise<DispatchResult> {
  if (!isActionId(id)) return { ok: false, errorKey: 'error.forbidden' };
  const invalid = validateActionParams(id, params);
  if (invalid.length) return { ok: false, errorKey: 'common.unknownError' };

  switch (id as ActionId) {
    case 'gift.send':
      return sendGiftCommand({
        giftId: String(params.giftId),
        receiverId: String(params.receiverId),
        clientRequestId: String(params.clientRequestId),
        roomId: typeof params.roomId === 'string' ? params.roomId : undefined,
      }).then((r) => (r.ok ? { ok: true } : { ok: false, errorKey: r.code || 'common.unknownError' }));
    case 'wallet.purchase':
      return purchaseCoinPackage(String(params.packageId), {
        successUrl: typeof window !== 'undefined' ? `${window.location.origin}/wallet?paid=1` : 'https://app.uniapplab.com/wallet?paid=1',
        cancelUrl: typeof window !== 'undefined' ? `${window.location.origin}/wallet` : 'https://app.uniapplab.com/wallet',
      }).then((r) => (r.ok ? { ok: true } : { ok: false, errorKey: r.code || 'common.unknownError' }));
    case 'chat.sendMessage':
      await sendChatCommand(String(params.threadId), String(params.clientId), String(params.text || ''), ctx.userId);
      return { ok: true };
    default:
      return { ok: false, errorKey: 'error.forbidden' };
  }
}
