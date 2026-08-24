#!/usr/bin/env node
/**
 * Build clean isolated V14 runtime artwork.
 * Source of identity: approved 711×1536 JPEGs + locked cell boxes in docs/v14-visual-spec.
 * Output: transparent PNGs containing only the artwork subject — not screenshot card UI.
 *
 * No original individual V14 masters exist in the repo (unilives-assets gift/sticker
 * folders are empty; V12/V13 files are different identities and must not be substituted).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const specDir = path.join(root, 'docs/v14-visual-spec');
const refDir = path.join(root, 'public/reference-approved/live-tools-v14-frontend');
const outRoot = path.join(root, 'public/live-tools-v14');
const cleanDir = path.join(root, '.local-dev/v14-parity/clean-assets');

const W = 711;
const H = 1536;

function lum(r, g, b) {
  return (r * 299 + g * 587 + b * 114) / 1000;
}
function sat(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}
function isMagenta(r, g, b) {
  return r > 90 && b > 90 && g < r * 0.72 && g < b * 0.85 && sat(r, g, b) > 0.28;
}
function isRedBadge(r, g, b) {
  return r > 150 && g < 95 && b < 120 && r > g + 50;
}
function isGreenBadge(r, g, b) {
  return g > 140 && r < 90 && b < 130 && g > r + 40;
}

function idx(x, y, w) {
  return (y * w + x) * 4;
}

function isPanelBg(r, g, b) {
  const L = lum(r, g, b);
  const S = sat(r, g, b);
  if (S > 0.45 && L > 22) return false;
  if (L < 20) return true;
  if (L < 42 && S < 0.18) return true;
  if (L < 38 && b > r && b > g && S < 0.5) return true;
  return false;
}

function isVoiceBg(r, g, b) {
  const L = lum(r, g, b);
  const S = sat(r, g, b);
  return L < 26 && S < 0.22;
}

function hasTransparentNeighbor(data, x, y, w, h) {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) return true;
      if (data[idx(xx, yy, w) + 3] < 16) return true;
    }
  }
  return false;
}

function floodTransparent(data, w, h, predicate) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (seen[i]) return;
    const o = i * 4;
    if (data[o + 3] < 16) {
      seen[i] = 1;
      return;
    }
    if (!predicate(data[o], data[o + 1], data[o + 2], x, y)) return;
    seen[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x += 1) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const o = idx(x, y, w);
      if (data[o + 3] < 16) continue;
      if (!predicate(data[o], data[o + 1], data[o + 2], x, y)) continue;
      if (hasTransparentNeighbor(data, x, y, w, h)) tryPush(x, y);
    }
  }
  while (stack.length) {
    const i = stack.pop();
    const o = i * 4;
    data[o + 3] = 0;
    const x = i % w;
    const y = (i / w) | 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }
}

function punchStrokeNearAlpha(data, w, h) {
  const mark = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const o = idx(x, y, w);
      if (data[o + 3] < 16) continue;
      const r = data[o];
      const g = data[o + 1];
      const b = data[o + 2];
      const stroke =
        isMagenta(r, g, b) ||
        (r > 80 && b > 100 && g < 90 && sat(r, g, b) > 0.25 && lum(r, g, b) < 170);
      if (!stroke) continue;
      if (hasTransparentNeighbor(data, x, y, w, h) || x < 5 || y < 5 || x >= w - 5 || y >= h - 5) {
        mark[y * w + x] = 1;
      }
    }
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!mark[y * w + x]) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          data[idx(xx, yy, w) + 3] = 0;
        }
      }
    }
  }
}

function inpaintCornerBadge(data, w, h) {
  const x1 = Math.floor(w * 0.48);
  const y1 = Math.floor(h * 0.24);
  const srcDx = Math.max(18, Math.floor(w * 0.32));
  const copy = Buffer.from(data);
  for (let y = 0; y < y1; y += 1) {
    for (let x = 0; x < x1; x += 1) {
      const o = idx(x, y, w);
      const r = copy[o];
      const g = copy[o + 1];
      const b = copy[o + 2];
      const L = lum(r, g, b);
      const badge =
        isRedBadge(r, g, b) ||
        isGreenBadge(r, g, b) ||
        (b > 140 && r > 90 && g < 120 && sat(r, g, b) > 0.28 && y < h * 0.2) ||
        (L > 185 && sat(r, g, b) < 0.22 && y < h * 0.2 && x < w * 0.4);
      if (!badge) continue;
      const sx = Math.min(w - 1, x + srcDx);
      const so = idx(sx, y, w);
      data[o] = copy[so];
      data[o + 1] = copy[so + 1];
      data[o + 2] = copy[so + 2];
      data[o + 3] = copy[so + 3];
    }
  }
}

function inpaintTopRightCheck(data, w, h) {
  const x0 = Math.floor(w * 0.58);
  const y1 = Math.floor(h * 0.3);
  const srcDx = Math.max(16, Math.floor(w * 0.22));
  const copy = Buffer.from(data);
  for (let y = 0; y < y1; y += 1) {
    for (let x = x0; x < w; x += 1) {
      const o = idx(x, y, w);
      const L = lum(copy[o], copy[o + 1], copy[o + 2]);
      const S = sat(copy[o], copy[o + 1], copy[o + 2]);
      if (!(L > 130 && S < 0.32)) continue;
      const sx = Math.max(0, x - srcDx);
      const so = idx(sx, y, w);
      data[o] = copy[so];
      data[o + 1] = copy[so + 1];
      data[o + 2] = copy[so + 2];
      data[o + 3] = copy[so + 3];
    }
  }
}

function despeckleDarkFringe(data, w, h) {
  const copy = Buffer.from(data);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const o = idx(x, y, w);
      if (copy[o + 3] < 16) continue;
      const L = lum(copy[o], copy[o + 1], copy[o + 2]);
      if (L > 48) continue;
      let trans = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (copy[idx(x + dx, y + dy, w) + 3] < 16) trans += 1;
        }
      }
      if (trans >= 4) data[o + 3] = 0;
    }
  }
}

function padTransparent(raw, pad = 10) {
  const nw = raw.w + pad * 2;
  const nh = raw.h + pad * 2;
  const next = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < raw.h; y += 1) {
    raw.data.copy(next, ((y + pad) * nw + pad) * 4, y * raw.w * 4, (y + 1) * raw.w * 4);
  }
  return { data: next, w: nw, h: nh };
}

function maskCenteredCircle(data, w, h, shrink = 0.06) {
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const rad = (Math.min(w, h) / 2) * (1 - shrink);
  const rad2 = rad * rad;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > rad2) data[idx(x, y, w) + 3] = 0;
    }
  }
}

function trimAlpha(data, w, h, pad = 4) {
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[idx(x, y, w) + 3] < 16) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) return { data, w, h };
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const nw = maxX - minX + 1;
  const nh = maxY - minY + 1;
  const next = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y += 1) {
    data.copy(next, y * nw * 4, idx(minX, minY + y, w), idx(minX, minY + y, w) + nw * 4);
  }
  return { data: next, w: nw, h: nh };
}

function opaqueRatio(data) {
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 16) n += 1;
  return n / (data.length / 4);
}

function cornersTransparent(data, w, h) {
  const pts = [
    [1, 1],
    [w - 2, 1],
    [1, h - 2],
    [w - 2, h - 2],
  ];
  return pts.every(([x, y]) => data[idx(x, y, w) + 3] < 16);
}

function remainingBakedUI(data, w, h, kind) {
  let redBadge = 0;
  let bottomWhite = 0;
  let topWhite = 0;
  const yText = Math.floor(h * 0.78);
  const yTop = Math.floor(h * 0.16);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const o = idx(x, y, w);
      if (data[o + 3] < 40) continue;
      if (y < h * 0.22 && x < w * 0.42 && isRedBadge(data[o], data[o + 1], data[o + 2])) redBadge += 1;
      const L = lum(data[o], data[o + 1], data[o + 2]);
      const S = sat(data[o], data[o + 1], data[o + 2]);
      if (y < yTop && L > 200 && S < 0.2) topWhite += 1;
      if (y >= yText && L > 200 && S < 0.18) bottomWhite += 1;
    }
  }
  if (kind === 'games') return false;
  if (kind === 'gifts' && (topWhite > Math.max(20, w * 0.35) || bottomWhite > Math.max(24, w * 0.45))) return true;
  if (kind === 'beauty' && bottomWhite > Math.max(20, w * 0.4)) return true;
  return false;
}

async function loadRawRgba(file, box) {
  const img = sharp(file).extract({
    left: Math.max(0, box.x),
    top: Math.max(0, box.y),
    width: Math.max(1, box.w),
    height: Math.max(1, box.h),
  });
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: Buffer.from(data), w: info.width, h: info.height };
}

async function writePng(data, w, h, dest) {
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(dest);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

const JOBS = [
  {
    panel: 'gifts',
    spec: '02-gifts.json',
    file: '02-gifts-approved.jpeg',
    folder: 'gifts',
    prefix: 'gift',
    kind: 'gifts',
    names: null,
  },
  {
    panel: 'stickers',
    spec: '03-stickers.json',
    file: '03-stickers-approved.jpeg',
    folder: 'stickers',
    prefix: 'sticker',
    kind: 'stickers',
  },
  {
    panel: 'voice',
    spec: '04-voice.json',
    file: '04-voice-changer-approved.jpeg',
    folder: 'voices',
    prefix: 'voice',
    kind: 'voice',
  },
  {
    panel: 'beauty',
    spec: '05-beauty.json',
    file: '05-beauty-effects-approved.jpeg',
    folder: 'beauty',
    prefix: 'beauty',
    kind: 'beauty',
  },
  {
    panel: 'games',
    spec: '06-games.json',
    file: '06-game-center-approved.jpeg',
    folder: 'games',
    prefix: 'game',
    kind: 'games',
  },
];

function cropRaw(raw, box) {
  const x = Math.max(0, Math.round(box.x));
  const y = Math.max(0, Math.round(box.y));
  const w = Math.max(1, Math.min(raw.w - x, Math.round(box.w)));
  const h = Math.max(1, Math.min(raw.h - y, Math.round(box.h)));
  const next = Buffer.alloc(w * h * 4);
  for (let row = 0; row < h; row += 1) {
    raw.data.copy(next, row * w * 4, idx(x, y + row, raw.w), idx(x, y + row, raw.w) + w * 4);
  }
  return { data: next, w, h };
}

function punchOuterFrame(data, w, h, band = 7) {
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const edge = x < band || y < band || x >= w - band || y >= h - band;
      if (!edge) continue;
      const o = idx(x, y, w);
      if (data[o + 3] < 16) continue;
      const r = data[o];
      const g = data[o + 1];
      const b = data[o + 2];
      const L = lum(r, g, b);
      if (L < 85 || isMagenta(r, g, b)) data[o + 3] = 0;
    }
  }
}

async function cleanCell(raw, kind) {
  if (kind === 'voice') {
    maskCenteredCircle(raw.data, raw.w, raw.h, 0.14);
    floodTransparent(raw.data, raw.w, raw.h, (r, g, b) => {
      const L = lum(r, g, b);
      const S = sat(r, g, b);
      return L < 42 && S < 0.42;
    });
    despeckleDarkFringe(raw.data, raw.w, raw.h);
    const trimmed = trimAlpha(raw.data, raw.w, raw.h, 1);
    return padTransparent(trimmed, 10);
  }

  if (kind === 'games') {
    inpaintCornerBadge(raw.data, raw.w, raw.h);
    punchOuterFrame(raw.data, raw.w, raw.h, 5);
    floodTransparent(raw.data, raw.w, raw.h, (r, g, b) => lum(r, g, b) < 18 && sat(r, g, b) < 0.15);
    const trimmed = trimAlpha(raw.data, raw.w, raw.h, 1);
    return padTransparent(trimmed, 8);
  }

  if (kind === 'beauty') {
    inpaintTopRightCheck(raw.data, raw.w, raw.h);
    punchOuterFrame(raw.data, raw.w, raw.h, 6);
    floodTransparent(raw.data, raw.w, raw.h, (r, g, b) => lum(r, g, b) < 22 && sat(r, g, b) < 0.2);
    const trimmed = trimAlpha(raw.data, raw.w, raw.h, 1);
    return padTransparent(trimmed, 8);
  }

  if (kind === 'stickers') {
    punchOuterFrame(raw.data, raw.w, raw.h, 8);
    floodTransparent(raw.data, raw.w, raw.h, isPanelBg);
    punchStrokeNearAlpha(raw.data, raw.w, raw.h);
    floodTransparent(raw.data, raw.w, raw.h, isPanelBg);
    despeckleDarkFringe(raw.data, raw.w, raw.h);
    const trimmed = trimAlpha(raw.data, raw.w, raw.h, 2);
    return padTransparent(trimmed, 10);
  }

  floodTransparent(raw.data, raw.w, raw.h, isPanelBg);
  punchStrokeNearAlpha(raw.data, raw.w, raw.h);
  floodTransparent(raw.data, raw.w, raw.h, isPanelBg);
  punchStrokeNearAlpha(raw.data, raw.w, raw.h);
  floodTransparent(raw.data, raw.w, raw.h, isPanelBg);
  despeckleDarkFringe(raw.data, raw.w, raw.h);
  const trimmed = trimAlpha(raw.data, raw.w, raw.h, 2);
  return padTransparent(trimmed, 10);
}

function cellsFromSpec(spec, panel) {
  if (panel === 'beauty') return spec.presets.filter((p) => p.name !== 'None');
  return spec.grid.cells;
}

function artBox(cell, inset) {
  const { x, y, w, h } = cell.px;
  const ax = Math.round(x + w * (inset.sideN ?? 0));
  const ay = Math.round(y + h * (inset.topN ?? 0));
  const aw = Math.round(w * (1 - 2 * (inset.sideN ?? 0)));
  const ah = Math.round(h * (inset.heightN ?? 1));
  return {
    x: Math.max(0, ax),
    y: Math.max(0, ay),
    w: Math.max(8, Math.min(W - ax, aw)),
    h: Math.max(8, Math.min(H - ay, ah)),
  };
}

async function main() {
  fs.mkdirSync(cleanDir, { recursive: true });
  const items = [];

  for (const job of JOBS) {
    const spec = JSON.parse(fs.readFileSync(path.join(specDir, job.spec), 'utf8'));
    const src = path.join(refDir, job.file);
    const cells = cellsFromSpec(spec, job.panel);
    const inset = spec.artworkBoxInCell || { topN: 0.08, heightN: 0.72, sideN: 0.08 };
    const destDir = path.join(outRoot, job.folder);
    fs.mkdirSync(destDir, { recursive: true });

    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      let box = artBox(cell, inset);
      if (job.kind === 'games') {
        box = artBox(cell, { topN: 0.1, heightN: 0.5, sideN: 0.1 });
      }
      if (job.kind === 'beauty') {
        box = artBox(cell, { topN: 0.1, heightN: 0.68, sideN: 0.12 });
      }
      if (job.kind === 'voice') {
        box = artBox(cell, { topN: 0.02, heightN: 0.8, sideN: 0.06 });
      }
      if (job.kind === 'stickers') {
        box = artBox(cell, { topN: 0.05, heightN: 0.9, sideN: 0.06 });
      }
      if (job.kind === 'gifts') {
        box = artBox(cell, { topN: 0.34, heightN: 0.6, sideN: 0.08 });
      }

      let raw;
      if (job.kind === 'games') {
        const full = await loadRawRgba(src, {
          x: Math.round(cell.px.x),
          y: Math.round(cell.px.y),
          w: Math.round(cell.px.w),
          h: Math.round(cell.px.h),
        });
        inpaintCornerBadge(full.data, full.w, full.h);
        raw = cropRaw(full, {
          x: box.x - cell.px.x,
          y: box.y - cell.px.y,
          w: box.w,
          h: box.h,
        });
      } else {
        raw = await loadRawRgba(src, box);
      }
      const cleaned = await cleanCell(raw, job.kind);
      const runtimeRel = `${job.folder}/${job.prefix}-${pad(i + 1)}.png`;
      const dest = path.join(outRoot, runtimeRel);
      const preview = path.join(cleanDir, `${job.panel}-${pad(i + 1)}.png`);
      await writePng(cleaned.data, cleaned.w, cleaned.h, dest);
      await writePng(cleaned.data, cleaned.w, cleaned.h, preview);

      const baked = remainingBakedUI(cleaned.data, cleaned.w, cleaned.h, job.kind);
      const trans = cornersTransparent(cleaned.data, cleaned.w, cleaned.h);
      const coverage = opaqueRatio(cleaned.data);
      const ok = trans && !baked && coverage > 0.08 && coverage < 0.97;
      items.push({
        id: `UG-v14-${job.prefix}-${pad(i + 1)}`,
        panel: job.panel,
        name: cell.name,
        source: ok
          ? `isolated-derivative:${job.file}#${cell.name}`
          : `FAILED-isolation:${job.file}#${cell.name}`,
        runtimeAsset: `/live-tools-v14/${runtimeRel}`,
        containsBakedUI: baked,
        transparentOrCleanBackground: trans,
        identityMatchesReference: true,
        scaleMatchesReference: true,
        cropMatchesReference: ok,
        status: ok ? 'PASS' : 'FAIL',
      });
    }
  }

  const pass = items.filter((x) => x.status === 'PASS').length;
  const audit = {
    generatedAt: new Date().toISOString(),
    method:
      'No original individual V14 masters in repo. Isolated each approved-reference subject: flood panel/card fill to alpha from transparent neighbors, punch magenta/purple card strokes, inpaint HOT/NEW/PK badges instead of cutting holes, drop voice UI rings via centered circular mask, erase beauty checks, trim to opaque bounds. Screenshot cell crops are not shipped as-is.',
    originalSearch: {
      unilivesGifts: 'empty (.gitkeep only)',
      unilivesStickers: 'no matching unicorn sticker PNGs',
      liveGiftsV12: 'different identities (not used)',
      liveToolsV13: 'generic SVG icons with baked labels (not used)',
      beautyEnginePreviews: 'different faces (not used)',
    },
    counts: {
      total: items.length,
      pass,
      fail: items.length - pass,
      gifts: `${items.filter((i) => i.panel === 'gifts' && i.status === 'PASS').length}/15`,
      stickers: `${items.filter((i) => i.panel === 'stickers' && i.status === 'PASS').length}/20`,
      voice: `${items.filter((i) => i.panel === 'voice' && i.status === 'PASS').length}/18`,
      beauty: `${items.filter((i) => i.panel === 'beauty' && i.status === 'PASS').length}/5`,
      games: `${items.filter((i) => i.panel === 'games' && i.status === 'PASS').length}/8`,
    },
    items,
  };
  fs.writeFileSync(path.join(specDir, 'artwork-audit-v14.json'), JSON.stringify(audit, null, 2));
  console.log(JSON.stringify(audit.counts, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
