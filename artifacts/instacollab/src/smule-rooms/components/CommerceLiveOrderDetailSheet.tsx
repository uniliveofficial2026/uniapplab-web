import { CheckCircle2, DollarSign, MapPin, Package, Phone, User, X } from 'lucide-react';
import { CoinIcon } from '../../components/common/CoinIcon';
import type { CommerceOrder } from '../utils/liveRoomTypes';
import { CommerceOrderPaymentBadge } from './CommerceOrderPaymentBadge';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=160&h=160&fit=crop';

type CommerceLiveOrderDetailSheetProps = {
  order: CommerceOrder | null;
  onClose: () => void;
};

function paymentLabel(order: CommerceOrder): string {
  if (order.priceType === 'coins') return 'Paid with coins';
  return 'Paid with payment';
}

export function CommerceLiveOrderDetailSheet({ order, onClose }: CommerceLiveOrderDetailSheetProps) {
  if (!order) return null;

  const productPrice =
    order.priceType === 'coins' ? (
      <span className="inline-flex items-center gap-1 font-bold text-amber-200">
        <CoinIcon className="h-4 w-4" />
        {order.priceCoins}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 font-bold text-emerald-300">
        <DollarSign className="h-4 w-4" />
        ${(order.priceUsd ?? 0).toFixed(2)}
      </span>
    );

  return (
    <div className="absolute inset-x-0 bottom-[calc(5.5rem+var(--app-safe-bottom))] z-[120] px-3">
      <div className="mx-auto max-w-md rounded-2xl border border-emerald-400/25 bg-black/90 p-4 shadow-2xl backdrop-blur-md">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-300">
              Order for shipment
            </p>
            <p className="text-sm font-black text-white">{order.buyerName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/70 hover:bg-white/10"
            aria-label="Close order details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <CommerceOrderPaymentBadge order={order} size="md" />
            {order.paid ? (
              <p className="mt-0.5 text-[10px] text-white/55">{paymentLabel(order)}</p>
            ) : (
              <p className="mt-0.5 text-[10px] text-white/55">Awaiting payment</p>
            )}
            <p className="text-[10px] text-white/55">
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mb-3 flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <img
            src={order.productImageUrl || FALLBACK_IMAGE}
            alt=""
            className="h-16 w-16 shrink-0 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-300">
              <Package className="h-3 w-3" />
              Product
            </div>
            <p className="truncate text-sm font-black text-white">{order.productTitle}</p>
            {order.productDescription ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] text-white/60">{order.productDescription}</p>
            ) : null}
            <div className="mt-1 text-sm">{productPrice}</div>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-white/80">
          <div className="flex items-center gap-2 font-bold text-white">
            <User className="h-3.5 w-3.5 text-white/50" />
            {order.shipping.fullName}
          </div>
          <p>{order.shipping.email}</p>
          <p className="inline-flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-white/50" />
            {order.shipping.phone}
          </p>
          <div className="border-t border-white/10 pt-2">
            <p className="mb-1 inline-flex items-center gap-1.5 font-bold uppercase tracking-wide text-white/50">
              <MapPin className="h-3.5 w-3.5" />
              Ship to
            </p>
            <p>{order.shipping.addressLine1}</p>
            {order.shipping.addressLine2 ? <p>{order.shipping.addressLine2}</p> : null}
            <p>
              {order.shipping.city}, {order.shipping.state} {order.shipping.postalCode}
            </p>
            <p>{order.shipping.country}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
