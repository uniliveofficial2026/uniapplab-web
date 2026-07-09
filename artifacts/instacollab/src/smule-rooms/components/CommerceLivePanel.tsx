import { useRef, useState } from 'react';
import { DollarSign, ImagePlus, Plus, ShoppingBag, Users, X } from 'lucide-react';
import { CoinIcon } from '../../components/common/CoinIcon';
import { AppCameraButton } from '../../components/camera/AppCameraButton';
import type {
  CommerceOrder,
  CommercePayload,
  CommercePriceType,
  CommerceProduct,
} from '../utils/liveRoomTypes';
import {
  createCommerceProductId,
  normalizeCommerceProduct,
} from '../utils/liveRoomTypes';
import { CommerceOrderPaymentBadge } from './CommerceOrderPaymentBadge';

type CommerceLivePanelProps = {
  open: boolean;
  isHost: boolean;
  catalog: CommerceProduct[];
  pinnedProductId: string | null;
  salesCount: number;
  orders: CommerceOrder[];
  lastCommerce: CommercePayload | null;
  onClose: () => void;
  onPin: (product: CommerceProduct) => void;
  onUnpin: () => void;
  onCreateProduct: (product: CommerceProduct) => void;
  onSelectOrder: (order: CommerceOrder) => void;
};

function ProductPrice({ product }: { product: CommerceProduct }) {
  const normalized = normalizeCommerceProduct(product);
  if (normalized.priceType === 'cash') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-white/60">
        <DollarSign className="h-3 w-3" />
        {(normalized.priceUsd ?? 0).toFixed(2)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-white/60">
      <CoinIcon className="h-3 w-3" />
      {normalized.priceCoins}
    </span>
  );
}

