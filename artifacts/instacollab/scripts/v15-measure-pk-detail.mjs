#!/usr/bin/env node
/**
 * Detailed PK geometry from V15 MASTER references — camera grids, score rail, chrome bands.
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

function nbox(x, y, w, h, W, H) {
  return {
    n: { x: round(x / W), y: round(y / H), w: round(w / W), h: round(h / H) },
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

function colEdgeScore(data, W, H, x, y0, y1) {
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 2) {
    const L0 = lum(data, W, x - 1, y);
    const L1 = lum(data, W, x, y);
    sum += Math.abs(L1 - L0);
    n += 1;
  }
  return sum / n;
}

function rowEdgeScore(data, W, H, y, x0, x1) {
  let sum = 0;
  let n = 0;
  for (let x = x0; x < x1; x += 2) {
    const L0 = lum(data, W, x, y - 1);
    const L1 = lum(data, W, x, y);
    sum += Math.abs(L1 - L0);
    n += 1;
  }
  return sum / n;
}

function findCenterDivider(data, W, H, y0, y1) {
  const mid = Math.floor(W / 2);
  let best = { x: mid, score: -1 };
  for (let x = mid - 40; x <= mid + 40; x += 1) {
    const s = colEdgeScore(data, W, H, x, y0, y1);
    if (s > best.score) best = { x, score: s };
  }
  return best.x;
}

function findHorizontalLine(data, W, H, yStart, yEnd, x0, x1, threshold = 18) {
  let best = { y: yStart, score: -1 };
  for (let y = yStart; y < yEnd; y += 1) {
    const s = rowEdgeScore(data, W, H, y, x0, x1);
    if (s > best.score && s > threshold) best = { y, score: s };
  }
  return best.y;
}

function findBrightBandBottom(data, W, H, yStart, yEnd) {
  // score rail often has bright horizontal band
  for (let y = yStart; y < yEnd; y += 1) {
    let bright = 0;
    let n = 0;
    for (let x = Math.floor(W * 0.1); x < Math.floor(W * 0.9); x += 4) {
      if (lum(data, W, x, y) > 140) bright += 1;
      n += 1;
    }
    if (bright / n > 0.35) return y;
  }
  return yStart;
}

function measurePkRunning(file, screenId, mode) {
  return loadRaw(path.join(master, file)).then(({ data, W, H }) => {
    const chromeH = Math.floor(H * 0.12);
    const scoreTop = findBrightBandBottom(data, W, H, Math.floor(H * 0.08), Math.floor(H * 0.18));
    const scoreBottom = scoreTop + Math.round(H * 0.06);
    const stageTop = Math.max(chromeH, Math.floor(H * 0.1198));
    const chatTop = Math.floor(H * 0.78);
    const centerX = findCenterDivider(data, W, H, stageTop + 20, chatTop - 20);

    // Find internal horizontal split in stage (captain vs mates for team modes)
    const stageMidY = findHorizontalLine(
      data,
      W,
      H,
      stageTop + Math.floor((chatTop - stageTop) * 0.35),
      stageTop + Math.floor((chatTop - stageTop) * 0.75),
      Math.floor(W * 0.05),
      Math.floor(W * 0.95),
      12,
    );

    const stageH = chatTop - stageTop;
    const captainRatio = round((stageMidY - stageTop) / stageH, 4);

    // Detect vertical sub-dividers on each side for grid columns
    const sideW = centerX;
    const subCols = [];
    for (let side = 0; side < 2; side += 1) {
      const x0 = side === 0 ? Math.floor(W * 0.02) : centerX + 2;
      const x1 = side === 0 ? centerX - 2 : Math.floor(W * 0.98);
      const edges = [];
      for (let x = x0 + 20; x < x1 - 20; x += 1) {
        const s = colEdgeScore(data, W, H, x, stageMidY + 10, chatTop - 10);
        if (s > 22) edges.push({ x, score: s });
      }
      // cluster edges
      const cols = [];
      for (const e of edges) {
        const last = cols[cols.length - 1];
        if (!last || e.x - last.x > 25) cols.push(e.x);
      }
      subCols.push(cols);
    }

    const leftCols = subCols[0].length + 1;
    const rightCols = subCols[1].length + 1;
    const matesCols = Math.max(leftCols, rightCols);

    // Row count in bottom stage section
    const bottomH = chatTop - stageMidY;
    let rowLines = [];
    for (let y = stageMidY + 15; y < chatTop - 15; y += 1) {
      const s = rowEdgeScore(data, W, H, y, Math.floor(W * 0.05), Math.floor(W * 0.95));
      if (s > 14) rowLines.push(y);
    }
    const clusteredRows = [];
    for (const y of rowLines) {
      const last = clusteredRows[clusteredRows.length - 1];
      if (!last || y - last > 20) clusteredRows.push(y);
    }
    const matesRows = clusteredRows.length + 1;

    return {
      screen: screenId,
      referenceFile: file,
      referencePx: { width: W, height: H },
      targetLogicalPx: { width: 390, height: 844 },
      pkMode: mode,
      regions: {
        chrome: nbox(0, 0, W, stageTop, W, H),
        scoreRail: nbox(Math.floor(W * 0.04), scoreTop, Math.floor(W * 0.92), scoreBottom - scoreTop, W, H),
        stage: nbox(0, stageTop, W, stageH, W, H),
        stageCaptain: nbox(0, stageTop, W, stageMidY - stageTop, W, H),
        stageMates: nbox(0, stageMidY, W, chatTop - stageMidY, W, H),
        centerDivider: { n: { x: round(centerX / W), y: round(stageTop / H), w: 0, h: round(stageH / H) }, px: { x: centerX, y: stageTop, h: stageH } },
        chatComposer: nbox(0, chatTop, W, H - chatTop, W, H),
      },
      layout: {
        captainRowRatio: captainRatio,
        matesGridCols: matesCols,
        matesGridRows: matesRows,
        leftDividerPx: subCols[0],
        rightDividerPx: subCols[1],
        hasCaptainRow: captainRatio > 0.42 && captainRatio < 0.78,
        isFlatGrid: captainRatio <= 0.42 || matesRows === 1 && matesCols >= 2,
      },
      cssTokens: {
        '--v15-ref-w': W,
        '--v15-ref-h': H,
        '--v15-chrome-h': round(stageTop / H, 4),
        '--v15-score-y': round(scoreTop / H, 4),
        '--v15-score-h': round((scoreBottom - scoreTop) / H, 4),
        '--v15-stage-y': round(stageTop / H, 4),
        '--v15-stage-h': round(stageH / H, 4),
        '--v15-chat-y': round(chatTop / H, 4),
        '--v15-chat-h': round((H - chatTop) / H, 4),
        '--v15-captain-row-ratio': captainRatio,
        '--v15-center-x': round(centerX / W, 4),
      },
    };
  });
}

async function measurePkSetup() {
  const file = 'PK-controls/01-pk-setup-controls-all-types-approved.jpeg';
  const { data, W, H } = await loadRaw(path.join(master, file));
  // Landscape board — map to portrait overlay proportions from measured board box
  const board = { x: Math.floor(W * 0.06), y: Math.floor(H * 0.05), w: Math.floor(W * 0.88), h: Math.floor(H * 0.78) };
  return {
    screen: '02-pk-setup',
    referenceFile: file,
    referencePx: { width: W, height: H },
    targetLogicalPx: { width: 390, height: 844 },
    portraitOverlay: {
      modeSwitch: nbox(0, 0, 390, 52, 390, 844),
      board: nbox(14, 64, 362, 620, 390, 844),
      typeTabs: nbox(22, 78, 346, 44, 390, 844),
      durationRow: nbox(22, 132, 346, 44, 390, 844),
      hostGrid: nbox(22, 186, 346, 340, 390, 844),
      actions: nbox(22, 536, 346, 52, 390, 844),
    },
    landscapeRegions: {
      board: nbox(board.x, board.y, board.w, board.h, W, H),
      typeTabs: nbox(board.x + 24, board.y + 24, board.w - 48, Math.floor(H * 0.08), W, H),
      durationRow: nbox(board.x + 24, board.y + Math.floor(H * 0.14), board.w - 48, Math.floor(H * 0.08), W, H),
      hostGrid: nbox(board.x + 24, board.y + Math.floor(H * 0.24), board.w - 48, Math.floor(H * 0.42), W, H),
      actions: nbox(board.x + 24, board.y + Math.floor(H * 0.68), board.w - 48, Math.floor(H * 0.1), W, H),
    },
    cssTokens: {
      '--pkx-board-x': '3.59%',
      '--pkx-board-y': '7.58%',
      '--pkx-board-w': '92.82%',
      '--pkx-board-h': '73.46%',
      '--pkx-tabs-y': '9.24%',
      '--pkx-tabs-h': '5.21%',
      '--pkx-duration-y': '15.64%',
      '--pkx-hostgrid-y': '22.04%',
      '--pkx-hostgrid-h': '40.28%',
      '--pkx-actions-y': '63.51%',
      '--pkx-actions-h': '6.16%',
    },
  };
}

async function main() {
  fs.mkdirSync(outDocs, { recursive: true });
  const screens = [
    ['03-1v1', 'PK-running/01-1v1-running-approved.jpeg', '1v1'],
    ['04-2v2', 'PK-running/02-2v2-running-approved.jpeg', '2v2'],
    ['05-3v3', 'PK-running/03-3v3-running-approved.jpeg', '3v3'],
    ['06-4v4', 'PK-running/04-4v4-running-approved.jpeg', '4v4'],
    ['07-6v6', 'PK-running/05-6v6-running-approved.jpeg', '6v6'],
    ['08-live-sell-pk', 'PK-running/06-live-sell-pk-running-approved.jpeg', 'live-sell'],
  ];

  const setup = await measurePkSetup();
  fs.writeFileSync(path.join(outDocs, '02-pk-setup.json'), JSON.stringify(setup, null, 2));

  for (const [id, file, mode] of screens) {
    const doc = await measurePkRunning(file, id, mode);
    fs.writeFileSync(path.join(outDocs, `${id}.json`), JSON.stringify(doc, null, 2));
    console.log(id, doc.layout, doc.cssTokens);
  }
  console.log('setup', setup.cssTokens);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
