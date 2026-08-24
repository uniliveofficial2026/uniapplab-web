#!/usr/bin/env node
/**
 * Pixel measurement + artwork audit from approved V14 reference JPEGs.
 * Does not modify production CSS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const refDir = path.join(root, 'public/reference-approved/live-tools-v14-frontend');
const assetDir = path.join(root, 'public/live-tools-v14');
const outDocs = path.join(root, 'docs/v14-visual-spec');
const cropDir = path.join(root, '.local-dev/v14-parity/reference-crops');

const W = 711;
const H = 1536;

function idx(x, y) {
  return (y * W + x) * 3;
}

function lum(data, x, y) {
  const i = idx(Math.max(0, Math.min(W - 1, x)), Math.max(0, Math.min(H - 1, y)));
  return (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
}

function rgb(data, x, y) {
  const i = idx(Math.max(0, Math.min(W - 1, x)), Math.max(0, Math.min(H - 1, y)));
  return [data[i], data[i + 1], data[i + 2]];
}

function rowStats(data, y, x0 = 40, x1 = W - 40) {
  let sum = 0;
  let n = 0;
  let dark = 0;
  let purple = 0;
  for (let x = x0; x < x1; x += 2) {
    const [r, g, b] = rgb(data, x, y);
    const L = (r * 299 + g * 587 + b * 114) / 1000;
    sum += L;
    n += 1;
    if (L < 55) dark += 1;
    if (b > r && b > g && L < 90) purple += 1;
  }
  return { avg: sum / n, darkRatio: dark / n, purpleRatio: purple / n };
}

function findSheetTop(data) {
  // Sheet is a consistent dark band. Scan upward from bottom until darkness drops.
  let sheetStart = H - 1;
  for (let y = H - 8; y > 200; y -= 1) {
    const s = rowStats(data, y);
    if (s.darkRatio > 0.55 && s.avg < 48) {
      sheetStart = y;
    } else if (sheetStart < H - 40 && s.avg > 70) {
      break;
    }
  }
  // Refine: first row from top of dark band where darkRatio exceeds 0.45 after video
  let top = 400;
  for (let y = 280; y < H - 80; y += 1) {
    const s = rowStats(data, y, 20, W - 20);
    const prev = rowStats(data, Math.max(0, y - 6), 20, W - 20);
    if (s.darkRatio > 0.42 && s.avg < 52 && prev.avg - s.avg > 8) {
      top = y;
      break;
    }
  }
  return top;
}

function findHandle(data, sheetTop) {
  // Centered light-gray bar near sheet top
  let best = { y: sheetTop + 8, score: -1, x: W / 2, w: 42, h: 4 };
  for (let y = sheetTop; y < sheetTop + 28; y += 1) {
    let run = 0;
    let runStart = 0;
    let bestRun = 0;
    let bestStart = 0;
    for (let x = 200; x < 520; x += 1) {
      const L = lum(data, x, y);
      if (L > 70 && L < 170) {
        if (run === 0) runStart = x;
        run += 1;
        if (run > bestRun) {
          bestRun = run;
          bestStart = runStart;
        }
      } else run = 0;
    }
    if (bestRun > best.score) {
      best = { y, score: bestRun, x: bestStart, w: bestRun, h: 3 };
    }
  }
  return best;
}

function nbox(x, y, w, h) {
  return {
    px: { x: round(x), y: round(y), w: round(w), h: round(h) },
    n: {
      x: round(x / W, 4),
      y: round(y / H, 4),
      w: round(w / W, 4),
      h: round(h / H, 4),
    },
  };
}

function round(v, d = 1) {
  const p = 10 ** d;
  return Math.round(v * p) / p;
}

function gridCells({ left, top, right, bottom, cols, rows, gapX, gapY }) {
  const innerW = right - left;
  const innerH = bottom - top;
  const cellW = (innerW - gapX * (cols - 1)) / cols;
  const cellH = (innerH - gapY * (rows - 1)) / rows;
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = left + c * (cellW + gapX);
      const y = top + r * (cellH + gapY);
      cells.push({ r, c, ...nbox(x, y, cellW, cellH) });
    }
  }
  return { cellW, cellH, cells };
}

async function loadRaw(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== W || info.height !== H) {
    throw new Error(`${file} unexpected size ${info.width}x${info.height}`);
  }
  return data;
}

function estimateGridByContrast(data, { sheetTop, cols, rows, searchTop, searchBottom, minCell = 60 }) {
  // Horizontal projection of edge energy inside sheet
  const y0 = searchTop;
  const y1 = searchBottom;
  const colEnergy = new Float64Array(W);
  for (let x = 8; x < W - 8; x += 1) {
    let e = 0;
    for (let y = y0; y < y1; y += 3) {
      const a = lum(data, x, y);
      const b = lum(data, x + 1, y);
      e += Math.abs(a - b);
    }
    colEnergy[x] = e;
  }
  // Find left/right content bounds
  let left = 12;
  let right = W - 12;
  for (let x = 8; x < W / 2; x += 1) {
    if (colEnergy[x] > 40) {
      left = x;
      break;
    }
  }
  for (let x = W - 9; x > W / 2; x -= 1) {
    if (colEnergy[x] > 40) {
      right = x;
      break;
    }
  }

  const rowEnergy = new Float64Array(H);
  for (let y = y0; y < y1; y += 1) {
    let e = 0;
    for (let x = left; x < right; x += 3) {
      e += Math.abs(lum(data, x, y) - lum(data, x, y + 1));
    }
    rowEnergy[y] = e;
  }

  // Smooth and find valleys (gaps) vs peaks (art)
  return { left, right, y0, y1, colEnergy, rowEnergy };
}

function findValleys(energy, from, to, expectedGaps, minGap = 4) {
  const slice = [];
  for (let i = from; i < to; i += 1) slice.push({ i, v: energy[i] });
  const mean = slice.reduce((s, x) => s + x.v, 0) / slice.length;
  const valleys = [];
  for (let i = 1; i < slice.length - 1; i += 1) {
    if (slice[i].v < mean * 0.55 && slice[i].v <= slice[i - 1].v && slice[i].v <= slice[i + 1].v) {
      valleys.push(slice[i]);
    }
  }
  // cluster nearby
  const clustered = [];
  for (const v of valleys) {
    const last = clustered[clustered.length - 1];
    if (!last || v.i - last.i > minGap) clustered.push(v);
    else if (v.v < last.v) clustered[clustered.length - 1] = v;
  }
  return clustered.map((v) => v.i);
}

async function cropBox(src, box, dest) {
  await sharp(src)
    .extract({
      left: Math.max(0, Math.round(box.x)),
      top: Math.max(0, Math.round(box.y)),
      width: Math.max(1, Math.round(box.w)),
      height: Math.max(1, Math.round(box.h)),
    })
    .png()
    .toFile(dest);
}

async function madCompare(aPath, bPath, size = 96) {
  const toBuf = async (p) => {
    const { data, info } = await sharp(p)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data, info };
  };
  try {
    const a = await toBuf(aPath);
    const b = await toBuf(bPath);
    let sum = 0;
    const n = a.data.length;
    for (let i = 0; i < n; i += 1) sum += Math.abs(a.data[i] - b.data[i]);
    return sum / n / 255;
  } catch {
    return 1;
  }
}

function classifyProblem(score, runtimeW, runtimeH, refW, refH) {
  if (score > 0.28) return { match: false, problem: 'wrong artwork' };
  const arR = runtimeW / runtimeH;
  const arF = refW / refH;
  if (Math.abs(arR - arF) > 0.12) return { match: false, problem: 'wrong proportions' };
  if (score > 0.16) return { match: false, problem: 'wrong crop' };
  if (score > 0.11) return { match: false, problem: 'wrong scale' };
  return { match: true, problem: null };
}

const PANELS = {
  guests: {
    file: '01-guests-approved.jpeg',
    context: 'normal/solo guest live',
    names: ['Host', 'UniAngel', 'UniStar', 'UniBaby', 'Invite'],
  },
  gifts: {
    file: '02-gifts-approved.jpeg',
    context: 'approved PK',
    cols: 5,
    rows: 3,
    names: [
      'Lucky Bill',
      'Mystery Box',
      'Lucky Box',
      'Mega Lucky Box',
      'Diamond Bag',
      'Mystery Chest',
      'Lucky Wheel',
      'Fortune Egg',
      'Golden Egg',
      'Surprise Gift',
      'Love Airplane',
      'Dream Castle',
      'Crystal Carriage',
      'Galaxy Whale',
      'Phoenix',
    ],
    assetPrefix: 'gifts/gift',
    assetCount: 15,
  },
  stickers: {
    file: '03-stickers-approved.jpeg',
    context: 'approved PK',
    cols: 5,
    rows: 4,
    names: [
      'Hi',
      'Hello',
      'Hey',
      'Good Night',
      'Good Morning',
      'Love You',
      'Kiss',
      'Hug',
      'Thank You',
      'So Cute',
      'LOL',
      'Wow',
      'Love',
      'Happy',
      'Cry',
      'Angry',
      'Excited',
      'Sorry',
      'Shy',
      'Bye Bye',
    ],
    assetPrefix: 'stickers/sticker',
    assetCount: 20,
  },
  voice: {
    file: '04-voice-changer-approved.jpeg',
    context: 'approved PK',
    cols: 6,
    rows: 3,
    names: [
      'Original',
      'Sweet Girl',
      'Deep Male',
      'Baby',
      'Lolita',
      'Young Boy',
      'Elder',
      'Helium',
      'Chipmunk',
      'Monster',
      'Robot',
      'Alien',
      'Devil',
      'Ghost',
      'Cave',
      'Radio',
      'Telephone',
      'Megaphone',
    ],
    assetPrefix: 'voices/voice',
    assetCount: 18,
  },
  beauty: {
    file: '05-beauty-effects-approved.jpeg',
    context: 'approved PK',
    names: ['None', 'Natural', 'Clear', 'Cute', 'Glamour', 'Korean'],
    portraitNames: ['Natural', 'Clear', 'Cute', 'Glamour', 'Korean'],
    assetPrefix: 'beauty/beauty',
    assetCount: 5,
  },
  games: {
    file: '06-game-center-approved.jpeg',
    context: 'approved PK',
    cols: 4,
    rows: 2,
    names: [
      'Lucky Wheel',
      'Treasure Box',
      'Fruit Slash',
      'Bubble Shooter',
      'Dice King',
      'Card Battle',
      'Whack a Mole',
      'Fishing Master',
    ],
    assetPrefix: 'games/game',
    assetCount: 8,
  },
};

async function measurePanel(key, spec) {
  const src = path.join(refDir, spec.file);
  const data = await loadRaw(src);
  const sheetTop = findSheetTop(data);
  const handle = findHandle(data, sheetTop);
  const sheet = nbox(0, sheetTop, W, H - sheetTop);

  // Footer: last ~11% of sheet tends to be send/request row
  const footerH = key === 'guests' ? 118 : key === 'gifts' ? 132 : 120;
  const footerTop = H - footerH - (key === 'guests' ? 86 : 8);
  // Guests has live footer tray below the sheet.

  let grid = null;
  if (spec.cols && spec.rows) {
    const searchTop = sheetTop + (key === 'gifts' ? 150 : key === 'voice' ? 118 : key === 'games' ? 128 : 88);
    const searchBottom = footerTop - (key === 'voice' ? 110 : key === 'gifts' ? 8 : key === 'games' ? 92 : 8);
    const { left, right } = estimateGridByContrast(data, {
      sheetTop,
      cols: spec.cols,
      rows: spec.rows,
      searchTop,
      searchBottom,
    });
    const gapX = key === 'voice' ? 10 : 8;
    const gapY = key === 'voice' ? 18 : 8;
    grid = {
      bounds: nbox(left, searchTop, right - left, searchBottom - searchTop),
      cols: spec.cols,
      rows: spec.rows,
      gapX,
      gapY,
      ...gridCells({
        left,
        top: searchTop,
        right,
        bottom: searchBottom,
        cols: spec.cols,
        rows: spec.rows,
        gapX,
        gapY,
      }),
    };
  }

  const doc = {
    panel: key,
    referenceFile: spec.file,
    referenceContext: spec.context,
    referencePx: { width: W, height: H },
    targetLogicalPx: { width: 390, height: 844 },
    scaleTo390: round(W / 390, 4),
    sheet: {
      ...sheet,
      topY: sheet.n.y,
      bottomY: 1,
      radiusPxApprox: 22,
      radiusN: round(22 / W, 4),
    },
    dragHandle: nbox(handle.x, handle.y, handle.w, Math.max(3, handle.h)),
    footer: nbox(16, footerTop, W - 32, footerH),
    grid,
    notes: [
      'Coordinates are normalized to reference 711x1536. Multiply n.* by runtime width/height.',
      'Do not use this JPEG as a runtime background.',
    ],
  };

  if (key === 'guests') {
    doc.header = {
      title: nbox(18, sheetTop + 28, 220, 28),
      info: nbox(200, sheetTop + 32, 18, 18),
      layout: nbox(470, sheetTop + 26, 100, 32),
      manage: nbox(580, sheetTop + 26, 110, 32),
    };
    const cardsTop = sheetTop + 72;
    const cardsH = 268;
    const cardW = 118;
    const gap = 10;
    const startX = 16;
    doc.cards = Array.from({ length: 5 }, (_, i) => ({
      name: spec.names[i],
      ...nbox(startX + i * (cardW + gap), cardsTop, cardW, cardsH),
    }));
    doc.bottomActions = {
      mic: nbox(22, footerTop + 8, 52, 70),
      camera: nbox(82, footerTop + 8, 52, 70),
      flip: nbox(142, footerTop + 8, 52, 70),
      beautify: nbox(202, footerTop + 8, 52, 70),
      effects: nbox(262, footerTop + 8, 52, 70),
      requestToJoin: nbox(330, footerTop + 18, 360, 52),
    };
    doc.liveChromeFooter = nbox(0, H - 86, W, 86);
  }

  if (key === 'gifts') {
    doc.header = {
      myCoins: nbox(18, sheetTop + 28, 250, 40),
      recharge: nbox(480, sheetTop + 28, 160, 36),
      close: nbox(660, sheetTop + 26, 36, 36),
    };
    doc.tabs = nbox(12, sheetTop + 74, W - 24, 36);
    doc.filterRow = nbox(12, sheetTop + 114, W - 24, 32);
    doc.tabsExpected = ['All Gifts', 'Lucky', 'Popular', 'Love', 'Luxury', 'Fun', 'VIP', 'Festival'];
    doc.wraps = false;
    doc.footerParts = {
      sendTo: nbox(16, footerTop + 16, 170, 48),
      qty: nbox(190, footerTop + 18, 90, 40),
      selected: nbox(286, footerTop + 14, 110, 48),
      anonymous: nbox(400, footerTop + 22, 110, 32),
      sendGift: nbox(520, footerTop + 14, 170, 48),
    };
  }

  if (key === 'stickers') {
    doc.header = {
      title: nbox(18, sheetTop + 26, 200, 32),
      viewToggle: nbox(620, sheetTop + 70, 70, 28),
    };
    doc.tabs = nbox(12, sheetTop + 64, 600, 34);
    doc.tabsExpected = ['All', 'Hi', 'Love', 'Fun', 'Actions', 'Emotions', 'Luxury', 'Special'];
    doc.footerParts = {
      sendTo: nbox(16, footerTop + 16, 220, 48),
      qty: nbox(250, footerTop + 18, 100, 40),
      sendSticker: nbox(380, footerTop + 14, 310, 50),
    };
  }

  if (key === 'voice') {
    doc.header = {
      title: nbox(18, sheetTop + 22, 280, 28),
      subtitle: nbox(18, sheetTop + 50, 320, 18),
      myVoice: nbox(520, sheetTop + 24, 100, 32),
      close: nbox(660, sheetTop + 24, 36, 36),
    };
    doc.tabs = nbox(12, sheetTop + 74, 620, 34);
    doc.tabsExpected = ['All', 'Popular', 'Character', 'Funny', 'Robot', 'Fantasy', 'Special'];
    doc.controls = {
      voiceEffect: nbox(16, footerTop - 108, 420, 92),
      backgroundSound: nbox(450, footerTop - 108, 245, 92),
    };
    doc.footerParts = {
      sendTo: nbox(16, footerTop + 14, 170, 48),
      qty: nbox(190, footerTop + 18, 90, 40),
      preview: nbox(290, footerTop + 16, 130, 44),
      applyVoice: nbox(430, footerTop + 14, 260, 50),
    };
  }

  if (key === 'beauty') {
    doc.header = {
      title: nbox(18, sheetTop + 22, 280, 28),
      subtitle: nbox(18, sheetTop + 50, 340, 18),
      reset: nbox(560, sheetTop + 24, 70, 32),
      close: nbox(660, sheetTop + 24, 36, 36),
    };
    doc.tabs = nbox(12, sheetTop + 74, 620, 34);
    doc.presets = Array.from({ length: 6 }, (_, i) => ({
      name: spec.names[i],
      ...nbox(16 + i * 114, sheetTop + 118, 104, 104),
    }));
    const slidersTop = sheetTop + 236;
    const sliders = ['Skin Smooth', 'Whiten', 'Sharpen', 'Slim Face', 'Big Eyes', 'Nose', 'Lips', 'Chin'];
    doc.sliders = sliders.map((name, i) => {
      const r = Math.floor(i / 4);
      const c = i % 4;
      return { name, ...nbox(16 + c * 174, slidersTop + r * 86, 166, 78) };
    });
    doc.makeup = {
      title: nbox(16, slidersTop + 180, 120, 20),
      items: ['Lipstick', 'Blush', 'Contour', 'Eyebrow', 'Eyeliner', 'Eyeshadow'].map((name, i) => ({
        name,
        ...nbox(16 + i * 116, slidersTop + 204, 108, 64),
      })),
    };
    doc.footerParts = {
      sendTo: nbox(16, footerTop + 14, 200, 48),
      qty: nbox(230, footerTop + 18, 90, 40),
      applyEffect: nbox(340, footerTop + 14, 350, 50),
    };
  }

  if (key === 'games') {
    doc.header = {
      title: nbox(18, sheetTop + 22, 300, 28),
      subtitle: nbox(18, sheetTop + 50, 420, 18),
      diamonds: nbox(520, sheetTop + 24, 110, 32),
      close: nbox(660, sheetTop + 24, 36, 36),
    };
    doc.tabs = nbox(12, sheetTop + 74, W - 24, 36);
    doc.utilityRow = nbox(16, footerTop - 92, W - 32, 80);
    doc.footerParts = {
      sendTo: nbox(16, footerTop + 14, 200, 48),
      qty: nbox(230, footerTop + 18, 90, 40),
      playGame: nbox(340, footerTop + 14, 350, 50),
    };
  }

  return { doc, data, src, sheetTop };
}

async function main() {
  fs.mkdirSync(outDocs, { recursive: true });
  fs.mkdirSync(cropDir, { recursive: true });
  fs.mkdirSync(path.join(root, '.local-dev/v14-parity'), { recursive: true });

  const audit = [];
  const summaries = [];

  for (const [key, spec] of Object.entries(PANELS)) {
    const { doc, src } = await measurePanel(key, spec);
    const outName =
      key === 'guests'
        ? '01-guests.json'
        : key === 'gifts'
          ? '02-gifts.json'
          : key === 'stickers'
            ? '03-stickers.json'
            : key === 'voice'
              ? '04-voice.json'
              : key === 'beauty'
                ? '05-beauty.json'
                : '06-games.json';
    fs.writeFileSync(path.join(outDocs, outName), JSON.stringify(doc, null, 2));
    summaries.push({
      panel: key,
      sheetTopN: doc.sheet.topY,
      sheetTopPx: doc.sheet.px.y,
      sheetH: doc.sheet.px.h,
    });

    if (doc.grid?.cells && spec.assetCount) {
      for (let i = 0; i < spec.assetCount; i += 1) {
        const cell = doc.grid.cells[i];
        const name = spec.names[i];
        const cropPath = path.join(cropDir, `${key}-${String(i + 1).padStart(2, '0')}.png`);
        await cropBox(src, cell.px, cropPath);
        const runtime = path.join(assetDir, `${spec.assetPrefix}-${String(i + 1).padStart(2, '0')}.png`);
        const runtimeMeta = fs.existsSync(runtime) ? await sharp(runtime).metadata() : null;
        const score = runtimeMeta ? await madCompare(cropPath, runtime) : 1;
        const cls = runtimeMeta
          ? classifyProblem(score, runtimeMeta.width, runtimeMeta.height, cell.px.w, cell.px.h)
          : { match: false, problem: 'missing' };
        audit.push({
          referencePanel: key,
          referenceItemName: name,
          currentRuntimeAsset: fs.existsSync(runtime) ? `/live-tools-v14/${spec.assetPrefix}-${String(i + 1).padStart(2, '0')}.png` : null,
          runtimePx: runtimeMeta ? { w: runtimeMeta.width, h: runtimeMeta.height } : null,
          referenceCropPx: cell.px,
          madCover: round(score, 4),
          match: cls.match,
          problem: cls.problem,
          replacementAsset: path.relative(root, cropPath),
        });
      }
    }

    if (key === 'beauty') {
      // portraits are 5 cards after None
      for (let i = 0; i < 5; i += 1) {
        const cell = doc.presets[i + 1];
        const name = spec.portraitNames[i];
        const cropPath = path.join(cropDir, `beauty-portrait-${String(i + 1).padStart(2, '0')}.png`);
        await cropBox(src, cell.px, cropPath);
        const runtime = path.join(assetDir, `beauty/beauty-${String(i + 1).padStart(2, '0')}.png`);
        const runtimeMeta = fs.existsSync(runtime) ? await sharp(runtime).metadata() : null;
        const score = runtimeMeta ? await madCompare(cropPath, runtime) : 1;
        const cls = runtimeMeta
          ? classifyProblem(score, runtimeMeta.width, runtimeMeta.height, cell.px.w, cell.px.h)
          : { match: false, problem: 'missing' };
        // replace beauty entries if grid path also wrote them — beauty has no grid
        audit.push({
          referencePanel: 'beauty',
          referenceItemName: name,
          currentRuntimeAsset: `/live-tools-v14/beauty/beauty-${String(i + 1).padStart(2, '0')}.png`,
          runtimePx: runtimeMeta ? { w: runtimeMeta.width, h: runtimeMeta.height } : null,
          referenceCropPx: cell.px,
          madCover: round(score, 4),
          match: cls.match,
          problem: cls.problem,
          replacementAsset: path.relative(root, cropPath),
        });
      }
    }
  }

  const auditPath = path.join(outDocs, 'artwork-audit-v14.json');
  const unique = [];
  const seen = new Set();
  for (const row of audit) {
    const k = `${row.referencePanel}:${row.referenceItemName}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(row);
  }

  fs.writeFileSync(
    auditPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        referenceSizePx: { width: W, height: H },
        method: 'cover-resize mean-absolute-difference vs reference cell crop; plus runtime aspect vs reference cell',
        matchThreshold: { pass: 0.11, crop: 0.16, wrong: 0.28 },
        counts: {
          total: unique.length,
          match: unique.filter((r) => r.match).length,
          fail: unique.filter((r) => !r.match).length,
        },
        items: unique,
      },
      null,
      2,
    ),
  );

  console.log(JSON.stringify({ summaries, auditCounts: { total: unique.length, fail: unique.filter((r) => !r.match).length } }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
