#!/usr/bin/env node
/**
 * Locked visual measurement documents for UniLive V14.
 * Sheet tops come from visual strip inspection of the six approved 711×1536 JPEGs.
 * Do not use heuristic luminance sheet detection — it mistook PK chrome / dark video for the sheet.
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

function round(v, d = 4) {
  const p = 10 ** d;
  return Math.round(v * p) / p;
}

function nbox(x, y, w, h) {
  return {
    px: { x: round(x, 1), y: round(y, 1), w: round(w, 1), h: round(h, 1) },
    n: {
      x: round(x / W),
      y: round(y / H),
      w: round(w / W),
      h: round(h / H),
    },
    at390: {
      x: round((x / W) * 390, 1),
      y: round((y / H) * 844, 1),
      w: round((w / W) * 390, 1),
      h: round((h / H) * 844, 1),
    },
  };
}

function grid({ left, top, width, height, cols, rows, gapX, gapY, names }) {
  const cellW = (width - gapX * (cols - 1)) / cols;
  const cellH = (height - gapY * (rows - 1)) / rows;
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c;
      cells.push({
        r,
        c,
        name: names?.[i] ?? null,
        ...nbox(left + c * (cellW + gapX), top + r * (cellH + gapY), cellW, cellH),
      });
    }
  }
  return {
    bounds: nbox(left, top, width, height),
    cols,
    rows,
    gapX,
    gapY,
    cellW: round(cellW, 1),
    cellH: round(cellH, 1),
    cells,
  };
}

function tokens(sheetTop, sidePad, cardGapX, cardGapY, footerH, artScale = 1, sheetH = H - sheetTop) {
  return {
    '--sheet-top-ratio': round(sheetTop / H),
    '--sheet-height-ratio': round(sheetH / H),
    '--sheet-side-padding-n': round(sidePad / W),
    '--card-gap-x-n': round(cardGapX / W),
    '--card-gap-y-n': round(cardGapY / H),
    '--footer-height-n': round(footerH / H),
    '--art-scale': artScale,
    '--sheet-radius-n': round(22 / W),
  };
}

const GIFT_NAMES = [
  'Lucky Bill', 'Mystery Box', 'Lucky Box', 'Mega Lucky Box', 'Diamond Bag',
  'Mystery Chest', 'Lucky Wheel', 'Fortune Egg', 'Golden Egg', 'Surprise Gift',
  'Love Airplane', 'Dream Castle', 'Crystal Carriage', 'Galaxy Whale', 'Phoenix',
];
const STICKER_NAMES = [
  'Hi', 'Hello', 'Hey', 'Good Night', 'Good Morning',
  'Love You', 'Kiss', 'Hug', 'Thank You', 'So Cute',
  'LOL', 'Wow', 'Love', 'Happy', 'Cry',
  'Angry', 'Excited', 'Sorry', 'Shy', 'Bye Bye',
];
const VOICE_NAMES = [
  'Original', 'Sweet Girl', 'Deep Male', 'Baby', 'Lolita', 'Young Boy',
  'Elder', 'Helium', 'Chipmunk', 'Monster', 'Robot', 'Alien',
  'Devil', 'Ghost', 'Cave', 'Radio', 'Telephone', 'Megaphone',
];
const BEAUTY_PRESETS = ['None', 'Natural', 'Clear', 'Cute', 'Glamour', 'Korean'];
const GAME_NAMES = [
  'Lucky Wheel', 'Treasure Box', 'Fruit Slash', 'Bubble Shooter',
  'Dice King', 'Card Battle', 'Whack a Mole', 'Fishing Master',
];

const commonMeta = {
  referencePx: { width: W, height: H },
  targetLogicalPx: { width: 390, height: 844 },
  scaleTo390: round(W / 390, 4),
  notes: [
    'Normalized n.* = px / reference size. At runtime: x = n.x * viewportWidth.',
    'Target first at 390×844, then scale by n ratios.',
    'Do not use the approved JPEG as a runtime background.',
    'Last-column extra width in the JPEG is a screenshot slice artifact — runtime columns are equal.',
    'Sheet tops locked from visual Y-strips, not luminance heuristics.',
  ],
};

function guestsDoc() {
  const sheetTop = 958;
  const sheetH = 410;
  const cards = grid({
    left: 16, top: 1054, width: 679, height: 204, cols: 5, rows: 1, gapX: 10, gapY: 0,
    names: ['Host', 'UniAngel', 'UniStar', 'UniBaby', 'Invite'],
  });
  return {
    panel: 'guests',
    referenceFile: '01-guests-approved.jpeg',
    referenceContext: 'normal/solo guest live',
    ...commonMeta,
    tokens: tokens(sheetTop, 16, 10, 0, 92, 1, sheetH),
    sheet: {
      ...nbox(0, sheetTop, W, sheetH),
      topY: round(sheetTop / H),
      bottomY: round((sheetTop + sheetH) / H),
      radiusPxApprox: 22,
      radiusN: round(22 / W),
      sitsAboveLiveTray: true,
    },
    dragHandle: nbox(323, 966, 65, 5),
    header: {
      title: nbox(18, 1004, 210, 30),
      info: nbox(230, 1008, 22, 22),
      layout: nbox(468, 1004, 110, 34),
      manage: nbox(586, 1004, 108, 34),
    },
    cards: cards.cells,
    grid: cards,
    bottomActions: {
      mic: nbox(18, 1272, 52, 78),
      camera: nbox(78, 1272, 52, 78),
      flip: nbox(138, 1272, 52, 78),
      beautify: nbox(198, 1272, 52, 78),
      effects: nbox(258, 1272, 52, 78),
      requestToJoin: nbox(322, 1284, 372, 52),
      note: 'Request to Join is much wider than the five circular actions. Do not even-flex them.',
    },
    footer: nbox(8, 1268, 695, 92),
    liveChromeFooter: nbox(0, 1368, W, 168),
  };
}

function giftsDoc() {
  const sheetTop = 868;
  const g = grid({
    left: 12, top: 1046, width: 687, height: 420, cols: 5, rows: 3, gapX: 8, gapY: 8,
    names: GIFT_NAMES,
  });
  return {
    panel: 'gifts',
    referenceFile: '02-gifts-approved.jpeg',
    referenceContext: 'approved PK',
    ...commonMeta,
    tokens: tokens(sheetTop, 12, 8, 8, 62, 0.92),
    sheet: {
      ...nbox(0, sheetTop, W, H - sheetTop),
      topY: round(sheetTop / H),
      bottomY: 1,
      radiusPxApprox: 22,
      radiusN: round(22 / W),
    },
    dragHandle: nbox(323, 876, 65, 5),
    header: {
      myCoins: nbox(16, 892, 270, 50),
      recharge: nbox(476, 900, 172, 40),
      close: nbox(660, 900, 34, 34),
    },
    tabs: nbox(10, 950, 691, 44),
    tabsExpected: ['All Gifts', 'Lucky', 'Popular', 'Love', 'Luxury', 'Fun', 'VIP', 'Festival'],
    wraps: false,
    filterRow: nbox(12, 1000, 687, 38),
    grid: g,
    artworkBoxInCell: { topN: 0.32, heightN: 0.48, sideN: 0.08 },
    footer: nbox(8, 1474, 695, 62),
    footerParts: {
      sendTo: nbox(12, 1482, 168, 46),
      qty: nbox(186, 1486, 88, 38),
      selected: nbox(280, 1482, 118, 46),
      anonymous: nbox(404, 1490, 108, 30),
      sendGift: nbox(518, 1482, 178, 46),
    },
  };
}

function stickersDoc() {
  const sheetTop = 798;
  const g = grid({
    left: 12, top: 908, width: 687, height: 496, cols: 5, rows: 4, gapX: 8, gapY: 8,
    names: STICKER_NAMES,
  });
  return {
    panel: 'stickers',
    referenceFile: '03-stickers-approved.jpeg',
    referenceContext: 'approved PK',
    ...commonMeta,
    tokens: tokens(sheetTop, 12, 8, 8, 118, 1),
    sheet: {
      ...nbox(0, sheetTop, W, H - sheetTop),
      topY: round(sheetTop / H),
      bottomY: 1,
      radiusPxApprox: 22,
      radiusN: round(22 / W),
    },
    dragHandle: nbox(323, 806, 65, 5),
    header: { title: nbox(18, 818, 220, 34) },
    tabs: nbox(12, 860, 572, 38),
    viewToggle: nbox(596, 862, 100, 34),
    tabsExpected: ['All', 'Hi', 'Love', 'Fun', 'Actions', 'Emotions', 'Luxury', 'Special'],
    grid: g,
    artworkBoxInCell: { topN: 0.03, heightN: 0.94, sideN: 0.03 },
    note: 'Sticker labels (Hi!, Good Night, Angry, …) are part of the illustration, not CSS.',
    footer: nbox(8, 1418, 695, 118),
    footerParts: {
      sendTo: nbox(14, 1444, 200, 52),
      qty: nbox(224, 1450, 96, 40),
      sendSticker: nbox(336, 1444, 358, 52),
    },
  };
}

function voiceDoc() {
  const sheetTop = 798;
  const g = grid({
    left: 14, top: 938, width: 683, height: 366, cols: 6, rows: 3, gapX: 10, gapY: 16,
    names: VOICE_NAMES,
  });
  return {
    panel: 'voice',
    referenceFile: '04-voice-changer-approved.jpeg',
    referenceContext: 'approved PK',
    ...commonMeta,
    tokens: tokens(sheetTop, 14, 10, 16, 104, 1),
    sheet: {
      ...nbox(0, sheetTop, W, H - sheetTop),
      topY: round(sheetTop / H),
      bottomY: 1,
      radiusPxApprox: 22,
      radiusN: round(22 / W),
    },
    dragHandle: nbox(323, 806, 65, 5),
    header: {
      title: nbox(18, 816, 300, 34),
      subtitle: nbox(18, 852, 360, 22),
      myVoice: nbox(512, 820, 118, 34),
      close: nbox(660, 820, 34, 34),
    },
    tabs: nbox(12, 886, 560, 40),
    tabsExpected: ['All', 'Popular', 'Character', 'Funny', 'Robot', 'Fantasy', 'Special'],
    grid: g,
    circle: {
      diameterPx: 88,
      diameterN: round(88 / W),
      labelBelowPx: 18,
    },
    artworkBoxInCell: { topN: 0.02, heightN: 0.74, sideN: 0.08 },
    identityNotes: {
      Original: 'pink neon microphone in circle — not a character',
      'Deep Male': 'blue neon microphone in circle — not a male portrait',
      Helium: 'pink balloon in glass sphere',
    },
    controls: {
      voiceEffect: nbox(16, 1312, 679, 54),
      backgroundSound: nbox(16, 1370, 679, 52),
    },
    footer: nbox(8, 1432, 695, 104),
    footerParts: {
      sendTo: nbox(12, 1450, 168, 52),
      qty: nbox(186, 1456, 88, 40),
      preview: nbox(284, 1452, 128, 44),
      applyVoice: nbox(422, 1448, 272, 52),
    },
  };
}

function beautyDoc() {
  const sheetTop = 798;
  const presets = grid({
    left: 12, top: 936, width: 687, height: 118, cols: 6, rows: 1, gapX: 8, gapY: 0,
    names: BEAUTY_PRESETS,
  });
  const sliders = ['Skin Smooth', 'Whiten', 'Sharpen', 'Slim Face', 'Big Eyes', 'Nose', 'Lips', 'Chin'].map((name, i) => {
    const r = Math.floor(i / 4);
    const c = i % 4;
    return { name, ...nbox(12 + c * 174.75, 1064 + r * 96, 166.75, 88) };
  });
  const makeup = ['Lipstick', 'Blush', 'Contour', 'Eyebrow', 'Eyeliner', 'Eyeshadow'].map((name, i) => ({
    name,
    ...nbox(12 + i * 114.5, 1310, 106.5, 96),
  }));
  return {
    panel: 'beauty',
    referenceFile: '05-beauty-effects-approved.jpeg',
    referenceContext: 'approved PK',
    ...commonMeta,
    tokens: tokens(sheetTop, 12, 8, 8, 108, 1),
    sheet: {
      ...nbox(0, sheetTop, W, H - sheetTop),
      topY: round(sheetTop / H),
      bottomY: 1,
      radiusPxApprox: 22,
      radiusN: round(22 / W),
    },
    dragHandle: nbox(323, 806, 65, 5),
    header: {
      title: nbox(18, 816, 280, 32),
      subtitle: nbox(18, 850, 380, 22),
      reset: nbox(532, 820, 100, 34),
      close: nbox(660, 820, 34, 34),
    },
    tabs: nbox(12, 886, 560, 40),
    presets: presets.cells,
    grid: presets,
    sliders,
    sliderLayout: { cols: 4, rows: 2, gapX: 8, gapY: 8 },
    makeup: {
      title: nbox(16, 1276, 200, 28),
      items: makeup,
    },
    artworkBoxInCell: { topN: 0.02, heightN: 0.78, sideN: 0.04 },
    footer: nbox(8, 1428, 695, 108),
    footerParts: {
      sendTo: nbox(12, 1448, 176, 52),
      qty: nbox(196, 1454, 88, 40),
      applyEffect: nbox(300, 1446, 394, 52),
    },
  };
}

function gamesDoc() {
  const sheetTop = 798;
  const g = grid({
    left: 12, top: 936, width: 687, height: 456, cols: 4, rows: 2, gapX: 10, gapY: 12,
    names: GAME_NAMES,
  });
  const utilities = ['Daily Bonus', 'Achievements', 'Leaderboard', 'Invite Friends'].map((name, i) => ({
    name,
    ...nbox(12 + i * 174.75, 1404, 166.75, 72),
  }));
  return {
    panel: 'games',
    referenceFile: '06-game-center-approved.jpeg',
    referenceContext: 'approved PK',
    ...commonMeta,
    tokens: tokens(sheetTop, 12, 10, 10, 104, 1),
    sheet: {
      ...nbox(0, sheetTop, W, H - sheetTop),
      topY: round(sheetTop / H),
      bottomY: 1,
      radiusPxApprox: 22,
      radiusN: round(22 / W),
    },
    dragHandle: nbox(323, 806, 65, 5),
    header: {
      title: nbox(18, 816, 300, 36),
      subtitle: nbox(18, 854, 420, 22),
      diamonds: nbox(512, 820, 118, 34),
      close: nbox(660, 820, 34, 34),
    },
    tabs: nbox(12, 886, 560, 40),
    grid: g,
    artworkBoxInCell: { topN: 0.1, heightN: 0.52, sideN: 0.06 },
    badges: { placement: 'top-left inset of card', items: ['HOT', 'NEW', 'PK'] },
    utilities,
    footer: nbox(8, 1432, 695, 104),
    footerParts: {
      sendTo: nbox(12, 1450, 176, 52),
      qty: nbox(196, 1456, 88, 40),
      playGame: nbox(300, 1448, 394, 52),
    },
  };
}

function artBoxFromCell(cell, inset) {
  const { x, y, w, h } = cell.px;
  const ax = x + w * (inset.sideN ?? 0);
  const ay = y + h * (inset.topN ?? 0);
  const aw = w * (1 - 2 * (inset.sideN ?? 0));
  const ah = h * (inset.heightN ?? 1);
  return { x: Math.round(ax), y: Math.round(ay), w: Math.round(aw), h: Math.round(ah) };
}

async function cropBox(src, box, dest) {
  await sharp(src)
    .extract({
      left: Math.max(0, Math.min(W - 1, box.x)),
      top: Math.max(0, Math.min(H - 1, box.y)),
      width: Math.max(1, Math.min(W - box.x, box.w)),
      height: Math.max(1, Math.min(H - box.y, box.h)),
    })
    .png()
    .toFile(dest);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

async function assetMeta(rel) {
  const p = path.join(assetDir, rel);
  try {
    const m = await sharp(p).metadata();
    return { w: m.width, h: m.height, exists: true };
  } catch {
    return { w: 0, h: 0, exists: false };
  }
}

async function main() {
  fs.mkdirSync(outDocs, { recursive: true });
  fs.mkdirSync(cropDir, { recursive: true });

  const docs = {
    '01-guests.json': guestsDoc(),
    '02-gifts.json': giftsDoc(),
    '03-stickers.json': stickersDoc(),
    '04-voice.json': voiceDoc(),
    '05-beauty.json': beautyDoc(),
    '06-games.json': gamesDoc(),
  };
  for (const [file, doc] of Object.entries(docs)) {
    fs.writeFileSync(path.join(outDocs, file), JSON.stringify(doc, null, 2));
  }

  const auditItems = [];

  async function auditPanel({ panel, file, cells, inset, assetFolder, assetPrefix, problem, notes }) {
    const src = path.join(refDir, file);
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      const box = artBoxFromCell(cell, inset);
      const cropName = `${panel}-${pad(i + 1)}.png`;
      const cropPath = path.join(cropDir, cropName);
      await cropBox(src, box, cropPath);
      const runtimeRel = `${assetFolder}/${assetPrefix}-${pad(i + 1)}.png`;
      const meta = await assetMeta(runtimeRel);
      const replacement = `.local-dev/v14-parity/reference-crops/${cropName}`;
      const item = {
        referencePanel: panel,
        referenceItemName: cell.name,
        currentRuntimeAsset: `/live-tools-v14/${runtimeRel}`,
        runtimePx: { w: meta.w, h: meta.h },
        referenceCropPx: box,
        match: false,
        problem,
        replacementAsset: replacement,
        notes,
      };
      if (!meta.exists) {
        item.problem = 'missing';
        item.currentRuntimeAsset = null;
      }
      auditItems.push(item);
    }
  }

  await auditPanel({
    panel: 'gifts',
    file: '02-gifts-approved.jpeg',
    cells: docs['02-gifts.json'].grid.cells,
    inset: docs['02-gifts.json'].artworkBoxInCell,
    assetFolder: 'gifts',
    assetPrefix: 'gift',
    problem: 'wrong crop',
    notes: 'Screenshot-sliced cell: price pill / card chrome baked in; last column extra-wide. Identity of illustration is correct; crop is not a clean art asset.',
  });
  await auditPanel({
    panel: 'stickers',
    file: '03-stickers-approved.jpeg',
    cells: docs['03-stickers.json'].grid.cells,
    inset: docs['03-stickers.json'].artworkBoxInCell,
    assetFolder: 'stickers',
    assetPrefix: 'sticker',
    problem: 'wrong crop',
    notes: 'Screenshot-sliced card including neighboring-cell pixels and uneven last column. Sticker wordmarks belong in the illustration.',
  });
  await auditPanel({
    panel: 'voice',
    file: '04-voice-changer-approved.jpeg',
    cells: docs['04-voice.json'].grid.cells,
    inset: docs['04-voice.json'].artworkBoxInCell,
    assetFolder: 'voices',
    assetPrefix: 'voice',
    problem: 'wrong crop',
    notes: 'PNG includes CSS chrome (label under circle, selected check). Runtime must be circle art only.',
  });
  const beautyPortraits = docs['05-beauty.json'].presets.filter((p) => p.name !== 'None');
  await auditPanel({
    panel: 'beauty',
    file: '05-beauty-effects-approved.jpeg',
    cells: beautyPortraits,
    inset: docs['05-beauty.json'].artworkBoxInCell,
    assetFolder: 'beauty',
    assetPrefix: 'beauty',
    problem: 'wrong crop',
    notes: 'PNG includes preset label + check + adjacent-card bars. Runtime must be portrait crop only.',
  });
  await auditPanel({
    panel: 'games',
    file: '06-game-center-approved.jpeg',
    cells: docs['06-games.json'].grid.cells,
    inset: docs['06-games.json'].artworkBoxInCell,
    assetFolder: 'games',
    assetPrefix: 'game',
    problem: 'wrong crop',
    notes: 'PNG includes HOT/NEW/PK badge and cut-off title. Runtime must be illustration only; badge/title are CSS.',
  });

  const audit = {
    generatedAt: new Date().toISOString(),
    referenceSizePx: { width: W, height: H },
    method: 'Visual Y-strip inspection of approved JPEGs + locked equal-column grids. Runtime PNGs compared by looking at each file against the corresponding reference cell (not filename).',
    counts: {
      total: auditItems.length,
      match: auditItems.filter((x) => x.match).length,
      fail: auditItems.filter((x) => !x.match).length,
    },
    summary: {
      gifts: '15/15 identity OK as Lucky Bill…Phoenix; all 15 fail crop (screenshot slices, baked price pills, last-col extra width).',
      stickers: '20/20 unicorn identities OK vs labels; all 20 fail crop (neighbor bleed, last-col extra width).',
      voice: '18/18 identities OK (Original/Deep Male are neon mics; Helium is balloon). All 18 fail crop (baked labels/checks).',
      beauty: '5/5 preset names present; all 5 fail crop (baked labels/checks, adjacent bars).',
      games: '8/8 identities OK (Treasure Box is a chest, Fishing Master is a shark). All 8 fail crop (baked badges/titles).',
    },
    items: auditItems,
  };
  fs.writeFileSync(path.join(outDocs, 'artwork-audit-v14.json'), JSON.stringify(audit, null, 2));
  console.log(JSON.stringify({
    wrote: Object.keys(docs),
    audit: audit.counts,
    sheetTops: {
      guests: docs['01-guests.json'].sheet.px.y,
      gifts: docs['02-gifts.json'].sheet.px.y,
      stickers: docs['03-stickers.json'].sheet.px.y,
      voice: docs['04-voice.json'].sheet.px.y,
      beauty: docs['05-beauty.json'].sheet.px.y,
      games: docs['06-games.json'].sheet.px.y,
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
