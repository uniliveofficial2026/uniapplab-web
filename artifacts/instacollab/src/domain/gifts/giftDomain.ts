import { fetchGiftCatalogApi, sendGiftApi } from '../../lib/platformApi';
import type { GiftPanelViewModel } from '../../presentation/view-models/types';

export async function loadGiftPanel(canSend: boolean): Promise<GiftPanelViewModel> {
  try {
    const data = await fetchGiftCatalogApi();
    const items = (Array.isArray(data.gifts) ? data.gifts : []).slice(0, 40).map((raw) => {
      const g = raw as Record<string, unknown>;
      const id = String(g.id ?? '');
      return {
        giftId: id,
        displayName: String(g.name ?? id),
        price: Number(g.stars ?? g.price ?? 0),
        thumbnailAssetId: String(g.icon ?? `gift.${id}.thumbnail`),
        animationAssetId: typeof g.animation === 'string' ? String(g.animation) : undefined,
      };
    });
    return {
      items,
      status: items.length ? 'ready' : 'empty',
      sendActionId: 'gift.send',
      permissions: { canSend: { allowed: canSend, reasonKey: canSend ? undefined : 'error.forbidden' } },
    };
  } catch {
    return {
      items: [],
      status: 'error',
      sendActionId: 'gift.send',
      permissions: { canSend: { allowed: false, reasonKey: 'error.server' } },
    };
  }
}

export async function sendGiftCommand(input: {
  giftId: string;
  receiverId: string;
  clientRequestId: string;
  roomId?: string;
}): Promise<{ ok: boolean; code?: string }> {
  try {
    await sendGiftApi({
      giftId: input.giftId,
      receiverId: input.receiverId,
      clientRequestId: input.clientRequestId,
      roomId: input.roomId,
    });
    return { ok: true };
  } catch (err) {
    const code = err && typeof err === 'object' && 'translationKey' in err ? String((err as { translationKey: string }).translationKey) : 'gift.insufficientCoins';
    return { ok: false, code };
  }
}
