import { useCallback, useRef, useState } from 'react';
import { GripVertical, ShoppingBag, X } from 'lucide-react';
import { CoinIcon } from '../../components/common/CoinIcon';
import type { CommerceCardPosition, CommerceProduct } from '../utils/liveRoomTypes';
import { clampCommerceCardPosition, formatCommercePrice, normalizeCommerceProduct } from '../utils/liveRoomTypes';

type CommerceLiveProductCardProps = {
  product: CommerceProduct;
  salesCount: number;
  isHost: boolean;
  position: CommerceCardPosition;
  onBuy: () => void;
  onUnpin?: () => void;
  onPositionChange: (position: CommerceCardPosition) => void;
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=160&h=160&fit=crop';

export function CommerceLiveProductCard({
  product,
  salesCount,
  isHost,
  position,
  onBuy,
  onUnpin,
  onPositionChange,
}: CommerceLiveProductCardProps) {
  const normalized = normalizeCommerceProduct(product);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: CommerceCardPosition;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [draftPosition, setDraftPosition] = useState<CommerceCardPosition | null>(null);

  const displayPosition = draftPosition ?? position;

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const stage = cardRef.current?.offsetParent as HTMLElement | null;
      if (!stage) return;

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origin: displayPosition,
      };
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);

      const onMove = (moveEvent: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || moveEvent.pointerId !== drag.pointerId) return;
        const bounds = stage.getBoundingClientRect();
        if (bounds.width < 1 || bounds.height < 1) return;

        const dx = ((moveEvent.clientX - drag.startX) / bounds.width) * 100;
        const dy = ((moveEvent.clientY - drag.startY) / bounds.height) * 100;
        setDraftPosition(
          clampCommerceCardPosition({
            x: drag.origin.x + dx,
            y: drag.origin.y + dy,
          }),
        );
      };

      const onUp = (upEvent: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || upEvent.pointerId !== drag.pointerId) return;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        dragRef.current = null;
        setDragging(false);
        setDraftPosition((prev) => {
          const finalPosition = clampCommerceCardPosition(prev ?? drag.origin);
          onPositionChange(finalPosition);
          return null;
        });
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [displayPosition, onPositionChange],
  );

  return (
    <div
      ref={cardRef}
      className={`pointer-events-auto absolute z-40 w-[min(100%,20rem)] max-w-sm ${
        dragging ? 'cursor-grabbing' : ''
      }`}
      style={{
        left: `${displayPosition.x}%`,
        top: `${displayPosition.y}%`,
        transform: 'translate(-50%, -50%)',
        touchAction: 'none',
      }}
    >
      <div
        className={`overflow-hidden rounded-2xl border border-amber-400/35 bg-black/85 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md ${
          dragging ? 'ring-2 ring-amber-400/50' : ''
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Drag product card"
          onPointerDown={handlePointerDown}
          className="flex cursor-grab items-center justify-center gap-1 border-b border-white/10 bg-white/5 py-1 active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5 text-white/45" aria-hidden />
          <span className="text-[9px] font-semibold uppercase tracking-wide text-white/45">
            Drag to move
          </span>
        </div>

        <div className="flex items-stretch gap-0">
          <div className="relative h-[88px] w-[88px] shrink-0 bg-amber-500/10">
            <img
              src={product.imageUrl || FALLBACK_IMAGE}
              alt=""
              className="h-full w-full object-cover"
            />
            <span className="absolute left-1.5 top-1.5 rounded-full bg-red-600/90 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white">
              Live
            </span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-black text-white">{product.title}</p>
              {product.description ? (
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/65">
                  {product.description}
                </p>
              ) : null}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold text-amber-200">
                {normalized.priceType === 'coins' ? (
                  <span className="inline-flex items-center gap-1">
                    <CoinIcon className="h-3.5 w-3.5" />
                    {normalized.priceCoins}
                    <span className="text-[9px] font-semibold text-white/45">· {salesCount} sold</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    {formatCommercePrice(normalized)}
                    <span className="text-[9px] font-semibold text-white/45">· {salesCount} sold</span>
                  </span>
                )}
              </div>

              {isHost ? (
                <button
                  type="button"
                  onClick={onUnpin}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white"
                >
                  <X className="h-3 w-3" />
                  Unpin
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onBuy}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-black shadow-lg active:scale-95"
                >
                  <ShoppingBag className="h-3 w-3" />
                  Buy
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
