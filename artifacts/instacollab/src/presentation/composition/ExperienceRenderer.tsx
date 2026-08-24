import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { UiExperienceManifest } from './manifestSchema';
import { getComponentMeta } from './componentRegistry';
import { WalletBalanceCard } from '../components/WalletBalanceCard';
import type { WalletSummaryViewModel } from '../view-models/types';
import type { ActionId } from './actionRegistry';
import { dispatchPresentationAction } from './actionDispatcher';

type BindingBag = Record<string, unknown>;

type Props = {
  manifest: UiExperienceManifest;
  bindings: BindingBag;
  userId: string;
  translate?: (key: string) => string;
};

class SlotErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError(): { err: boolean } {
    return { err: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    /* isolate slot crash */
  }
  render(): ReactNode {
    if (this.state.err) return this.props.fallback;
    return this.props.children;
  }
}

function renderSlot(
  componentId: string,
  variant: string | undefined,
  viewModel: unknown,
  title: string | undefined,
  onAction: (id: ActionId, params: Record<string, unknown>) => void,
): ReactNode {
  if (componentId === 'wallet.balance-card.v1' || componentId === 'wallet.balance-card.compact') {
    return (
      <WalletBalanceCard
        viewModel={(viewModel as WalletSummaryViewModel) || { userId: '', coins: 0, diamonds: 0, bonusCoins: 0, status: 'loading', titleKey: 'wallet.coins', rechargeActionId: 'wallet.purchase', permissions: { canPurchase: { allowed: false }, canTransfer: { allowed: false } } }}
        variant={componentId === 'wallet.balance-card.compact' || variant === 'compact' ? 'compact' : 'default'}
        title={title}
        onAction={onAction}
      />
    );
  }
  return (
    <div data-component={componentId} data-unilives-slot-fallback="">
      {title || componentId}
    </div>
  );
}

/** Atomic layout render — one manifest version only. */
export function ExperienceRenderer({ manifest, bindings, userId, translate }: Props) {
  const onAction = (id: ActionId, params: Record<string, unknown>) => {
    void dispatchPresentationAction(id, params, { userId });
  };
  return (
    <div data-experience={manifest.experienceKey} data-manifest-version={manifest.version} dir="inherit">
      {manifest.layout.slots.map((slot) => {
        if (slot.visible === false) return null;
        const meta = getComponentMeta(slot.componentId);
        const componentId = meta?.id || meta?.fallbackComponentId || 'fallback.empty.v1';
        const vm = bindings[slot.dataBinding];
        const title = slot.titleKey && translate ? translate(slot.titleKey) : slot.titleKey;
        return (
          <SlotErrorBoundary key={slot.id} fallback={<div data-component="fallback.empty.v1" />}>
            {renderSlot(componentId, slot.variant, vm, title, onAction)}
          </SlotErrorBoundary>
        );
      })}
    </div>
  );
}
