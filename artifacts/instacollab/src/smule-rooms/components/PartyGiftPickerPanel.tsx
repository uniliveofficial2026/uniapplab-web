import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveAppPortalRoot } from '../../lib/appPortalRoot';
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
  GIFT_TIER_OPTIONS,
  giftTierFromStars,
  giftTierMeta,
  type GiftEffectTier,
} from '../../lib/live/giftEffectCatalogTypes';
import { usePartyGiftCatalog } from '../hooks/usePartyGiftCatalog';
import type { PartyGiftDefinition } from '../utils/roomGifts';
import { LiveGiftRechargeModal } from './LiveGiftRechargeModal';
import { LiveGiftsPanel } from './LiveGiftsPanel';
import { GiftIcon } from '../../components/common/GiftIcon';
import { GiftIconMediaPicker } from '../../components/admin/GiftIconMediaPicker';
import { isGiftIconImageFile, uploadGiftEffectAsset } from '../../lib/giftAssetUpload';
import './live-tools-approved-v15.css';

const VIP_SESSION_KEY = 'live_gift_vip_unlocked';

type PartyGiftPickerPanelProps = {
  open: boolean;
  onClose: () => void;
  receiverName: string;
  receiverAvatarUrl?: string;
  balance: number;
  roomTotalStars: number;
  isPlatformAdmin: boolean;
  onSendGift: (gift: PartyGiftDefinition, quantity?: number, isComboSend?: boolean) => void;
  onCycleReceiver?: () => void;
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

function readVipUnlocked(): boolean {
  try {
    return sessionStorage.getItem(VIP_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function resolveLiveSheetPortalRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const visible = (node: HTMLElement | null) => Boolean(node && node.getClientRects().length > 0);
  const embed = document.querySelector<HTMLElement>('.karaoke-smule-room-embed');
  if (visible(embed) && embed) {
    return embed.querySelector<HTMLElement>('[data-live-overlay-host], .room-shell') ?? embed;
  }
  const host = document.querySelector<HTMLElement>('[data-live-overlay-host]');
  if (visible(host) && host) return host;
  return resolveAppPortalRoot();
}

export function PartyGiftPickerPanel({
  open,
  onClose,
  receiverName,
  receiverAvatarUrl,
  balance,
  roomTotalStars: _roomTotalStars,
  isPlatformAdmin,
  onSendGift,
  onCycleReceiver,
}: PartyGiftPickerPanelProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const catalog = usePartyGiftCatalog();
  const [manageMode, setManageMode] = useState(false);
  const [editing, setEditing] = useState<PublishedGiftItem | null>(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [isVip, setIsVip] = useState(readVipUnlocked);
  const [iconUploading, setIconUploading] = useState(false);

  const gifts = useMemo(
    () =>
      catalog.map((gift) => ({
        ...gift,
        tier: gift.tier ?? giftTierFromStars(gift.stars),
      })),
    [catalog],
  );

  useEffect(() => {
    if (!open) return undefined;
    setPortalRoot(resolveLiveSheetPortalRoot());
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setRechargeOpen(false);
    setManageMode(false);
    setEditing(null);
  }, [open]);

  if (!open || !portalRoot) return null;

  const closeEditor = () => setEditing(null);

  const uploadEditingIcon = async (file: File | null) => {
    if (!editing || !file) return;
    if (!isGiftIconImageFile(file)) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Choose a PNG/JPEG/WebP/GIF image' }));
      return;
    }
    setIconUploading(true);
    try {
      const url = await uploadGiftEffectAsset(editing.id, file);
      if (!url) {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Icon upload failed' }));
        return;
      }
      setEditing((prev) => (prev ? { ...prev, icon: url } : prev));
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Icon image uploaded' }));
    } finally {
      setIconUploading(false);
    }
  };

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

  const toggleVip = () => {
    setIsVip((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(VIP_SESSION_KEY, next ? '1' : '0');
      } catch {
        /* private mode */
      }
      return next;
    });
  };

  return createPortal(
    <>
      <div className="lt15-overlay" data-ui-id="live.gifts.v14.exact" style={{ zIndex: 260 }}>
        <button type="button" className="lt15-scrim" aria-label="Close gift panel" onClick={onClose} />
        <div className="lt15-sheet-host">
          {isPlatformAdmin && !manageMode ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 10px 6px' }}>
              <button
                type="button"
                onClick={() => {
                  setManageMode(true);
                  closeEditor();
                }}
                className="lt15-soft-btn"
                style={{ height: 28, fontSize: 10 }}
              >
                <Wrench size={12} /> Manage
              </button>
            </div>
          ) : null}
          {manageMode && isPlatformAdmin ? (
            <div className="lt15-sheet" style={{ borderRadius: '18px 18px 0 0', marginBottom: 0 }}>
              <div className="lt15-head">
                <p className="lt15-title">Manage gifts</p>
                <button type="button" className="lt15-icon-btn" onClick={() => setManageMode(false)} aria-label="Close manage">
                  <X size={16} />
                </button>
              </div>
              {editing ? (
                <div className="space-y-2 rounded-2xl border border-white/10 bg-black/25 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-pink-300">Edit gift</p>
                  <GiftIconMediaPicker
                    value={editing.icon}
                    onChange={(icon) => setEditing({ ...editing, icon })}
                    uploading={iconUploading}
                    onUploadImage={(file) => void uploadEditingIcon(file)}
                  />
                  <input
                    value={editing.name}
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    aria-label="Gift name"
                  />
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
                  <input
                    value={editing.effectSvgaUrl ?? ''}
                    onChange={(event) =>
                      setEditing({ ...editing, effectSvgaUrl: event.target.value || undefined })
                    }
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
                <div className="grid max-h-[46vh] grid-cols-3 gap-2 overflow-y-auto no-scrollbar">
                  {gifts.map((gift) => (
                    <button
                      key={gift.id ?? gift.name}
                      type="button"
                      onClick={() => setEditing(giftToDraft(gift))}
                      className="relative flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-2 transition hover:border-pink-500/40"
                    >
                      <span className="absolute right-1 top-1 text-pink-300">
                        <Pencil size={10} />
                      </span>
                      <span className="text-2xl">
                        <GiftIcon icon={gift.icon} imgClassName="h-8 w-8 object-contain" />
                      </span>
                      <span className="text-[9px] font-bold text-gray-200">{gift.name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditing(createEmptyGiftDraft())}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-pink-500/35 bg-pink-950/10 p-2 text-pink-200"
                  >
                    <span className="text-xl">+</span>
                    <span className="text-[9px] font-bold">New gift</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <LiveGiftsPanel
              gifts={gifts}
              userCoins={balance}
              receiverName={receiverName}
              receiverAvatarUrl={receiverAvatarUrl}
              isVip={isVip}
              onToggleVip={toggleVip}
              onOpenRecharge={() => setRechargeOpen(true)}
              onSendGift={(gift, quantity, isComboSend) => onSendGift(gift, quantity, isComboSend)}
              onClose={onClose}
              onCycleReceiver={onCycleReceiver}
            />
          )}
        </div>
      </div>

      <LiveGiftRechargeModal
        open={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
        zIndexClass="z-[270]"
        onCredited={() => {
          window.dispatchEvent(
            new CustomEvent('app-toast', { detail: 'Coins added to your wallet' }),
          );
        }}
      />
    </>,
    portalRoot,
  );
}
