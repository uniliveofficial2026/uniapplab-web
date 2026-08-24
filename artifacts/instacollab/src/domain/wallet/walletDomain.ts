import { fetchWallet, createRechargeCheckoutSession } from '../../lib/platformApi';
import type { WalletSummaryViewModel } from '../../presentation/view-models/types';

export async function loadWalletSummary(userId: string): Promise<WalletSummaryViewModel> {
  if (!userId) {
    return {
      userId: '',
      coins: 0,
      diamonds: 0,
      bonusCoins: 0,
      status: 'error',
      titleKey: 'wallet.coins',
      rechargeActionId: 'wallet.purchase',
      permissions: {
        canPurchase: { allowed: false, reasonKey: 'error.unauthorized' },
        canTransfer: { allowed: false, reasonKey: 'error.unauthorized' },
      },
    };
  }
  try {
    const data = await fetchWallet();
    const coins = Number(data.coins ?? data.balance ?? 0);
    return {
      userId,
      coins,
      diamonds: Number(data.diamonds ?? 0),
      bonusCoins: Number(data.bonusCoins ?? 0),
      status: 'ready',
      titleKey: 'wallet.coins',
      rechargeActionId: 'wallet.purchase',
      permissions: {
        canPurchase: { allowed: true },
        canTransfer: { allowed: true },
      },
    };
  } catch {
    return {
      userId,
      coins: 0,
      diamonds: 0,
      bonusCoins: 0,
      status: 'error',
      titleKey: 'wallet.coins',
      rechargeActionId: 'wallet.purchase',
      permissions: {
        canPurchase: { allowed: false, reasonKey: 'error.server' },
        canTransfer: { allowed: false, reasonKey: 'error.server' },
      },
    };
  }
}

export async function purchaseCoinPackage(packageId: string, urls: { successUrl: string; cancelUrl: string }): Promise<{ ok: boolean; code?: string }> {
  try {
    await createRechargeCheckoutSession({ packageId, successUrl: urls.successUrl, cancelUrl: urls.cancelUrl });
    return { ok: true };
  } catch (err) {
    const code = err && typeof err === 'object' && 'translationKey' in err ? String((err as { translationKey: string }).translationKey) : 'common.unknownError';
    return { ok: false, code };
  }
}
