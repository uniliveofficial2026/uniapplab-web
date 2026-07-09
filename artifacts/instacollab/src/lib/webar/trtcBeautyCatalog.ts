import { LIVE_BEAUTY_PRESETS, type BeautyPresetId } from '../ar/beautyFilters';
import { BODY_SHAPE_PRESETS } from '../ar/bodyShape';
import type { TencentEffectItem } from './webarTypes';

const BEAUTY_COVER_TERMS: Record<string, string[]> = {
  'beauty-smooth': ['smooth', '磨皮', '美肤', '细腻', 'smoothskin'],
  'beauty-soft': ['soft', '柔和', '轻颜', 'softlight'],
  'beauty-glow': ['glow', '透亮', '光泽', 'bright', 'radiant'],
  'beauty-natural': ['natural', '自然', '原生'],
  'beauty-clear': ['clear', '清晰', 'hd', '清透'],
};

const SHAPE_COVER_TERMS: Record<string, string[]> = {
  'shape-natural': ['natural', '自然', '原生'],
  'shape-slim-face': ['slim', '瘦脸', 'v脸', 'v-line', 'vline', 'thin'],
  'shape-full-face': ['full', '丰脸', '饱满', 'round'],
  'shape-vline': ['v-line', 'vline', 'v脸', '下巴'],
  'shape-big-eyes': ['eye', '大眼', '眼睛'],
  'shape-model-waist': ['waist', '瘦腰', '腰', 'slim body'],
  'shape-curvy': ['curve', '曲线', '臀', 'hip', 'curvy'],
  'shape-long-legs': ['leg', '长腿', 'long'],
  'shape-athletic': ['athletic', '运动', 'fit', '肌肉'],
  'shape-glam': ['glam', ' glamour', '精致', '女神'],
};

function normalizeHaystack(item: TencentEffectItem): string {
  return [item.name, item.label, item.type, item.id].filter(Boolean).join(' ').toLowerCase();
}

function matchCover(
  items: TencentEffectItem[],
  terms: string[],
  used: Set<string>,
): string | undefined {
  for (const term of terms) {
    const needle = term.toLowerCase();
    const hit = items.find(
      (item) => item.cover && !used.has(item.cover) && normalizeHaystack(item).includes(needle),
    );
    if (hit?.cover) {
      used.add(hit.cover);
      return hit.cover;
    }
  }
  return undefined;
}

/** Map TRTC SDK catalog rows → beauty preset CoverUrl thumbnails. */
export function buildBeautyCoverMap(items: TencentEffectItem[]): Partial<Record<BeautyPresetId, string>> {
  const map: Partial<Record<BeautyPresetId, string>> = {};
  const withCovers = items.filter((item) => item.cover);
  const used = new Set<string>();

  for (const preset of LIVE_BEAUTY_PRESETS) {
    if (preset.id === 'none') continue;
    const terms = BEAUTY_COVER_TERMS[preset.id] ?? [preset.label.toLowerCase()];
    const cover = matchCover(withCovers, terms, used);
    if (cover) map[preset.id] = cover;
  }

  const leftovers = withCovers.filter((item) => item.cover && !used.has(item.cover));
  const presetIds = LIVE_BEAUTY_PRESETS.map((p) => p.id).filter((id) => id !== 'none');
  let index = 0;
  for (const id of presetIds) {
    if (map[id] || !leftovers[index]?.cover) continue;
    map[id] = leftovers[index].cover;
    used.add(leftovers[index].cover);
    index += 1;
  }

  return map;
}

/** Map TRTC SDK catalog rows → body-shape preset CoverUrl thumbnails. */
export function buildShapeCoverMap(items: TencentEffectItem[]): Record<string, string> {
  const map: Record<string, string> = {};
  const withCovers = items.filter((item) => item.cover);
  const used = new Set<string>();

  for (const preset of BODY_SHAPE_PRESETS) {
    const terms = SHAPE_COVER_TERMS[preset.id] ?? [preset.label.toLowerCase()];
    const cover = matchCover(withCovers, terms, used);
    if (cover) map[preset.id] = cover;
  }

  const leftovers = withCovers.filter((item) => item.cover && !used.has(item.cover));
  let index = 0;
  for (const preset of BODY_SHAPE_PRESETS) {
    if (map[preset.id] || !leftovers[index]?.cover) continue;
    map[preset.id] = leftovers[index].cover;
    used.add(leftovers[index].cover);
    index += 1;
  }

  return map;
}

const SHAPE_EFFECT_TERMS: Record<string, string[]> = {
  'shape-natural': ['natural', '自然', '原生', 'none'],
  'shape-slim-face': ['slim face', 'slim', '瘦脸', 'thin face', '窄脸'],
  'shape-full-face': ['full face', 'full', '丰脸', 'round face'],
  'shape-vline': ['v-line', 'vline', 'v脸', 'v line', 'jaw'],
  'shape-big-eyes': ['big eye', 'big eyes', '大眼', 'eye enlarge'],
  'shape-model-waist': ['slim waist', 'waist', '瘦腰', 'model'],
  'shape-curvy': ['curvy', 'curve', '曲线', 'hip', 'chest'],
  'shape-long-legs': ['long leg', 'long legs', '长腿', 'leg'],
  'shape-athletic': ['athletic', 'sport', '运动', 'fit'],
  'shape-glam': ['glam', 'glamour', '女神', '精致'],
};

function matchEffectId(
  items: TencentEffectItem[],
  terms: string[],
  used: Set<string>,
): string | undefined {
  for (const term of terms) {
    const needle = term.toLowerCase();
    const hit = items.find(
      (item) => item.id && !used.has(item.id) && normalizeHaystack(item).includes(needle),
    );
    if (hit?.id) {
      used.add(hit.id);
      return hit.id;
    }
  }
  return undefined;
}

/** Map TRTC 美体 catalog rows → shape preset EffectIds for setEffect. */
export function buildShapeEffectMap(items: TencentEffectItem[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();

  for (const preset of BODY_SHAPE_PRESETS) {
    if (preset.id === 'shape-natural') continue;
    const terms = SHAPE_EFFECT_TERMS[preset.id] ?? [preset.label.toLowerCase()];
    const id = matchEffectId(items, terms, used);
    if (id) map[preset.id] = id;
  }

  const leftovers = items.filter((item) => item.id && !used.has(item.id));
  let index = 0;
  for (const preset of BODY_SHAPE_PRESETS) {
    if (preset.id === 'shape-natural' || map[preset.id] || !leftovers[index]?.id) continue;
    map[preset.id] = leftovers[index].id;
    used.add(leftovers[index].id);
    index += 1;
  }

  return map;
}
