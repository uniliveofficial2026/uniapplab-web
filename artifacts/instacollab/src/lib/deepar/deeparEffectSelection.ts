import { getEffectCategoryId } from './deeparConfig';

/** Multi-slot DeepAR selection — one active effect per category (like TRTC trays). */
export type DeepAREffectSelection = {
  lookId: string | null;
  beautyId: string | null;
  maskId: string | null;
  glassesId: string | null;
  backgroundId: string | null;
};

export const EMPTY_DEEPAR_EFFECT_SELECTION: DeepAREffectSelection = {
  lookId: null,
  beautyId: null,
  maskId: null,
  glassesId: null,
  backgroundId: null,
};

export function deeparSelectionActive(selection: DeepAREffectSelection): boolean {
  return Boolean(
    selection.lookId ||
      selection.beautyId ||
      selection.maskId ||
      selection.glassesId ||
      selection.backgroundId,
  );
}

export function selectionKeyForCategory(
  categoryId: string,
): keyof DeepAREffectSelection | null {
  switch (categoryId) {
    case 'makeup':
      return 'lookId';
    case 'beauty':
      return 'beautyId';
    case 'mask':
      return 'maskId';
    case 'glasses':
      return 'glassesId';
    case 'background':
      return 'backgroundId';
    default:
      return null;
  }
}

export function selectedIdForCategory(
  selection: DeepAREffectSelection,
  categoryId: string,
): string | null {
  const key = selectionKeyForCategory(categoryId);
  return key ? selection[key] : null;
}

export function patchDeepARSelection(
  selection: DeepAREffectSelection,
  categoryId: string,
  effectId: string | null,
): DeepAREffectSelection {
  const key = selectionKeyForCategory(categoryId);
  if (!key) return selection;
  return { ...selection, [key]: effectId };
}

/** Primary effect id for legacy single-effect hooks. */
export function resolveDeepARPrimaryEffectId(selection: DeepAREffectSelection): string {
  return (
    selection.lookId ||
    selection.beautyId ||
    selection.maskId ||
    selection.glassesId ||
    selection.backgroundId ||
    'none'
  );
}

export function deeparSelectionFromEffectId(effectId: string): DeepAREffectSelection {
  if (effectId === 'none') return { ...EMPTY_DEEPAR_EFFECT_SELECTION };
  const category = getEffectCategoryId(effectId);
  const key = selectionKeyForCategory(category);
  if (!key) return { ...EMPTY_DEEPAR_EFFECT_SELECTION };
  return { ...EMPTY_DEEPAR_EFFECT_SELECTION, [key]: effectId };
}
