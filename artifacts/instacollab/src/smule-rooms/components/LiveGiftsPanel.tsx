import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Coins,
  Crown,
  Flame,
  Gift,
  Heart,
  PartyPopper,
  Send,
  ShoppingBag,
  Smile,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import type { PartyGiftDefinition } from '../utils/roomGifts';
import { resolveGiftCanonicalAssetId } from '../../lib/unilives-assets/giftResolve';
import { preloadAssets } from '../../lib/unilives-assets/preload';
import { buildV14GiftCards, type V14GiftCard } from './liveToolsV14Artwork';
import { safeAvatarUrl } from '../../lib/safe';
import { V14AnimatedGiftArtwork } from './V14AnimatedArtwork';
import './live-tools-approved-v15.css';

type CategoryChip =
  | 'all'
  | 'lucky'
  | 'popular'
  | 'love'
  | 'luxury'
  | 'fun'
  | 'vip'
  | 'festival';
type SortMode = 'default' | 'price-asc' | 'price-desc';

type LiveGiftsPanelProps = {
  gifts: PartyGiftDefinition[];
  userCoins: number;
  receiverName: string;
  receiverAvatarUrl?: string;
  isVip: boolean;
  onToggleVip: () => void;
  onOpenRecharge: () => void;
  onSendGift: (gift: PartyGiftDefinition, quantity: number, isComboSend: boolean) => void;
  onClose?: () => void;
  onCycleReceiver?: () => void;
};

const CATEGORY_CHIPS: Array<{ id: CategoryChip; label: string; icon: typeof Gift }> = [
  { id: 'all', label: 'All Gifts', icon: Gift },
  { id: 'lucky', label: 'Lucky', icon: Sparkles },
  { id: 'popular', label: 'Popular', icon: Flame },
  { id: 'love', label: 'Love', icon: Heart },
  { id: 'luxury', label: 'Luxury', icon: Crown },
  { id: 'fun', label: 'Fun', icon: Smile },
  { id: 'vip', label: 'VIP', icon: Sparkles },
  { id: 'festival', label: 'Festival', icon: PartyPopper },
];

function cardMatchesCategory(card: V14GiftCard, chip: CategoryChip, isVip: boolean): boolean {
  const name = card.name.toLowerCase();
  switch (chip) {
    case 'all':
      return true;
    case 'lucky':
      return /lucky|fortune|egg|wheel|clover|bill/.test(name);
    case 'popular':
      return card.badge === 'HOT' || card.badge === 'NEW' || /box|chest|wheel|whale/.test(name);
    case 'love':
      return /love|kiss|heart|airplane/.test(name);
    case 'luxury':
      return /castle|carriage|whale|phoenix|diamond/.test(name);
    case 'fun':
      return /mystery|surprise|box/.test(name);
    case 'vip':
      return isVip && (Boolean(card.gift?.isVipExclusive) || card.price >= 1200);
    case 'festival':
      return Boolean(card.gift?.isSeasonal) || /phoenix|surprise|castle/.test(name);
    default:
      return true;
  }
}

