import { DollarSign } from 'lucide-react';
import { CoinIcon } from '../../components/common/CoinIcon';
import type { CommerceOrder } from '../utils/liveRoomTypes';

type CommerceOrderPaymentBadgeProps = {
  order: CommerceOrder;
  size?: 'sm' | 'md';
};

export function CommerceOrderPaymentBadge({ order, size = 'sm' }: CommerceOrderPaymentBadgeProps) {
  const isCoins = order.priceType === 'coins';
  const iconClass = size === 'md' ? 'h-4 w-4' : 'h-3 w-3';
  const textClass = size === 'md' ? 'text-xs' : 'text-[10px]';

  if (!order.paid) {
    return (
      <span className={`${textClass} font-semibold text-white/50`}>Pending</span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 ${textClass} font-semibold ${
        isCoins ? 'text-amber-200' : 'text-emerald-300'
      }`}
    >
      {isCoins ? (
        <CoinIcon className={iconClass} />
      ) : (
        <DollarSign className={iconClass} />
      )}
      <span>Paid</span>
      {isCoins ? (
        order.priceCoins != null ? (
          <span className="text-white/55">{order.priceCoins}</span>
        ) : null
      ) : order.priceUsd != null ? (
        <span className="text-white/55">${order.priceUsd.toFixed(2)}</span>
      ) : null}
    </span>
  );
}
