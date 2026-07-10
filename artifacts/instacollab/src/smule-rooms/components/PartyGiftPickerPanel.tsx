import { useMemo, useState } from 'react';
import { Pencil, Trash2, Wrench, X } from 'lucide-react';
import {
  createEmptyGiftDraft,
  deletePublishedGift,
  isBuiltinGiftId,
  listPublishedGifts,
  resetBuiltinGiftOverride,
  upsertPublishedGift,
  type PublishedGiftItem,
} from '../../lib/adminCatalogStore';
import {
  GIFT_TIER_META,
  GIFT_TIER_OPTIONS,
  giftTierFromStars,
  giftTierMeta,
  type GiftEffectTier,
} from '../../lib/live/giftEffectCatalogTypes';
import { CoinIcon } from '../../components/common/CoinIcon';
import { usePartyGiftCatalog } from '../hooks/usePartyGiftCatalog';
import type { PartyGiftDefinition } from '../utils/roomGifts';

type PartyGiftPickerPanelProps = {
  open: boolean;
  onClose: () => void;
  receiverName: string;
  balance: number;
  roomTotalStars: number;
  isPlatformAdmin: boolean;
  onSendGift: (gift: PartyGiftDefinition) => void;
};

function findPublishedGift(gift: PartyGiftDefinition): PublishedGiftItem | null {
  const items = listPublishedGifts(true);
  if (gift.id) {
    return items.find((row) => row.id === gift.id) ?? null;
  }
  return items.find((row) => row.name.toLowerCase() === gift.name.toLowerCase()) ?? null;
}

function giftToDraft(gift: PartyGiftDefinition): PublishedGiftItem {
  const existing = findPublishedGift(gift);
  if (existing) {
    const stars = Math.max(1, Number(existing.stars) || 1);
    return { ...existing, stars, tier: giftTierFromStars(stars) };
  }
  const stableId =
    gift.id?.trim() ||
    gift.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
  const stars = Math.max(1, Number(gift.stars) || 1);
  return {
    ...createEmptyGiftDraft(),
    id: stableId,
    name: gift.name,
    icon: gift.icon,
    stars,
    tier: giftTierFromStars(stars),
    effectVideoUrl: gift.effectVideoUrl,
    effectSvgaUrl: gift.effectSvgaUrl,
    particleColor: gift.particleColor,
    status: 'published',
  };
}

function GiftTierBadge({ tier }: { tier: GiftEffectTier }) {
  const meta = giftTierMeta(tier);
  return (
    <span
      className={`rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide ${meta.badgeClass}`}
    >
      {meta.label}
    </span>
  );
}