export function CommerceLivePanel({
  open,
  isHost,
  catalog,
  pinnedProductId,
  salesCount,
  orders,
  lastCommerce,
  onClose,
  onPin,
  onUnpin,
  onCreateProduct,
  onSelectOrder,
}: CommerceLivePanelProps) {
  const [panelTab, setPanelTab] = useState<'shop' | 'orders'>('shop');
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [priceType, setPriceType] = useState<CommercePriceType>('coins');
  const [priceCoins, setPriceCoins] = useState('99');
  const [priceUsd, setPriceUsd] = useState('9.99');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const pinned = catalog.find((product) => product.id === pinnedProductId) ?? null;

  const resetCreateForm = () => {
    setTitle('');
    setPriceType('coins');
    setPriceCoins('99');
    setPriceUsd('9.99');
    setDescription('');
    setImageUrl('');
    setShowCreate(false);
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const product: CommerceProduct =
      priceType === 'cash'
        ? {
            id: createCommerceProductId(),
            title: trimmedTitle,
            priceType: 'cash',
            priceUsd: Math.max(0.01, Number(priceUsd) || 0),
            description: description.trim() || undefined,
            imageUrl: imageUrl.trim() || undefined,
          }
        : {
            id: createCommerceProductId(),
            title: trimmedTitle,
            priceType: 'coins',
            priceCoins: Math.max(1, Math.floor(Number(priceCoins) || 0)),
            description: description.trim() || undefined,
            imageUrl: imageUrl.trim() || undefined,
          };

    onCreateProduct(product);
    resetCreateForm();
  };

  return (
    <div className="absolute inset-x-0 bottom-[calc(5.5rem+var(--app-safe-bottom))] z-[110] px-3">
      <div className="mx-auto max-w-md rounded-2xl border border-amber-400/25 bg-black/85 p-3 shadow-2xl backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-200">
            <ShoppingBag className="h-4 w-4" />
            Live Shop
          </span>
          <div className="flex items-center gap-1">
            {isHost ? (
              <button
                type="button"
                onClick={() => setShowCreate((value) => !value)}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold text-amber-100"
              >
                <Plus className="h-3.5 w-3.5" />
                {showCreate ? 'Cancel' : 'Add product'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-white/70 hover:bg-white/10"
              aria-label="Close shop"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isHost ? (
          <div className="mb-3 flex gap-1 rounded-full bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setPanelTab('shop')}
              className={`flex-1 rounded-full py-1.5 text-[10px] font-bold uppercase tracking-wide ${
                panelTab === 'shop' ? 'bg-amber-500 text-black' : 'text-white/60'
              }`}
            >
              Products
            </button>
            <button
              type="button"
              onClick={() => setPanelTab('orders')}
              className={`flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-[10px] font-bold uppercase tracking-wide ${
                panelTab === 'orders' ? 'bg-emerald-500 text-black' : 'text-white/60'
              }`}
            >
              <Users className="h-3 w-3" />
              Orders ({orders.length})
            </button>
          </div>
        ) : null}

        {panelTab === 'orders' && isHost ? (
          <div className="max-h-[min(42vh,320px)] space-y-2 overflow-y-auto">
            {orders.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-white/50">
                No orders yet. Buyers will appear here with shipping info.
              </p>
            ) : (
              orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => onSelectOrder(order)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5 text-left hover:border-emerald-400/30"
                >
                  <img
                    src={
                      order.productImageUrl ||
                      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=80&h=80&fit=crop'
                    }
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">{order.buyerName}</p>
                    <p className="truncate text-[10px] text-white/60">{order.productTitle}</p>
                    <div className="mt-0.5">
                      <CommerceOrderPaymentBadge order={order} />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <>
            {isHost && showCreate ? (
              <form onSubmit={handleCreate} className="mb-3 space-y-2 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-300">New product</p>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Product name"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/35"
                  maxLength={60}
                  required
                />
                <div className="flex gap-1 rounded-lg bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => setPriceType('coins')}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-[10px] font-bold ${
                      priceType === 'coins' ? 'bg-amber-500 text-black' : 'text-white/60'
                    }`}
                  >
                    <CoinIcon className="h-3 w-3" />
                    Coins
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceType('cash')}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-[10px] font-bold ${
                      priceType === 'cash' ? 'bg-emerald-500 text-black' : 'text-white/60'
                    }`}
                  >
                    <DollarSign className="h-3 w-3" />
                    Real money
                  </button>
                </div>
                {priceType === 'coins' ? (
                  <input
                    value={priceCoins}
                    onChange={(event) => setPriceCoins(event.target.value.replace(/[^\d]/g, ''))}
                    placeholder="Price in coins"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/35"
                    required
                  />
                ) : (
                  <input
                    value={priceUsd}
                    onChange={(event) => setPriceUsd(event.target.value.replace(/[^\d.]/g, ''))}
                    placeholder="Price in USD (e.g. 9.99)"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/35"
                    required
                  />
                )}
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Short description"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/35"
                  maxLength={120}
                />
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                    Product photo
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => imageFileInputRef.current?.click()}
                      className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-amber-400/35 bg-black/40 text-amber-200/80 transition hover:border-amber-400/60 hover:bg-amber-500/10"
                      aria-label={imageUrl ? 'Change product photo' : 'Upload product photo'}
                    >
                      {imageUrl ? (
                        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <ImagePlus className="h-5 w-5" />
                      )}
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => imageFileInputRef.current?.click()}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] font-bold text-white/85 transition hover:bg-white/10"
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        Choose photo
                      </button>
                      <AppCameraButton
                        title="Product photo"
                        label="Camera"
                        onCaptured={(payload) => {
                          if (payload.kind !== 'photo') return;
                          setImageUrl(payload.url);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] font-bold text-white/85 transition hover:bg-white/10"
                        iconClassName="h-3.5 w-3.5"
                      />
                      {imageUrl ? (
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="text-left text-[10px] font-semibold text-white/45 hover:text-red-300"
                        >
                          Remove photo
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <input
                    ref={imageFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                          setImageUrl(reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-full bg-amber-500 py-2 text-xs font-black uppercase tracking-wide text-black"
                >
                  Create & pin to live
                </button>
              </form>
            ) : null}

            {pinned ? (
              <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-300">On stage now</p>
                <p className="font-bold text-white">{pinned.title}</p>
                {pinned.description ? (
                  <p className="text-xs text-white/70">{pinned.description}</p>
                ) : null}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-amber-200">
                    <ProductPrice product={pinned} />
                  </span>
                  <button
                    type="button"
                    onClick={onUnpin}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Unpin
                  </button>
                </div>
              </div>
            ) : (
              <p className="mb-3 text-[11px] text-white/55">
                Create a product or pin one below to show the live buy card.
              </p>
            )}

            <p className="mb-2 text-[10px] text-white/50">
              {salesCount} live sales · {catalog.length} products
            </p>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {catalog.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onPin(product)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-left ${
                    product.id === pinnedProductId
                      ? 'border-amber-400 bg-amber-500/15'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <p className="max-w-[120px] truncate text-xs font-bold text-white">{product.title}</p>
                  <ProductPrice product={product} />
                </button>
              ))}
            </div>

            {lastCommerce?.action === 'purchase' ? (
              <p className="mt-2 text-center text-[11px] text-emerald-300">
                {lastCommerce.order.buyerName} purchased {lastCommerce.order.productTitle}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
