import React, { useRef, type PointerEvent } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import { formatCommercePrice, type CommerceCardPosition, type CommerceProduct } from '../utils/liveRoomTypes';
import { CommerceProductArt } from './CommerceProductArt';
import './commerce-live-approved.css';

export type CommerceLiveProductCardProps = {
  product: CommerceProduct;
  salesCount?: number;
  isHost: boolean;
  position: CommerceCardPosition;
  onBuy: () => void;
  onUnpin?: () => void;
  onPositionChange?: (position: CommerceCardPosition) => void;
};

export function CommerceLiveProductCard({ product, salesCount = 0, isHost, position, onBuy, onUnpin, onPositionChange }: CommerceLiveProductCardProps) {
  const drag = useRef<{x:number;y:number;px:number;py:number}|null>(null);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!isHost || !onPositionChange) return;
    drag.current = { x: e.clientX, y: e.clientY, px: position.x, py: position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !onPositionChange) return;
    const host = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!host) return;
    onPositionChange({
      x: Math.max(12, Math.min(88, drag.current.px + ((e.clientX-drag.current.x)/host.width)*100)),
      y: Math.max(12, Math.min(88, drag.current.py + ((e.clientY-drag.current.y)/host.height)*100)),
    });
  };
  return <div className="ul-commerce-product-card" style={{left:`${position.x}%`,top:`${position.y}%`}} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={()=>{drag.current=null}} data-ui-id="commerce.live.product-card">
    <div className="ul-commerce-product-art"><CommerceProductArt product={product} fallback={<ShoppingBag/>} /></div>
    <div className="ul-commerce-product-copy"><small>Live Deal</small><strong>{product.title}</strong><span>{formatCommercePrice(product)}</span><em>{salesCount ? `${salesCount} sold` : 'Live now'}</em></div>
    {!isHost ? <button className="ul-commerce-buy" type="button" onPointerDown={e=>e.stopPropagation()} onClick={onBuy}>Buy Now</button> : null}
    {isHost && onUnpin ? <button className="ul-commerce-unpin" type="button" onPointerDown={e=>e.stopPropagation()} onClick={onUnpin} aria-label="Unpin product"><X size={14}/></button> : null}
  </div>
}
