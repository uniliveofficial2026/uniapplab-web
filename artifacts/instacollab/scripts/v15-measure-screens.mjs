#!/usr/bin/env node
/**
 * Measure V15 MASTER screens beyond live-tool sheets:
 * live room chrome, PK setup, PK running (1v1–6v6, live sell), commerce.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pkgRoot = path.resolve(root, '../..');
const master = path.join(pkgRoot, 'UniLives-Final-Approved-UIUX-Production-Cursor-v15/reference-approved/MASTER');
const outDocs = path.join(root, 'docs/v15-visual-spec');

function round(n, d = 4) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function nbox(x, y, w, h, refW, refH) {
  return {
    n: { x: round(x / refW), y: round(y / refH), w: round(w / refW), h: round(h / refH) },
    px: { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) },
  };
}

async function loadRaw(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}

function lum(data, W, x, y) {
  const i = (y * W + x) * 3;
  return (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
}

function rowAvg(data, W, y, x0, x1) {
  let sum = 0;
  let n = 0;
  for (let x = x0; x < x1; x += 2) {
    sum += lum(data, W, x, y);
    n += 1;
  }
  return sum / n;
}

function findHorizontalBand(data, W, H, opts) {
  const { yStart, yEnd, threshold, mode = 'bright' } = opts;
  for (let y = yStart; y < yEnd; y += 1) {
    const avg = rowAvg(data, W, y, Math.floor(W * 0.08), Math.floor(W * 0.92));
    const hit = mode === 'bright' ? avg > threshold : avg < threshold;
    if (hit) return y;
  }
  return yStart;
}

async function measurePortraitRef({ file, context, screenId, extras = {} }) {
  const src = path.join(master, file);
  const { data, W, H } = await loadRaw(src);
  const chromeBottom = findHorizontalBand(data, W, H, {
    yStart: Math.floor(H * 0.04),
    yEnd: Math.floor(H * 0.22),
    threshold: 95,
    mode: 'bright',
  });
  const scoreTop = findHorizontalBand(data, W, H, {
    yStart: Math.floor(H * 0.1),
    yEnd: Math.floor(H * 0.35),
    threshold: 120,
    mode: 'bright',
  });
  const footerTop = findHorizontalBand(data, W, H, {
    yStart: Math.floor(H * 0.78),
    yEnd: H - 2,
    threshold: 42,
    mode: 'dark',
  });

  return {
    screen: screenId,
    referenceFile: file,
    referenceContext: context,
    referencePx: { width: W, height: H },
    targetLogicalPx: { width: 390, height: 844 },
    scaleTo390: round(W / 390, 4),
    regions: {
      chrome: nbox(0, 0, W, Math.max(chromeBottom + 48, Math.floor(H * 0.12)), W, H),
      scoreRail: nbox(Math.floor(W * 0.04), scoreTop, Math.floor(W * 0.92), Math.floor(H * 0.06), W, H),
      stage: nbox(0, Math.floor(H * 0.12), W, footerTop - Math.floor(H * 0.12), W, H),
      chatComposer: nbox(0, footerTop, W, H - footerTop, W, H),
    },
    notes: [
      'Normalized x/y/w/h relative to reference pixel dimensions.',
      'Use as layout source of truth; do not use JPEG as runtime background.',
    ],
    ...extras,
  };
}

async function measurePkSetup() {
  const file = 'PK-controls/01-pk-setup-controls-all-types-approved.jpeg';
  const src = path.join(master, file);
  const { data, W, H } = await loadRaw(src);
  const boardTop = findHorizontalBand(data, W, H, {
    yStart: Math.floor(H * 0.05),
    yEnd: Math.floor(H * 0.45),
    threshold: 38,
    mode: 'dark',
  });
  return {
    screen: '02-pk-setup',
    referenceFile: file,
    referenceContext: 'PK invite / setup board (landscape master)',
    referencePx: { width: W, height: H },
    targetLogicalPx: { width: 390, height: 844 },
    scaleTo390: round(W / 390, 4),
    regions: {
      board: nbox(Math.floor(W * 0.06), boardTop, Math.floor(W * 0.88), Math.floor(H * 0.78), W, H),
      typeTabs: nbox(Math.floor(W * 0.08), boardTop + 24, Math.floor(W * 0.84), Math.floor(H * 0.08), W, H),
      durationRow: nbox(Math.floor(W * 0.08), boardTop + Math.floor(H * 0.14), Math.floor(W * 0.84), Math.floor(H * 0.08), W, H),
      hostGrid: nbox(Math.floor(W * 0.08), boardTop + Math.floor(H * 0.24), Math.floor(W * 0.84), Math.floor(H * 0.42), W, H),
      actions: nbox(Math.floor(W * 0.08), boardTop + Math.floor(H * 0.68), Math.floor(W * 0.84), Math.floor(H * 0.1), W, H),
    },
    notes: ['Landscape master; runtime PKInviteSheet scales to mobile portrait.'],
  };
}

async function measureLiveRoomFromGifts() {
  const giftsSpec = JSON.parse(
    fs.readFileSync(path.join(outDocs, '02-gifts.json'), 'utf8'),
  );
  const sheetTopN = giftsSpec.sheet.topY;
  const W = giftsSpec.referencePx.width;
  const H = giftsSpec.referencePx.height;
  const sheetTopPx = Math.round(sheetTopN * H);
  return {
    screen: '01-live-room',
    referenceFile: 'live-tools/02-gifts-approved.jpeg',
    referenceContext: 'Live room chrome above gifts sheet (video + header + chat band)',
    referencePx: { width: W, height: H },
    targetLogicalPx: { width: 390, height: 844 },
    scaleTo390: round(W / 390, 4),
    regions: {
      chrome: nbox(0, 0, W, Math.floor(H * 0.11), W, H),
      videoStage: nbox(0, Math.floor(H * 0.08), W, sheetTopPx - Math.floor(H * 0.08), W, H),
      chatBand: nbox(0, Math.floor(sheetTopPx - H * 0.08), W, Math.floor(H * 0.08), W, H),
      footerTray: nbox(0, H - Math.floor(H * 0.056), W, Math.floor(H * 0.056), W, H),
    },
    derivedFrom: '02-gifts.json sheet.topY',
    notes: ['Live room measured from gifts MASTER top chrome region.'],
  };
}

async function main() {
  fs.mkdirSync(outDocs, { recursive: true });

  const renames = [
    ['01-guests.json', '11-guests.json'],
    ['02-gifts.json', '09-gifts.json'],
    ['03-stickers.json', '10-stickers.json'],
    ['04-voice.json', '12-voice.json'],
    ['05-beauty.json', '13-beauty.json'],
    ['06-games.json', '14-games.json'],
  ];
  for (const [from, to] of renames) {
    const src = path.join(outDocs, from);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(outDocs, to));
    }
  }

  const pkRunning = [
    ['03-1v1', 'PK-running/01-1v1-running-approved.jpeg', '1v1 PK running'],
    ['04-2v2', 'PK-running/02-2v2-running-approved.jpeg', '2v2 team PK running'],
    ['05-3v3', 'PK-running/03-3v3-running-approved.jpeg', '3v3 team PK running'],
    ['06-4v4', 'PK-running/04-4v4-running-approved.jpeg', '4v4 team PK running'],
    ['07-6v6', 'PK-running/05-6v6-running-approved.jpeg', '6v6 team PK running'],
    ['08-live-sell-pk', 'PK-running/06-live-sell-pk-running-approved.jpeg', 'Live Sell PK running'],
  ];

  const written = [];
  written.push('01-live-room');
  fs.writeFileSync(
    path.join(outDocs, '01-live-room.json'),
    JSON.stringify(await measureLiveRoomFromGifts(), null, 2),
  );

  written.push('02-pk-setup');
  fs.writeFileSync(
    path.join(outDocs, '02-pk-setup.json'),
    JSON.stringify(await measurePkSetup(), null, 2),
  );

  for (const [id, file, context] of pkRunning) {
    written.push(id);
    fs.writeFileSync(
      path.join(outDocs, `${id}.json`),
      JSON.stringify(
        await measurePortraitRef({ file, context, screenId: id, extras: { pkMode: id } }),
        null,
        2,
      ),
    );
  }

  const commerce = [
    ['15-buyer-live-sell', 'live-selling/01-live-sell-stream-approved.jpeg', 'Buyer live sell stream'],
    ['16-host-orders', 'live-selling/02-host-orders-panel-approved.jpeg', 'Host orders panel'],
    ['17-buyer-orders', 'live-selling/04-orders-outside-live-approved.jpeg', 'Buyer orders outside live'],
  ];
  for (const [id, file, context] of commerce) {
    written.push(id);
    fs.writeFileSync(
      path.join(outDocs, `${id}.json`),
      JSON.stringify(await measurePortraitRef({ file, context, screenId: id }), null, 2),
    );
  }

  fs.writeFileSync(
    path.join(outDocs, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        package: 'UniLives-Final-Approved-UIUX-Production-Cursor-v15',
        screens: [
          '01-live-room',
          '02-pk-setup',
          '03-1v1',
          '04-2v2',
          '05-3v3',
          '06-4v4',
          '07-6v6',
          '08-live-sell-pk',
          '09-gifts',
          '10-stickers',
          '11-guests',
          '12-voice',
          '13-beauty',
          '14-games',
          '15-buyer-live-sell',
          '16-host-orders',
          '17-buyer-orders',
        ],
        written,
      },
      null,
      2,
    ),
  );

  console.log(JSON.stringify({ written }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
