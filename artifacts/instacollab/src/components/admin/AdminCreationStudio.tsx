import React, { useMemo, useRef, useState } from 'react';
import { Gift, Palette, Play, Plus, Save, Sparkles, Trash2, Upload } from 'lucide-react';
import { GiftPlayOverlay } from '../../smule-rooms/components/GiftPlayOverlay';
import type { GiftPlayPayload } from '../../smule-rooms/utils/liveRoomTypes';
import type { GiftEffectTier } from '../../lib/live/giftEffectCatalogTypes';
import { giftTierFromStars, giftTierMeta } from '../../lib/live/giftTiers';
import {
  createEmptyBeautyDraft,
  createEmptyGiftDraft,
  deletePublishedBeauty,
  isBuiltinGiftId,
  listPublishedBeauty,
  listStudioGiftCatalog,
  resetBuiltinGiftOverride,
  upsertPublishedBeauty,
  upsertPublishedGift,
  type PublishedBeautyItem,
  type PublishedGiftItem,
} from '../../lib/adminCatalogStore';
import {
  addCustomBeautyProvider,
  addCustomGiftTier,
  deleteCustomBeautyProvider,
  deleteCustomGiftTier,
  getBeautyProviderOptions,
  getGiftTierOptions,
} from '../../lib/adminStudioStore';
import {
  isGiftSvgaFile,
  isGiftVideoFile,
  uploadGiftEffectAsset,
} from '../../lib/giftAssetUpload';
import { PARTY_GIFT_CATALOG_UPDATED_EVENT } from '../../lib/cloudSocial/platformGiftCatalogCloud';
import { useDB, useDbRevision } from '../../lib/useDB';

type StudioTab = 'gifts' | 'beauty';