export function LiveGiftsPanel({
  gifts,
  userCoins,
  receiverName,
  receiverAvatarUrl,
  isVip,
  onToggleVip,
  onOpenRecharge,
  onSendGift,
  onClose,
  onCycleReceiver,
}: LiveGiftsPanelProps) {
  const [categoryChip, setCategoryChip] = useState<CategoryChip>('all');
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receiverAvatar = safeAvatarUrl(receiverAvatarUrl || '');

  const cards = useMemo(() => buildV14GiftCards(gifts), [gifts]);

  const visible = useMemo(() => {
    const filtered = cards.filter((card) => cardMatchesCategory(card, categoryChip, isVip));
    if (sortMode === 'default') return filtered;
    return [...filtered].sort((a, b) => {
      const priceA = a.gift?.stars ?? a.price;
      const priceB = b.gift?.stars ?? b.price;
      return sortMode === 'price-asc' ? priceA - priceB : priceB - priceA;
    });
  }, [cards, categoryChip, isVip, sortMode]);

  const selected = visible.find((card) => card.assetId === selectedAssetId) ?? visible[0] ?? null;

  useEffect(() => {
    const ids = visible
      .slice(0, 24)
      .map((card) => (card.gift?.id ? resolveGiftCanonicalAssetId(card.gift.id) : null))
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return undefined;
    // Bounded thumbnail warmup — never every SVGA in the catalog.
    void preloadAssets(ids);
    return undefined;
  }, [visible]);

  useEffect(() => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    setQuantity(1);
  }, [selected?.assetId]);

  useEffect(
    () => () => {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    },
    [],
  );

  const send = () => {
    if (!selected?.gift) {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: `${selected?.name || 'Gift'} is not mapped to a real gift ID yet.`,
        }),
      );
      return;
    }
    const total = selected.gift.stars * quantity;
    if (userCoins < total) {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: 'Not enough coins — tap Recharge or pick a cheaper gift.',
        }),
      );
      return;
    }
    onSendGift(selected.gift, quantity, quantity > 1);
  };

  const priceLabel = (card: V14GiftCard) => {
    if (card.displayPrice) return card.displayPrice;
    return (card.gift?.stars ?? card.price).toLocaleString();
  };

  return (
    <section className="lt15-sheet lt15-gifts" aria-label="Gifts" data-ui-id="live.gifts.v14.exact">
      <div className="lt15-handle" />
      <div className="lt15-head">
        <div className="lt15-coins">
          <Coins size={29} aria-hidden />
          <span>My Coins</span>
          <strong>{userCoins.toLocaleString()}</strong>
        </div>
        <div className="lt15-head-actions">
          <button type="button" className="lt15-recharge" onClick={onOpenRecharge}>
            <ShoppingBag size={15} aria-hidden /> Recharge
          </button>
          {onClose ? (
            <button type="button" className="lt15-icon-btn" onClick={onClose} aria-label="Close">
              <X size={17} />
            </button>
          ) : null}
        </div>
      </div>
      <div className="lt15-chip-row" role="tablist" aria-label="Gift categories">
        {CATEGORY_CHIPS.map((chip) => {
          const ChipIcon = chip.icon;
          return (
            <button
              type="button"
              key={chip.id}
              className={`lt15-chip ${categoryChip === chip.id ? 'active' : ''}`}
              onClick={() => {
                if (chip.id === 'vip' && !isVip) onToggleVip();
                setCategoryChip(chip.id);
              }}
            >
              <ChipIcon size={14} aria-hidden /> {chip.label}
            </button>
          );
        })}
      </div>
      <div className="lt15-gift-filters">
        <select
          className="lt15-select"
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as SortMode)}
          aria-label="Sort gifts"
        >
          <option value="default">Default</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
        </select>
      </div>
      <div className="lt15-grid-gifts">
        {visible.map((card) => {
          const mapped = Boolean(card.gift);
          return (
            <button
              key={card.assetId}
              type="button"
              className={`lt15-gift-card ${selected?.assetId === card.assetId ? 'selected' : ''} ${mapped ? '' : 'is-unmapped'}`}
              onClick={() => setSelectedAssetId(card.assetId)}
              aria-pressed={selected?.assetId === card.assetId}
            >
              {card.badge ? <span className="lt15-badge">{card.badge}</span> : null}
              <img src={card.artwork} alt="" />
              <div className="lt15-gift-name">{card.name}</div>
              <div className="lt15-price"><Coins size={10} aria-hidden /> {priceLabel(card)}</div>
            </button>
          );
        })}
      </div>
      <div className="lt15-footer lt15-gift-footer">
        <div
          className="lt15-recipient"
          role={onCycleReceiver ? 'button' : undefined}
          tabIndex={onCycleReceiver ? 0 : undefined}
          onClick={onCycleReceiver}
          onKeyDown={(event) => {
            if (!onCycleReceiver || (event.key !== 'Enter' && event.key !== ' ')) return;
            event.preventDefault();
            onCycleReceiver();
          }}
        >
          <div className="lt15-recipient-avatar">
            {receiverAvatar ? <img src={receiverAvatar} alt="" /> : <User size={20} aria-hidden />}
          </div>
          <div>
            <small>Send to</small>
            <b>
              {receiverName || 'Host'} {isVip ? <span className="lt15-vip">VIP</span> : null}
            </b>
          </div>
          <span>›</span>
        </div>
        <div className="lt15-qty">
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
            −
          </button>
          <span>{quantity}</span>
          <button type="button" onClick={() => setQuantity((q) => Math.min(999, q + 1))} aria-label="Increase quantity">
            +
          </button>
        </div>
        <label className="lt15-anon" title="Anonymous send is not supported by the gift settlement API.">
          <input type="checkbox" disabled />
          Anonymous
        </label>
        <div className="lt15-selected-gift">
          {selected ? (
            <V14AnimatedGiftArtwork
              giftId={selected.giftId}
              giftName={selected.name}
              src={selected.artwork}
              className="h-8 w-9"
              imgClassName="h-full w-full object-contain"
              playKey={selected.assetId}
            />
          ) : null}
          <span><b>{selected?.name ?? 'Gift'}</b><small>{selected ? `${priceLabel(selected)} Coins` : ''}</small></span>
        </div>
        <button type="button" className="lt15-primary" onClick={send} disabled={!selected?.gift}>
          <Send size={18} aria-hidden /> Send Gift
        </button>
      </div>
      <p className="lt15-tip">Tips: The sender may get 0x, 2x, 5x or 100x rewards. Good luck!</p>
    </section>
  );
}
