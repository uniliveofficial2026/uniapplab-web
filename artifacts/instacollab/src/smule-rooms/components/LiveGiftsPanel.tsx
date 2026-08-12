import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Flame, Package, Send, Shield } from 'lucide-react';
import {
  giftTierFromStars,
  type GiftEffectTier,
} from '../../lib/live/giftEffectCatalogTypes';
import type { GiftSeason } from '../../lib/live/giftStudioCatalog';
import type { PartyGiftDefinition } from '../utils/roomGifts';
import {
  UniLivesGiftPrice,
  UniLivesGiftThumbnail,
} from '../../components/gifts/brand';
import {
  resolveGiftCanonicalAssetId,
} from '../../lib/unilives-assets/giftResolve';
import { preloadAssets } from '../../lib/unilives-assets/preload';

type TabId = GiftEffectTier | 'all' | 'seasonal' | 'vip';

type LiveGiftsPanelProps = {
  gifts: PartyGiftDefinition[];
  userCoins: number;
  receiverName: string;
  isVip: boolean;
  onToggleVip: () => void;
  onOpenRecharge: () => void;
  onSendGift: (gift: PartyGiftDefinition, quantity: number, isComboSend: boolean) => void;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'normal', label: 'Normal' },
  { id: 'premium', label: 'Premium' },
  { id: 'epic', label: 'Epic' },
  { id: 'legendary', label: 'Legendary' },
  { id: 'mythic', label: 'Mythic' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'vip', label: 'VIP' },
];

const SEASONS: GiftSeason[] = ['Christmas', 'Lunar New Year', 'Valentine', 'Halloween'];