export function PartyGiftPickerPanel({
  open,
  onClose,
  receiverName,
  balance,
  roomTotalStars,
  isPlatformAdmin,
  onSendGift,
}: PartyGiftPickerPanelProps) {
  const catalog = usePartyGiftCatalog();
  const [manageMode, setManageMode] = useState(false);
  const [editing, setEditing] = useState<PublishedGiftItem | null>(null);
  const [tierFilter, setTierFilter] = useState<GiftEffectTier | 'all'>('all');

  const sortedCatalog = useMemo(() => {
    const rows = [...catalog]
      .map((gift) => ({
        ...gift,
        tier: giftTierFromStars(gift.stars),
      }))
      .sort((a, b) => a.stars - b.stars);
    if (tierFilter === 'all') return rows;
    return rows.filter((gift) => gift.tier === tierFilter);
  }, [catalog, tierFilter]);

  if (!open) return null;

  const closeEditor = () => setEditing(null);

  const saveGift = (publish: boolean) => {
    if (!editing) return;
    const stars = Math.max(1, Number(editing.stars) || 1);
    upsertPublishedGift({
      ...editing,
      stars,
      tier: giftTierFromStars(stars),
      status: publish ? 'published' : 'draft',
    });
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: publish ? 'Gift updated in live rooms' : 'Gift draft saved',
      }),
    );
    closeEditor();
  };

  const removeGift = () => {
    if (!editing) return;
    if (isBuiltinGiftId(editing.id)) {
      resetBuiltinGiftOverride(editing.id);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Builtin gift reset to default' }));
    } else {
      deletePublishedGift(editing.id);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Gift removed from catalog' }));
    }
    closeEditor();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[190] flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto w-full max-w-sm rounded-[24px] border border-pink-500/30 bg-[#1c1130] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-black text-white">Send Gift</h3>
          <div className="flex items-center gap-1">
            {isPlatformAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setManageMode((value) => !value);
                  closeEditor();
                }}
                className={`flex h-8 items-center gap-1 rounded-full px-2.5 text-[10px] font-bold uppercase tracking-wide transition ${
                  manageMode
                    ? 'bg-pink-500/25 text-pink-200'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
                aria-pressed={manageMode}
              >
                <Wrench size={12} />
                Manage
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close gift panel">
              <X size={18} />
            </button>
          </div>
        </div>

        <p className="mb-2 text-[10px] text-gray-400">
          To: <span className="font-bold text-pink-300">{receiverName}</span>
          {' · '}
          Your balance:{' '}
          <span className="inline-flex items-center gap-1 font-bold text-yellow-300">
            {balance.toLocaleString()}
            <CoinIcon className="h-2.5 w-2.5 shrink-0" />
          </span>
          {' · '}
          Room total:{' '}
          <span className="inline-flex items-center gap-1 font-bold text-yellow-300">
            {roomTotalStars.toLocaleString()}
            <CoinIcon className="h-2.5 w-2.5 shrink-0" />
          </span>
        </p>

        {!editing ? (
          <div className="mb-3 flex gap-1 overflow-x-auto no-scrollbar pb-0.5">
            <button
              type="button"
              onClick={() => setTierFilter('all')}
              className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-wide ${
                tierFilter === 'all'
                  ? 'border-pink-400/50 bg-pink-500/20 text-pink-100'
                  : 'border-white/10 bg-black/20 text-gray-400'
              }`}
            >
              All
            </button>
            {GIFT_TIER_META.map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => setTierFilter(tier.id)}
                className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-wide ${
                  tierFilter === tier.id ? tier.badgeClass : 'border-white/10 bg-black/20 text-gray-400'
                }`}
                title={`${tier.label}: ${tier.minStars.toLocaleString()}${
                  tier.maxStars == null ? '+' : `–${tier.maxStars.toLocaleString()}`
                } · ${tier.animation}`}
              >
                {tier.label}
              </button>
            ))}
          </div>
        ) : null}

        {editing ? (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-pink-300">Edit gift</p>
            <div className="grid grid-cols-[3rem_1fr] gap-2">
              <input
                value={editing.icon}
                onChange={(event) => setEditing({ ...editing, icon: event.target.value })}
                className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-center text-xl"
                aria-label="Gift icon"
              />
              <input
                value={editing.name}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                aria-label="Gift name"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                value={editing.stars}
                onChange={(event) => {
                  const stars = Math.max(1, Number(event.target.value) || 1);
                  setEditing({ ...editing, stars, tier: giftTierFromStars(stars) });
                }}
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                aria-label="Gift coins"
              />
              <select
                value={editing.tier}
                onChange={(event) => {
                  const tier = event.target.value as GiftEffectTier;
                  const meta = giftTierMeta(tier);
                  setEditing({
                    ...editing,
                    tier,
                    stars: Math.max(editing.stars, meta.minStars),
                  });
                }}
                className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm text-white"
                aria-label="Gift tier"
              >
                {GIFT_TIER_OPTIONS.map((tier) => {
                  const meta = giftTierMeta(tier);
                  return (
                    <option key={tier} value={tier}>
                      {meta.label}
                    </option>
                  );
                })}
              </select>
            </div>
            <p className="text-[9px] text-gray-400">
              {giftTierMeta(giftTierFromStars(editing.stars)).label}:{' '}
              {giftTierMeta(giftTierFromStars(editing.stars)).animation}
            </p>
            <input
              value={editing.effectVideoUrl ?? ''}
              onChange={(event) => setEditing({ ...editing, effectVideoUrl: event.target.value || undefined })}
              placeholder="Effect video URL (optional)"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
            />
            <input
              value={editing.effectSvgaUrl ?? ''}
              onChange={(event) => setEditing({ ...editing, effectSvgaUrl: event.target.value || undefined })}
              placeholder="Effect SVGA URL (optional)"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => saveGift(true)}
                className="rounded-full bg-pink-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white"
              >
                Publish
              </button>
              <button
                type="button"
                onClick={() => saveGift(false)}
                className="rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold text-gray-200"
              >
                Save draft
              </button>
              <button
                type="button"
                onClick={removeGift}
                className="ml-auto inline-flex items-center gap-1 rounded-full border border-red-500/30 px-3 py-1.5 text-[10px] font-bold text-red-300"
              >
                <Trash2 size={12} />
                Delete
              </button>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-bold text-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid max-h-[46vh] grid-cols-3 gap-2 overflow-y-auto no-scrollbar pr-0.5">
            {sortedCatalog.map((gift) => {
              const tier = giftTierFromStars(gift.stars);
              return (
                <button
                  key={gift.id ?? gift.name}
                  type="button"
                  onClick={() => {
                    if (manageMode && isPlatformAdmin) {
                      setEditing(giftToDraft(gift));
                      return;
                    }
                    onSendGift({ ...gift, tier });
                  }}
                  className="relative flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-2 transition hover:border-pink-500/40 hover:bg-pink-950/20 active:scale-95"
                >
                  {manageMode && isPlatformAdmin ? (
                    <span className="absolute right-1 top-1 text-pink-300">
                      <Pencil size={10} />
                    </span>
                  ) : null}
                  <GiftTierBadge tier={tier} />
                  <span className="text-2xl">{gift.icon}</span>
                  <span className="text-[9px] font-bold text-gray-200">{gift.name}</span>
                  <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-yellow-300">
                    {gift.stars.toLocaleString()}
                    <CoinIcon className="h-2 w-2 shrink-0" />
                  </span>
                </button>
              );
            })}
            {manageMode && isPlatformAdmin ? (
              <button
                type="button"
                onClick={() => setEditing(createEmptyGiftDraft())}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-pink-500/35 bg-pink-950/10 p-2 text-pink-200"
              >
                <span className="text-xl">+</span>
                <span className="text-[9px] font-bold">New gift</span>
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
