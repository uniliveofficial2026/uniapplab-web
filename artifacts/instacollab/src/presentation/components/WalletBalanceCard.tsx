import type { WalletSummaryViewModel } from '../view-models/types';
import type { ActionId } from '../composition/actionRegistry';

type Props = {
  viewModel: WalletSummaryViewModel;
  variant?: 'default' | 'compact';
  title?: string;
  rechargeLabel?: string;
  onAction?: (id: ActionId, params: Record<string, unknown>) => void;
};

/** Presentation-only wallet cards. Same view model, two registered variants. */
export function WalletBalanceCard({ viewModel, variant = 'default', title, rechargeLabel, onAction }: Props) {
  const compact = variant === 'compact';
  return (
    <section
      data-component={compact ? 'wallet.balance-card.compact' : 'wallet.balance-card.v1'}
      className={compact ? 'rounded-xl border border-border px-3 py-2' : 'rounded-[var(--ui-radius-card,1.25rem)] border border-border p-4'}
    >
      <p className="text-xs font-semibold text-muted-foreground">{title || viewModel.titleKey}</p>
      <p className={compact ? 'text-lg font-black' : 'text-3xl font-black'}>{viewModel.coins}</p>
      {viewModel.permissions.canPurchase.allowed ? (
        <button
          type="button"
          className="mt-2 text-xs font-bold text-[color:var(--ui-color-action-primary,var(--color-unilives-primary))]"
          onClick={() => onAction?.('wallet.purchase', { packageId: 'default' })}
        >
          {rechargeLabel || 'wallet.recharge'}
        </button>
      ) : null}
    </section>
  );
}