const TIER_ORDER: Record<GiftEffectTier, number> = {
  normal: 1,
  premium: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

export function LiveGiftsPanel({
  gifts,
  userCoins,
  receiverName,
  isVip,
  onToggleVip,
  onOpenRecharge,
  onSendGift,
}: LiveGiftsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [selectedGift, setSelectedGift] = useState<PartyGiftDefinition | null>(gifts[0] ?? null);
  const [sendQuantity, setSendQuantity] = useState(1);
  const [customQuantity, setCustomQuantity] = useState('');
  const [seasonalFilter, setSeasonalFilter] = useState<GiftSeason>('Christmas');
  const [comboCount, setComboCount] = useState(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!selectedGift && gifts[0]) setSelectedGift(gifts[0]);
  }, [gifts, selectedGift]);

  useEffect(() => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    setComboCount(0);
  }, [selectedGift?.id]);

  useEffect(
    () => () => {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    },
    [],
  );

  const sortedGifts = useMemo(() => {
    const filtered = gifts.filter((gift) => {
      const tier = gift.tier ?? giftTierFromStars(gift.stars);
      if (activeTab === 'all') return !gift.isSeasonal && !gift.isVipExclusive;
      if (activeTab === 'seasonal') return Boolean(gift.isSeasonal) && gift.season === seasonalFilter;
      if (activeTab === 'vip') return Boolean(gift.isVipExclusive);
      return tier === activeTab && !gift.isSeasonal && !gift.isVipExclusive;
    });
    return [...filtered].sort((a, b) => {
      const tierA = a.tier ?? giftTierFromStars(a.stars);
      const tierB = b.tier ?? giftTierFromStars(b.stars);
      if (tierA !== tierB) return TIER_ORDER[tierA] - TIER_ORDER[tierB];
      return a.stars - b.stars;
    });
  }, [activeTab, gifts, seasonalFilter]);

  /** Preload only visible tray thumbnails (canonical IDs) — never every SVGA. */
  useEffect(() => {
    const ids = sortedGifts
      .slice(0, 24)
      .map((gift) => resolveGiftCanonicalAssetId(gift.id))
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return undefined;
    void preloadAssets(ids);
    return undefined;
  }, [sortedGifts]);

  const selectGiftWithReset = (gift: PartyGiftDefinition) => {
    setSelectedGift(gift);
    setCustomQuantity('');
    setSendQuantity(1);
  };

  const resolveQuantity = () => {
    if (customQuantity) return Math.max(1, Math.min(999, parseInt(customQuantity, 10) || 1));
    return Math.max(1, sendQuantity);
  };

  const handleSendNormal = () => {
    if (!selectedGift) return;
    const quantity = resolveQuantity();
    const total = selectedGift.stars * quantity;
    if (userCoins < total) {
      window.dispatchEvent(
        new CustomEvent('app-toast', { detail: 'Not enough coins — tap Recharge or pick a cheaper gift.' }),
      );
      return;
    }
    onSendGift(selectedGift, quantity, false);
    setComboCount(0);
  };

  const handleComboClick = () => {
    if (!selectedGift) return;
    if (userCoins < selectedGift.stars) {
      window.dispatchEvent(
        new CustomEvent('app-toast', { detail: 'Not enough coins — tap Recharge or pick a cheaper gift.' }),
      );
      return;
    }
    const nextCombo = comboCount + 1;
    setComboCount(nextCombo);
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => {
      onSendGift(selectedGift, nextCombo, true);
      setComboCount(0);
    }, 1200);
  };

  return (
    <div className="flex h-[40vh] max-h-[40vh] min-h-0 w-full flex-col overflow-hidden rounded-t-[24px] rounded-b-none border border-b-0 border-white/10 bg-[#1A1230]/95 p-3 text-white shadow-xl backdrop-blur-xl">
      <div className="mb-2 flex shrink-0 items-center justify-between border-b border-white/5 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-1.5 text-yellow-400">
            <Coins size={16} />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[#B0A6C8]">
              My Wallet · To {receiverName}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-lg font-extrabold text-white">{userCoins.toLocaleString()}</span>
              <span className="text-[10px] font-bold text-yellow-400">COINS</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleVip}
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold transition ${
              isVip
                ? 'border-yellow-300 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black shadow-[0_0_8px_rgba(234,179,8,0.4)]'
                : 'border-transparent bg-[#251B42] text-[#B0A6C8] hover:bg-[#3D3163]'
            }`}
          >
            <Shield size={13} fill={isVip ? 'black' : 'none'} />
            <span>{isVip ? 'VIP On' : 'VIP'}</span>
          </button>
          <button
            type="button"
            onClick={onOpenRecharge}
            className="rounded-xl bg-gradient-to-r from-[#FF2D55] to-[#FF5E81] px-3 py-1 text-xs font-extrabold uppercase text-white shadow-md shadow-[#FF2D55]/30 transition hover:brightness-110 active:scale-95"
          >
            Recharge
          </button>
        </div>
      </div>

      <div className="mb-1.5 flex shrink-0 items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold transition ${
              activeTab === tab.id
                ? 'bg-[#FF2D55] font-extrabold text-white shadow-md'
                : 'bg-[#251B42] text-[#B0A6C8] hover:bg-[#3D3163] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'seasonal' ? (
        <div className="mb-1.5 flex shrink-0 gap-1 rounded-xl border border-white/5 bg-[#140D26]/70 p-1">
          {SEASONS.map((season) => (
            <button
              key={season}
              type="button"
              onClick={() => setSeasonalFilter(season)}
              className={`flex-1 rounded-lg py-0.5 text-[10px] font-bold transition ${
                seasonalFilter === season
                  ? 'bg-[#FF2D55] font-extrabold text-white'
                  : 'text-[#B0A6C8] hover:text-white'
              }`}
            >
              {season === 'Christmas' && '🎄 Xmas'}
              {season === 'Lunar New Year' && '🧧 Lunar'}
              {season === 'Valentine' && '💘 Cupid'}
              {season === 'Halloween' && '🎃 Spooky'}
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        {sortedGifts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-4 text-[#B0A6C8]">
            <Package size={24} className="mb-1 stroke-1" />
            <p className="text-xs">No exclusive items found here.</p>
            {activeTab === 'vip' && !isVip ? (
              <p className="mt-1 text-[10px] font-bold text-yellow-400">Enable VIP to unlock these gifts</p>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {sortedGifts.map((gift) => {
              const isSelected = selectedGift?.id === gift.id;
              const isLockedVip = Boolean(gift.isVipExclusive && !isVip);
              return (
                <button
                  key={gift.id ?? gift.name}
                  type="button"
                  disabled={isLockedVip}
                  onClick={() => selectGiftWithReset(gift)}
                  className={`group relative flex cursor-pointer select-none flex-col items-center rounded-2xl border p-1.5 text-center transition ${
                    isSelected
                      ? 'border-2 border-[#FF2D55] bg-gradient-to-br from-[#2D214F] to-[#1A1230] shadow-[0_0_15px_rgba(255,45,85,0.4)]'
                      : 'border-transparent bg-white/5 hover:border-white/15 hover:bg-white/10'
                  } ${isLockedVip ? 'cursor-not-allowed bg-black/40 opacity-30' : ''}`}
                >
                  {isLockedVip ? (
                    <div className="absolute right-1 top-1 rounded-full border border-yellow-400/30 bg-yellow-400/20 p-0.5 text-yellow-400">
                      <Shield size={8} fill="currentColor" />
                    </div>
                  ) : null}
                  <span className="mb-1 text-2xl drop-shadow transition duration-200 group-hover:scale-110">
                    <UniLivesGiftThumbnail
                      businessGiftId={gift.id}
                      legacyIcon={gift.icon}
                      className="leading-none"
                      imgClassName="h-8 w-8 object-contain"
                      alt=""
                    />
                  </span>
                  <span
                    className={`mb-0.5 w-full truncate text-[9px] font-bold ${
                      isSelected ? 'text-white' : 'text-[#B0A6C8] group-hover:text-white'
                    }`}
                  >
                    {gift.name}
                  </span>
                  <UniLivesGiftPrice amount={gift.stars} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedGift ? (
        <div className="mt-1.5 flex shrink-0 flex-col gap-2 border-t border-white/5 pt-2">
          <div className="flex h-9 items-stretch gap-2">
            <div className="flex flex-1 items-stretch overflow-hidden rounded-xl border border-white/5 bg-[#140D26]/60 px-1">
              <div className="flex items-center">
                {[1, 10, 50, 100].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => {
                      setSendQuantity(qty);
                      setCustomQuantity('');
                    }}
                    className={`my-1 flex h-7 items-center justify-center rounded-lg px-2 text-[11px] font-extrabold transition ${
                      sendQuantity === qty && !customQuantity
                        ? 'bg-[#FF2D55] text-white shadow-sm'
                        : 'text-[#B0A6C8] hover:text-white'
                    }`}
                  >
                    x{qty}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={999}
                value={customQuantity}
                onChange={(event) => {
                  setCustomQuantity(event.target.value);
                  setSendQuantity(1);
                }}
                placeholder="Custom"
                className="ml-1 min-w-0 flex-1 border-l border-white/5 bg-transparent px-2 text-center font-mono text-xs font-bold text-white outline-none placeholder:text-neutral-500"
              />
            </div>

            <button
              type="button"
              onClick={handleComboClick}
              title={comboCount > 0 ? `Combo: ${comboCount}` : 'Combo tap'}
              className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition select-none ${
                comboCount > 0
                  ? 'animate-bounce bg-gradient-to-tr from-[#FF2D55] via-purple-600 to-indigo-500 text-white shadow-[0_0_15px_rgba(255,45,85,0.5)]'
                  : 'bg-[#251B42] text-[#B0A6C8] hover:bg-[#3D3163]'
              }`}
            >
              {comboCount > 0 ? (
                <div className="relative flex h-full w-full items-center justify-center">
                  <Flame size={16} className="animate-pulse" />
                  <span className="absolute -right-1.5 -top-1.5 min-w-[14px] rounded-full border border-[#1A1230] bg-[#FF2D55] px-1 text-center text-[8px] font-black text-white">
                    {comboCount}
                  </span>
                </div>
              ) : (
                <Flame size={16} />
              )}
            </button>

            <button
              type="button"
              onClick={handleSendNormal}
              title={`Send ${customQuantity || sendQuantity}x ${selectedGift.name}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF2D55] text-white shadow-md shadow-[#FF2D55]/30 transition hover:bg-[#ff4066] active:scale-95"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