export function AdminCreationStudio() {
  const db = useDB();
  useDbRevision();
  const [tab, setTab] = useState<StudioTab>('gifts');
  const [giftDraft, setGiftDraft] = useState<PublishedGiftItem>(() => createEmptyGiftDraft());
  const [beautyDraft, setBeautyDraft] = useState<PublishedBeautyItem>(() => createEmptyBeautyDraft());
  const [previewGift, setPreviewGift] = useState<GiftPlayPayload | null>(null);
  const [newProvider, setNewProvider] = useState('');
  const [newTier, setNewTier] = useState('');
  const [studioTick, setStudioTick] = useState(0);
  const [catalogTick, setCatalogTick] = useState(0);
  const [uploadingKind, setUploadingKind] = useState<'svga' | 'video' | null>(null);

  React.useEffect(() => {
    const onUpdate = () => setCatalogTick((value) => value + 1);
    window.addEventListener(PARTY_GIFT_CATALOG_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(PARTY_GIFT_CATALOG_UPDATED_EVENT, onUpdate);
  }, []);

  const gifts = useMemo(() => {
    void catalogTick;
    return listStudioGiftCatalog();
  }, [db, catalogTick]);
  const beautyItems = useMemo(() => listPublishedBeauty(true), [db]);
  const beautyProviders = useMemo(() => {
    void studioTick;
    return getBeautyProviderOptions();
  }, [studioTick]);
  const giftTiers = useMemo(() => {
    void studioTick;
    return getGiftTierOptions();
  }, [studioTick]);

  const refreshStudioOptions = () => setStudioTick((value) => value + 1);

  const saveGift = (publish: boolean) => {
    upsertPublishedGift({ ...giftDraft, status: publish ? 'published' : 'draft' });
    setCatalogTick((value) => value + 1);
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: publish ? 'Gift published to live rooms' : 'Gift draft saved',
      }),
    );
  };

  const saveBeauty = (publish: boolean) => {
    upsertPublishedBeauty({ ...beautyDraft, status: publish ? 'published' : 'draft' });
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: publish ? 'Beauty preset published' : 'Beauty draft saved',
      }),
    );
  };

  const playGiftPreview = () => {
    setPreviewGift({
      action: 'play',
      playId: `preview-${giftDraft.id}-${Date.now()}`,
      giftId: giftDraft.id,
      giftName: giftDraft.name,
      giftIcon: giftDraft.icon,
      starValue: giftDraft.stars,
      senderName: 'Admin Preview',
      receiverName: 'Host',
      effectVideoUrl: giftDraft.effectVideoUrl,
      effectSvgaUrl: giftDraft.effectSvgaUrl,
    });
  };

  const handleGiftAssetUpload = async (kind: 'svga' | 'video', file: File | null) => {
    if (!file) return;
    if (kind === 'svga' && !isGiftSvgaFile(file)) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Choose an .svga file' }));
      return;
    }
    if (kind === 'video' && !isGiftVideoFile(file)) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Choose an MP4/WebM video' }));
      return;
    }
    setUploadingKind(kind);
    try {
      const url = await uploadGiftEffectAsset(giftDraft.id, file);
      if (!url) {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Upload failed — check storage' }));
        return;
      }
      setGiftDraft((prev) =>
        kind === 'svga'
          ? { ...prev, effectSvgaUrl: url }
          : { ...prev, effectVideoUrl: url },
      );
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: kind === 'svga' ? 'SVGA uploaded — publish to replace in-app gift' : 'Video uploaded',
        }),
      );
    } finally {
      setUploadingKind(null);
    }
  };

  const addProvider = () => {
    const row = addCustomBeautyProvider(newProvider);
    if (row) {
      setBeautyDraft((prev) => ({ ...prev, provider: row.id }));
      setNewProvider('');
      refreshStudioOptions();
    }
  };

  const addTier = () => {
    const row = addCustomGiftTier(newTier);
    if (row) {
      setGiftDraft((prev) => ({ ...prev, tier: row.id as GiftEffectTier }));
      setNewTier('');
      refreshStudioOptions();
    }
  };

  const removeGift = (id: string) => {
    if (isBuiltinGiftId(id)) {
      resetBuiltinGiftOverride(id);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Builtin gift reset to default' }));
    } else {
      resetBuiltinGiftOverride(id);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Gift removed from catalog' }));
    }
    setCatalogTick((value) => value + 1);
    if (giftDraft.id === id) setGiftDraft(createEmptyGiftDraft());
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <StudioTabButton active={tab === 'gifts'} onClick={() => setTab('gifts')} icon={Gift} label="Gift studio" />
        <StudioTabButton active={tab === 'beauty'} onClick={() => setTab('beauty')} icon={Palette} label="Beauty studio" />
      </div>

      {tab === 'gifts' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <div className="space-y-4">
            <EditorShell
              title="Create / edit gift"
              description="In-app gifts appear below — edit & upload SVGA/video to replace effects in live rooms (TRTC/LiveKit style)"
            >
              <GiftEditor
                draft={giftDraft}
                onChange={setGiftDraft}
                tiers={giftTiers}
                uploadingKind={uploadingKind}
                onUpload={handleGiftAssetUpload}
              />
              <StudioOptionManager
                label="Gift tiers"
                placeholder="Add custom tier…"
                value={newTier}
                onChange={setNewTier}
                onAdd={addTier}
                options={giftTiers}
                onDelete={(id) => {
                  deleteCustomGiftTier(id);
                  refreshStudioOptions();
                }}
              />
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" onClick={() => saveGift(false)} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border border-border min-h-[40px]">
                  <Save className="w-3.5 h-3.5" /> Save draft
                </button>
                <button type="button" onClick={() => saveGift(true)} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl bg-primary text-primary-foreground min-h-[40px]">
                  <Sparkles className="w-3.5 h-3.5" /> Publish live
                </button>
                <button type="button" onClick={playGiftPreview} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border border-border min-h-[40px]">
                  <Play className="w-3.5 h-3.5" /> Preview effect
                </button>
                <button type="button" onClick={() => setGiftDraft(createEmptyGiftDraft())} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border border-border min-h-[40px]">
                  <Plus className="w-3.5 h-3.5" /> New
                </button>
              </div>
            </EditorShell>

            <CatalogList
              title="Gift catalog (in-app + published)"
              empty="No gifts yet"
              items={gifts.map((g) => ({
                id: g.id,
                label: `${g.icon} ${g.name}`,
                meta: `${g.stars} coins · ${g.tier} · ${g.status}${isBuiltinGiftId(g.id) ? ' · in-app' : ''}${(g.updatedAt ?? 0) > 0 && isBuiltinGiftId(g.id) ? ' · replaced' : ''}`,
              }))}
              onSelect={(id) => {
                const row = gifts.find((g) => g.id === id);
                if (row) setGiftDraft({ ...row });
              }}
              onDelete={removeGift}
            />
          </div>

          <div className="relative rounded-2xl border border-border bg-black min-h-[360px] overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <GiftPlayOverlay gift={previewGift} onDone={() => setPreviewGift(null)} />
            </div>
            {!previewGift ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground p-6 text-center">
                Tap Preview effect to play SVGA / particle gift in this panel
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <EditorShell title="Create / edit beauty preset" description="TRTC · DeepAR · CSS fallback presets">
            <BeautyEditor draft={beautyDraft} onChange={setBeautyDraft} providers={beautyProviders} />
            <StudioOptionManager
              label="Beauty providers"
              placeholder="Add custom provider…"
              value={newProvider}
              onChange={setNewProvider}
              onAdd={addProvider}
              options={beautyProviders}
              onDelete={(id) => {
                deleteCustomBeautyProvider(id);
                refreshStudioOptions();
              }}
            />
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" onClick={() => saveBeauty(false)} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border border-border min-h-[40px]">
                <Save className="w-3.5 h-3.5" /> Save draft
              </button>
              <button type="button" onClick={() => saveBeauty(true)} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl bg-primary text-primary-foreground min-h-[40px]">
                <Sparkles className="w-3.5 h-3.5" /> Publish live
              </button>
              <button type="button" onClick={() => setBeautyDraft(createEmptyBeautyDraft())} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border border-border min-h-[40px]">
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>
          </EditorShell>

          <div className="space-y-4">
            <CatalogList
              title="Beauty presets"
              empty="No beauty presets yet"
              items={beautyItems.map((b) => ({
                id: b.id,
                label: b.name,
                meta: `${b.provider} · ${b.category} · ${b.status}`,
              }))}
              onSelect={(id) => {
                const row = beautyItems.find((b) => b.id === id);
                if (row) setBeautyDraft(row);
              }}
              onDelete={(id) => deletePublishedBeauty(id)}
            />
            {beautyDraft.previewUrl || beautyDraft.assetUrl ? (
              <div className="rounded-2xl border border-border overflow-hidden aspect-video bg-black/20">
                {beautyDraft.previewUrl?.match(/\.(mp4|webm)/i) ? (
                  <video src={beautyDraft.previewUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                ) : (
                  <img src={beautyDraft.previewUrl ?? beautyDraft.assetUrl} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                Add preview or asset URL to see beauty preset preview
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StudioOptionManager({
  label,
  placeholder,
  value,
  onChange,
  onAdd,
  options,
  onDelete,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  options: Array<{ id: string; label: string; custom?: boolean }>;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/10 p-3 space-y-2">
      <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <span key={option.id} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border border-border bg-background">
            {option.label}
            {option.custom ? (
              <button type="button" onClick={() => onDelete(option.id)} className="text-destructive">
                <Trash2 className="w-3 h-3" />
              </button>
            ) : null}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 border border-border rounded-lg px-3 py-2 bg-background text-xs min-h-[40px]"
        />
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border border-border min-h-[40px] shrink-0">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

function StudioTabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl min-h-[44px] ${
        active ? 'bg-primary text-primary-foreground' : 'border border-border bg-card'
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

function EditorShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
      <div>
        <h3 className="font-bold text-sm">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground mt-0.5">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function GiftEditor({
  draft,
  onChange,
  tiers,
  uploadingKind,
  onUpload,
}: {
  draft: PublishedGiftItem;
  onChange: (v: PublishedGiftItem) => void;
  tiers: Array<{ id: string; label: string }>;
  uploadingKind: 'svga' | 'video' | null;
  onUpload: (kind: 'svga' | 'video', file: File | null) => void;
}) {
  const svgaInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Gift id (stable)" value={draft.id} onChange={(id) => onChange({ ...draft, id })} mono />
      <Field label="Name" value={draft.name} onChange={(name) => onChange({ ...draft, name })} />
      <Field label="Icon (emoji)" value={draft.icon} onChange={(icon) => onChange({ ...draft, icon })} />
      <Field
        label="Coin"
        value={String(draft.stars)}
        onChange={(v) => {
          const stars = Math.max(1, Number(v) || 1);
          onChange({ ...draft, stars, tier: giftTierFromStars(stars) });
        }}
      />
      <label className="block text-xs">
        <span className="font-bold text-muted-foreground">Tier (from coin value)</span>
        <select
          value={giftTierFromStars(draft.stars)}
          onChange={(e) => {
            const tier = e.target.value as GiftEffectTier;
            const meta = giftTierMeta(tier);
            onChange({
              ...draft,
              tier,
              stars: Math.max(draft.stars, meta.minStars),
            });
          }}
          className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background min-h-[40px]"
        >
          {tiers.map((tier) => (
            <option key={tier.id} value={tier.id}>
              {tier.label}
            </option>
          ))}
        </select>
      </label>
      <Field label="Particle color" value={draft.particleColor ?? ''} onChange={(particleColor) => onChange({ ...draft, particleColor })} mono />
      <div className="sm:col-span-2 space-y-2">
        <Field label="SVGA URL" value={draft.effectSvgaUrl ?? ''} onChange={(effectSvgaUrl) => onChange({ ...draft, effectSvgaUrl })} mono />
        <div className="flex flex-wrap gap-2">
          <input
            ref={svgaInputRef}
            type="file"
            accept=".svga,application/octet-stream"
            className="hidden"
            onChange={(e) => {
              onUpload('svga', e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={uploadingKind === 'svga'}
            onClick={() => svgaInputRef.current?.click()}
            className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border border-border min-h-[40px]"
          >
            <Upload className="w-3.5 h-3.5" />
            {uploadingKind === 'svga' ? 'Uploading…' : 'Upload SVGA'}
          </button>
        </div>
      </div>
      <div className="sm:col-span-2 space-y-2">
        <Field label="Video URL" value={draft.effectVideoUrl ?? ''} onChange={(effectVideoUrl) => onChange({ ...draft, effectVideoUrl })} mono />
        <div className="flex flex-wrap gap-2">
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
            className="hidden"
            onChange={(e) => {
              onUpload('video', e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={uploadingKind === 'video'}
            onClick={() => videoInputRef.current?.click()}
            className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border border-border min-h-[40px]"
          >
            <Upload className="w-3.5 h-3.5" />
            {uploadingKind === 'video' ? 'Uploading…' : 'Upload video'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BeautyEditor({
  draft,
  onChange,
  providers,
}: {
  draft: PublishedBeautyItem;
  onChange: (v: PublishedBeautyItem) => void;
  providers: Array<{ id: string; label: string }>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Name" value={draft.name} onChange={(name) => onChange({ ...draft, name })} />
      <label className="block text-xs">
        <span className="font-bold text-muted-foreground">Provider</span>
        <select
          value={draft.provider}
          onChange={(e) => onChange({ ...draft, provider: e.target.value as PublishedBeautyItem['provider'] })}
          className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background min-h-[40px]"
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
      </label>
      <Field label="Category" value={draft.category} onChange={(category) => onChange({ ...draft, category })} />
      <Field label="Preview URL" value={draft.previewUrl ?? ''} onChange={(previewUrl) => onChange({ ...draft, previewUrl })} mono />
      <Field label="Asset URL / SDK path" value={draft.assetUrl ?? ''} onChange={(assetUrl) => onChange({ ...draft, assetUrl })} className="sm:col-span-2" mono />
      <label className="block text-xs sm:col-span-2">
        <span className="font-bold text-muted-foreground">Params JSON (TRTC / DeepAR)</span>
        <textarea
          value={draft.paramsJson ?? ''}
          onChange={(e) => onChange({ ...draft, paramsJson: e.target.value })}
          rows={4}
          className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background font-mono text-[11px]"
          placeholder='{"smooth":0.5,"whiten":0.3}'
        />
      </label>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  mono,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  className?: string;
}) {
  return (
    <label className={`block text-xs ${className}`}>
      <span className="font-bold text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background min-h-[40px] ${mono ? 'font-mono text-[11px]' : ''}`}
      />
    </label>
  );
}

function CatalogList({
  title,
  empty,
  items,
  onSelect,
  onDelete,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; label: string; meta: string }>;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      <h3 className="font-bold text-sm">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">{empty}</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 p-2 rounded-xl border border-border">
            <button type="button" onClick={() => onSelect(item.id)} className="flex-1 text-left min-w-0">
              <div className="text-sm font-bold truncate">{item.label}</div>
              <div className="text-[10px] text-muted-foreground truncate">{item.meta}</div>
            </button>
            <button type="button" onClick={() => onDelete(item.id)} className="p-2 rounded-lg border border-destructive/30 text-destructive shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
