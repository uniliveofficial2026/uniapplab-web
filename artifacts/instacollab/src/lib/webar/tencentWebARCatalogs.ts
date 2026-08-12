/**
 * TRTC / Tencent WebAR effect catalog fetch + shared persistence helpers.
 */
import {
  getSharedTencentWebARCovers,
  getSharedTencentWebAREffectCatalogs,
  markSharedTencentWebARCatalogsLoaded,
  setSharedTencentWebARCovers,
  setSharedTencentWebAREffectCatalogs,
  sharedCatalogsLoaded,
} from './tencentWebARPool';
import {
  buildBeautyCoverMap,
  buildShapeCoverMap,
  buildShapeEffectMap,
} from './trtcBeautyCatalog';
import type { TencentEffectItem, TencentWebARInstance } from './webarTypes';

function mapEffectRows(
  rows: Array<{
    Name?: string;
    EffectId?: string;
    CoverUrl?: string;
    Url?: string;
    Label?: string;
    PresetType?: string;
  }>,
): TencentEffectItem[] {
  return rows
    .map((item) => ({
      id: String(item.EffectId || item.Url || ''),
      name: String(item.Name || 'Effect'),
      cover: String(item.CoverUrl || ''),
      url: item.Url ? String(item.Url) : undefined,
      label: item.Label ? String(item.Label) : undefined,
      type: item.PresetType ? String(item.PresetType) : undefined,
    }))
    .filter((item) => item.id);
}

function labelMatches(item: TencentEffectItem, needles: string[]): boolean {
  const haystack = [item.label, item.type, item.name].filter(Boolean).join(' ').toLowerCase();
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

const MAKEUP_LABELS = ['Makeup', '美妆', '妆容', '妆', 'Lip makeup', 'Eye makeup'];
const STICKER_LABELS = ['Sticker', '贴纸', 'Stickers'];
const BEAUTY_LABELS = ['Beauty', '美颜', 'beauty'];
const BODY_LABELS = ['Body', '美体', 'body', 'Body beauty'];

async function fetchEffectListByLabels(
  instance: TencentWebARInstance,
  labels: string[],
): Promise<TencentEffectItem[]> {
  // Cap page size — PageSize 1000 froze the main thread for multiple seconds on panel open.
  const PAGE_SIZE = 32;
  for (const lb of labels) {
    try {
      const labeled = await instance.getEffectList?.({
        Type: 'Preset',
        Label: lb,
        PageNumber: 0,
        PageSize: PAGE_SIZE,
      });
      if (labeled?.length) return mapEffectRows(labeled);
    } catch {
      /* try next */
    }
  }
  try {
    const labeled = await instance.getEffectList?.({
      Type: 'Preset',
      Label: labels,
      PageNumber: 0,
      PageSize: PAGE_SIZE,
    });
    if (labeled?.length) return mapEffectRows(labeled);
  } catch {
    /* fall through */
  }
  return [];
}

async function fetchAllPresetEffects(instance: TencentWebARInstance): Promise<TencentEffectItem[]> {
  try {
    const all = await instance.getEffectList?.({
      Type: 'Preset',
      PageNumber: 0,
      PageSize: 48,
    });
    if (all?.length) return mapEffectRows(all);
  } catch {
    /* ignore */
  }
  return [];
}

function partitionPresetCatalog(all: TencentEffectItem[]) {
  const makeups = all.filter((item) => labelMatches(item, MAKEUP_LABELS));
  const stickers = all.filter((item) => labelMatches(item, STICKER_LABELS));
  const bodyShapes = all.filter((item) => labelMatches(item, BODY_LABELS));
  const used = new Set([...makeups, ...stickers, ...bodyShapes].map((item) => item.id));
  const leftover = all.filter((item) => !used.has(item.id));
  return {
    makeups: makeups.length > 0 ? makeups : leftover,
    stickers,
    bodyShapes,
  };
}

export type LoadedEffectCatalogs = {
  makeups: TencentEffectItem[];
  stickers: TencentEffectItem[];
  filters: TencentEffectItem[];
  bodyShapes: TencentEffectItem[];
  beautifyRows: TencentEffectItem[];
};

export function hasSharedEffectCatalogRows(): boolean {
  const catalogs = getSharedTencentWebAREffectCatalogs();
  return (
    catalogs.makeups.length > 0 ||
    catalogs.stickers.length > 0 ||
    catalogs.filters.length > 0
  );
}

export async function loadEffectCatalogsFromInstance(
  instance: TencentWebARInstance,
): Promise<LoadedEffectCatalogs> {
  let makeups = await fetchEffectListByLabels(instance, MAKEUP_LABELS);
  let stickers = await fetchEffectListByLabels(instance, STICKER_LABELS);
  const beautifyRows = await fetchEffectListByLabels(instance, BEAUTY_LABELS);
  let bodyShapes = await fetchEffectListByLabels(instance, BODY_LABELS);

  if (makeups.length === 0 || stickers.length === 0) {
    const all = await fetchAllPresetEffects(instance);
    if (all.length > 0) {
      const partitioned = partitionPresetCatalog(all);
      if (makeups.length === 0) makeups = partitioned.makeups;
      if (stickers.length === 0) stickers = partitioned.stickers;
      if (bodyShapes.length === 0) bodyShapes = partitioned.bodyShapes;
    }
  }

  let filters: TencentEffectItem[] = [];
  try {
    const list = await instance.getCommonFilter?.();
    if (list) filters = mapEffectRows(list);
  } catch {
    /* optional */
  }

  return { makeups, stickers, filters, bodyShapes, beautifyRows };
}

/** Persist catalogs into the process-wide shared cache + localStorage. */
export function commitEffectCatalogsToShared(payload: LoadedEffectCatalogs): boolean {
  const { makeups, stickers, filters, bodyShapes, beautifyRows } = payload;
  const hasAny = makeups.length > 0 || stickers.length > 0 || filters.length > 0;
  if (!hasAny) return false;

  setSharedTencentWebAREffectCatalogs({
    makeups,
    stickers,
    filters,
    bodyShapes,
  });

  const coverSources = [...beautifyRows, ...filters, ...bodyShapes, ...makeups];
  const nextBeautyCovers = buildBeautyCoverMap(coverSources);
  const nextShapeCovers = buildShapeCoverMap(bodyShapes.length > 0 ? bodyShapes : coverSources);
  const nextShapeEffects = buildShapeEffectMap(bodyShapes);
  setSharedTencentWebARCovers(
    nextBeautyCovers as Record<string, string>,
    nextShapeCovers as Record<string, string>,
    nextShapeEffects as Record<string, string>,
  );
  markSharedTencentWebARCatalogsLoaded();
  return true;
}

export async function refreshSharedEffectCatalogs(
  instance: TencentWebARInstance,
  attempts = 4,
): Promise<boolean> {
  // If we already have a session/local catalog, NEVER refresh mid-session.
  // Background getEffectList(PageSize huge) was the 4–9s freeze on beauty taps.
  if (hasSharedEffectCatalogRows() && sharedCatalogsLoaded) {
    return true;
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const payload = await loadEffectCatalogsFromInstance(instance);
      if (commitEffectCatalogsToShared(payload)) return true;
    } catch {
      /* retry */
    }
    await new Promise((resolve) => window.setTimeout(resolve, 300 * (attempt + 1)));
  }
  return hasSharedEffectCatalogRows();
}

export function readSharedCatalogSnapshot() {
  return {
    catalogs: getSharedTencentWebAREffectCatalogs(),
    covers: getSharedTencentWebARCovers(),
    loaded: sharedCatalogsLoaded && hasSharedEffectCatalogRows(),
  };
}
