import { useEffect, useRef, useMemo, useState } from 'react';
import {
  Boxes,
  Filter,
  ImagePlus,
  PackageCheck,
  Pin,
  Plus,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import {
  createCommerceProductId,
  formatCommerceOrderPrice,
  formatCommercePrice,
  type CommerceOrder,
  type CommercePayload,
  type CommerceProduct,
} from '../utils/liveRoomTypes';
import { CommerceProductArt } from './CommerceProductArt';
import './commerce-live-approved.css';
import './commerce-live-panel-approved.css';

export type CommerceLivePanelProps = {
  open: boolean;
  isHost: boolean;
  catalog: CommerceProduct[];
  pinnedProductId: string | null;
  salesCount: number;
  orders: CommerceOrder[];
  lastCommerce?: CommercePayload | null;
  onClose: () => void;
  onPin?: (product: CommerceProduct) => void;
  onUnpin?: () => void;
  onCreateProduct?: (product: CommerceProduct) => void;
  onSelectOrder?: (order: CommerceOrder) => void;
  onPurchase?: (product: CommerceProduct) => void;
};

type CommerceTab = 'products' | 'inventory' | 'orders';
type DraftMediaKind = 'image' | 'video' | null;

const PRODUCT_MEDIA_ACCEPT = 'image/*,video/*';
const PRODUCT_MEDIA_MAX_BYTES = 25 * 1024 * 1024;

function isBlobUrl(url: string | undefined): boolean {
  return Boolean(url && url.startsWith('blob:'));
}

export function CommerceLivePanel({
  open,
  isHost,
  catalog,
  pinnedProductId,
  salesCount,
  orders,
  lastCommerce = null,
  onClose,
  onPin,
  onUnpin,
  onCreateProduct,
  onSelectOrder,
  onPurchase,
}: CommerceLivePanelProps) {
  const [tab, setTab] = useState<CommerceTab>('products');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftPrice, setDraftPrice] = useState('');
  const [draftPriceType, setDraftPriceType] = useState<'cash' | 'coins'>('cash');
  const [draftInventory, setDraftInventory] = useState('');
  const [draftImageUrl, setDraftImageUrl] = useState('');
  const [draftVideoUrl, setDraftVideoUrl] = useState('');
  const [draftMediaKind, setDraftMediaKind] = useState<DraftMediaKind>(null);
  const [draftMediaName, setDraftMediaName] = useState('');
  const [draftMediaError, setDraftMediaError] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const localBlobRef = useRef<string | null>(null);

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((order) =>
      `${order.buyerName} ${order.productTitle} ${order.id}`.toLowerCase().includes(needle),
    );
  }, [orders, query]);

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return catalog;
    return catalog.filter((product) =>
      `${product.title} ${product.description ?? ''} ${product.sku ?? ''}`.toLowerCase().includes(needle),
    );
  }, [catalog, query]);

  useEffect(() => {
    return () => {
      if (localBlobRef.current) {
        URL.revokeObjectURL(localBlobRef.current);
        localBlobRef.current = null;
      }
    };
  }, []);

  if (!open) return null;

  const clearLocalMedia = () => {
    if (localBlobRef.current) {
      URL.revokeObjectURL(localBlobRef.current);
      localBlobRef.current = null;
    }
    setDraftImageUrl('');
    setDraftVideoUrl('');
    setDraftMediaKind(null);
    setDraftMediaName('');
    setDraftMediaError(null);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const resetCreateForm = () => {
    setDraftTitle('');
    setDraftPrice('');
    setDraftInventory('');
    setDraftPriceType('cash');
    clearLocalMedia();
    setCreating(false);
  };

  const applyRemoteMediaUrl = (value: string) => {
    const next = value.trim();
    if (localBlobRef.current) {
      URL.revokeObjectURL(localBlobRef.current);
      localBlobRef.current = null;
    }
    setDraftMediaName('');
    setDraftMediaError(null);
    if (!next) {
      setDraftImageUrl('');
      setDraftVideoUrl('');
      setDraftMediaKind(null);
      return;
    }
    const looksVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(next) || next.includes('video');
    if (looksVideo) {
      setDraftVideoUrl(next);
      setDraftImageUrl('');
      setDraftMediaKind('video');
    } else {
      setDraftImageUrl(next);
      setDraftVideoUrl('');
      setDraftMediaKind('image');
    }
  };

  const handleMediaPick = (file: File | undefined) => {
    if (!file) return;
    setDraftMediaError(null);
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setDraftMediaError('Choose a photo or video file.');
      return;
    }
    if (file.size > PRODUCT_MEDIA_MAX_BYTES) {
      setDraftMediaError('Media must be 25 MB or smaller.');
      return;
    }
    if (localBlobRef.current) {
      URL.revokeObjectURL(localBlobRef.current);
      localBlobRef.current = null;
    }
    const objectUrl = URL.createObjectURL(file);
    localBlobRef.current = objectUrl;
    setDraftMediaName(file.name);
    if (file.type.startsWith('video/')) {
      setDraftVideoUrl(objectUrl);
      setDraftImageUrl('');
      setDraftMediaKind('video');
    } else {
      setDraftImageUrl(objectUrl);
      setDraftVideoUrl('');
      setDraftMediaKind('image');
    }
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const submitProduct = () => {
    const title = draftTitle.trim();
    const priceValue = Number(draftPrice);
    if (!title || !Number.isFinite(priceValue) || priceValue < 0 || !onCreateProduct) return;
    const inventoryValue = Number(draftInventory);
    const imageUrl = draftImageUrl.trim() || undefined;
    const videoUrl = draftVideoUrl.trim() || undefined;
    onCreateProduct({
      id: createCommerceProductId(),
      title,
      priceType: draftPriceType,
      ...(draftPriceType === 'cash'
        ? { priceUsd: Number(priceValue.toFixed(2)) }
        : { priceCoins: Math.round(priceValue) }),
      inventory: Number.isFinite(inventoryValue) && inventoryValue >= 0 ? inventoryValue : undefined,
      imageUrl,
      videoUrl,
    });
    // Keep blob alive for catalog preview; stop tracking so unmount cleanup won't revoke it.
    localBlobRef.current = null;
    resetCreateForm();
  };

  const activeTab = isHost ? tab : 'products';
  const previewProduct = {
    imageUrl: draftImageUrl.trim() || undefined,
    videoUrl: draftVideoUrl.trim() || undefined,
  };
  const hasPreview = Boolean(previewProduct.imageUrl || previewProduct.videoUrl);
  const remoteUrlValue =
    draftMediaKind === 'video'
      ? (isBlobUrl(draftVideoUrl) ? '' : draftVideoUrl)
      : (isBlobUrl(draftImageUrl) ? '' : draftImageUrl);

  return (
    <div
      className={`ul-commerce-host-panel ${isHost ? 'is-host' : 'is-viewer'}`}
      data-ui-id={isHost ? 'commerce.host.panel' : 'commerce.viewer.panel'}
      role="dialog"
      aria-modal="true"
      aria-label={isHost ? 'Shop Live management' : 'Shop Live products'}
    >
      <div className="ul-commerce-panel-handle" />
      <header>
        <div>
          <ShoppingBag aria-hidden="true" />
          <span>
            <strong>{isHost ? 'Shop Live' : 'Products in this Live'}</strong>
            <small>{isHost ? 'Showcase, inventory and orders' : 'Purchase without leaving the stream'}</small>
          </span>
          <b className="live-dot">LIVE</b>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Shop Live"><X /></button>
      </header>

      {isHost ? (
        <div className="ul-commerce-host-tabs" role="tablist" aria-label="Shop Live sections">
          <button type="button" className={activeTab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Products</button>
          <button type="button" className={activeTab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')}>Inventory</button>
          <button type="button" className={activeTab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Orders <b>{orders.length}</b></button>
        </div>
      ) : null}

      <div className="ul-commerce-panel-stats">
        <span>Sales <b>{salesCount.toLocaleString()}</b></span>
        <span>Products <b>{catalog.length.toLocaleString()}</b></span>
        {isHost ? <span>Orders <b>{orders.length.toLocaleString()}</b></span> : null}
      </div>

      {activeTab !== 'orders' ? (
        <div className="ul-commerce-search">
          <Search aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" aria-label="Search products" />
          <Filter aria-hidden="true" />
        </div>
      ) : null}

      {activeTab === 'products' ? (
        <>
          <div className="ul-commerce-product-list">
            {filteredProducts.map((product) => (
              <article key={product.id}>
                <div>
                  <CommerceProductArt product={product} fallback={<ShoppingBag aria-hidden="true" />} />
                </div>
                <p>
                  <strong>{product.title}</strong>
                  <span>{formatCommercePrice(product)}</span>
                  {typeof product.inventory === 'number' ? <small>{product.inventory} in stock</small> : null}
                </p>
                {isHost ? (
                  product.id === pinnedProductId ? (
                    <button type="button" className="active" onClick={onUnpin} disabled={!onUnpin}><Pin />Pinned</button>
                  ) : (
                    <button type="button" onClick={() => onPin?.(product)} disabled={!onPin}><Pin />Show</button>
                  )
                ) : (
                  <button type="button" className="ul-commerce-viewer-buy" onClick={() => onPurchase?.(product)} disabled={!onPurchase || product.inventory === 0}>
                    {product.inventory === 0 ? 'Sold out' : 'Buy'}
                  </button>
                )}
              </article>
            ))}
            {!filteredProducts.length ? <div className="ul-commerce-empty"><ShoppingBag /><p>No products available</p></div> : null}
          </div>

          {isHost && onCreateProduct ? (
            creating ? (
              <div className="ul-commerce-create-product">
                <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Product title" aria-label="Product title" />
                <div className="ul-commerce-price-type" role="group" aria-label="Price type">
                  <button type="button" className={draftPriceType === 'cash' ? 'active' : ''} onClick={() => setDraftPriceType('cash')}>USD $</button>
                  <button type="button" className={draftPriceType === 'coins' ? 'active' : ''} onClick={() => setDraftPriceType('coins')}>UniCoins</button>
                </div>
                <input
                  value={draftPrice}
                  onChange={(event) => setDraftPrice(event.target.value)}
                  inputMode="decimal"
                  placeholder={draftPriceType === 'cash' ? 'Price in USD (e.g. 29.99)' : 'Price in UniCoins'}
                  aria-label={draftPriceType === 'cash' ? 'Price in USD' : 'Price in UniCoins'}
                />
                <div className="ul-commerce-media-picker" data-ui-id="commerce.create.media">
                  <div className={`ul-commerce-media-preview ${hasPreview ? 'has-media' : ''}`} aria-live="polite">
                    {hasPreview ? (
                      <CommerceProductArt product={previewProduct} />
                    ) : (
                      <span>
                        <ImagePlus aria-hidden="true" />
                        <small>Photo or video</small>
                      </span>
                    )}
                    {draftMediaKind === 'video' ? <b className="ul-commerce-media-badge">Video</b> : null}
                    {draftMediaKind === 'image' && hasPreview ? <b className="ul-commerce-media-badge">Photo</b> : null}
                  </div>
                  <div className="ul-commerce-media-actions">
                    <input
                      ref={mediaInputRef}
                      type="file"
                      accept={PRODUCT_MEDIA_ACCEPT}
                      hidden
                      onChange={(event) => handleMediaPick(event.target.files?.[0])}
                    />
                    <button type="button" onClick={() => mediaInputRef.current?.click()}>
                      <ImagePlus aria-hidden="true" /> Pick photo / video
                    </button>
                    {hasPreview ? (
                      <button type="button" className="ul-commerce-media-clear" onClick={clearLocalMedia}>
                        Clear media
                      </button>
                    ) : null}
                    {draftMediaName ? <small>{draftMediaName}</small> : null}
                    {draftMediaError ? <small className="ul-commerce-media-error">{draftMediaError}</small> : null}
                  </div>
                </div>
                <input
                  value={remoteUrlValue}
                  onChange={(event) => applyRemoteMediaUrl(event.target.value)}
                  placeholder="Or paste photo/video URL (optional)"
                  aria-label="Product media URL"
                />
                <input value={draftInventory} onChange={(event) => setDraftInventory(event.target.value)} inputMode="numeric" placeholder="Inventory (optional)" aria-label="Inventory" />
                <div>
                  <button type="button" onClick={resetCreateForm}>Cancel</button>
                  <button type="button" className="ul-commerce-primary" onClick={submitProduct}>Create Product</button>
                </div>
              </div>
            ) : (
              <button type="button" className="ul-commerce-secondary" onClick={() => setCreating(true)}><Plus /> Add Product</button>
            )
          ) : null}
        </>
      ) : null}

      {activeTab === 'inventory' ? (
        <div className="ul-commerce-inventory-list">
          {catalog.map((product) => (
            <article key={product.id}>
              <Boxes aria-hidden="true" />
              <span><strong>{product.title}</strong><small>{product.sku || product.id}</small></span>
              <b>{typeof product.inventory === 'number' ? product.inventory : 'Not tracked'}</b>
            </article>
          ))}
          {!catalog.length ? <div className="ul-commerce-empty"><Boxes /><p>No inventory yet</p></div> : null}
        </div>
      ) : null}

      {activeTab === 'orders' ? (
        <>
          <div className="ul-commerce-search">
            <Search aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by order ID or buyer" aria-label="Search orders" />
            <Filter aria-hidden="true" />
          </div>
          <div className="ul-commerce-order-list">
            {filteredOrders.map((order) => (
              <button key={order.id} type="button" onClick={() => onSelectOrder?.(order)} disabled={!onSelectOrder}>
                <span>#{order.id}<small>{order.buyerName}</small></span>
                <span>{order.productTitle}<small>{order.quantity ?? 1} item</small></span>
                <b>{formatCommerceOrderPrice(order)}<small className={`status ${order.status ?? (order.paid ? 'confirmed' : 'pending')}`}>{order.status ?? (order.paid ? 'confirmed' : 'pending')}</small></b>
              </button>
            ))}
            {!filteredOrders.length ? <div className="ul-commerce-empty"><PackageCheck /><p>No orders yet</p></div> : null}
          </div>
        </>
      ) : null}

      {lastCommerce ? <small className="ul-commerce-last-event" aria-live="polite">Live shop updated: {lastCommerce.action.replace('_', ' ')}</small> : null}
    </div>
  );
}
