import { db } from './db/localDb';

export type StudioBeautyProviderOption = {
  id: string;
  label: string;
  custom?: boolean;
};

export type StudioGiftTierOption = {
  id: string;
  label: string;
  custom?: boolean;
};

const BEAUTY_PROVIDERS_KEY = 'admin_studio_beauty_providers';
const GIFT_TIERS_KEY = 'admin_studio_gift_tiers';

const BUILTIN_BEAUTY_PROVIDERS: StudioBeautyProviderOption[] = [
  { id: 'trtc', label: 'TRTC WebAR' },
  { id: 'deepar', label: 'DeepAR' },
  { id: 'css', label: 'CSS fallback' },
];

const BUILTIN_GIFT_TIERS: StudioGiftTierOption[] = [
  { id: 'combo', label: 'combo' },
  { id: 'standard', label: 'standard' },
  { id: 'fullscreen', label: 'fullscreen' },
];

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export function listCustomBeautyProviders(): StudioBeautyProviderOption[] {
  return db.load<StudioBeautyProviderOption[]>(BEAUTY_PROVIDERS_KEY, []);
}

export function listCustomGiftTiers(): StudioGiftTierOption[] {
  return db.load<StudioGiftTierOption[]>(GIFT_TIERS_KEY, []);
}

export function getBeautyProviderOptions(): StudioBeautyProviderOption[] {
  return [...BUILTIN_BEAUTY_PROVIDERS, ...listCustomBeautyProviders()];
}

export function getGiftTierOptions(): StudioGiftTierOption[] {
  return [...BUILTIN_GIFT_TIERS, ...listCustomGiftTiers()];
}

export function addCustomBeautyProvider(label: string): StudioBeautyProviderOption {
  const trimmed = label.trim();
  const id = slugify(trimmed) || `provider-${Date.now()}`;
  const row: StudioBeautyProviderOption = { id, label: trimmed || id, custom: true };
  const items = listCustomBeautyProviders().filter((item) => item.id !== id);
  items.unshift(row);
  db.save(BEAUTY_PROVIDERS_KEY, items);
  db.addAuditLog?.({ id: Date.now(), text: `Beauty provider added: ${row.label}`, time: 'Just now' });
  return row;
}

export function deleteCustomBeautyProvider(id: string): void {
  db.save(BEAUTY_PROVIDERS_KEY, listCustomBeautyProviders().filter((item) => item.id !== id));
}

export function addCustomGiftTier(label: string): StudioGiftTierOption {
  const trimmed = label.trim();
  const id = slugify(trimmed) || `tier-${Date.now()}`;
  const row: StudioGiftTierOption = { id, label: trimmed || id, custom: true };
  const items = listCustomGiftTiers().filter((item) => item.id !== id);
  items.unshift(row);
  db.save(GIFT_TIERS_KEY, items);
  db.addAuditLog?.({ id: Date.now(), text: `Gift tier added: ${row.label}`, time: 'Just now' });
  return row;
}

export function deleteCustomGiftTier(id: string): void {
  db.save(GIFT_TIERS_KEY, listCustomGiftTiers().filter((item) => item.id !== id));
}
