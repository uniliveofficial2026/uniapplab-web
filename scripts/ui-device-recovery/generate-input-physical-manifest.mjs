#!/usr/bin/env node
/** Generates physical XCUITest manifest from inventory semantic labels. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
spawnSync('node', ['scripts/ui-device-recovery/generate-input-inventory.mjs'], {
  cwd: root,
  stdio: 'inherit',
});

const { inputs } = JSON.parse(
  fs.readFileSync(path.join(root, 'docs/ui-device-recovery/FINAL-ALL-INPUT-INVENTORY.json'), 'utf8'),
);

const PRIORITY = [
  'chat-input',
  'feed-comment-input',
  'post-comment-input',
  'reels-comment-input',
  'live-chat-input',
  'creator-caption-input',
  'creator-story-caption-input',
  'creator-song-title-input',
];

const cases = [];
const seen = new Set();
for (const label of PRIORITY) {
  const hit = inputs.find((i) => i.ariaLabel === label);
  if (hit) {
    cases.push({
      id: hit.id,
      ariaLabel: label,
      route: hit.route,
      screen: hit.screen,
      rtcSurface: hit.rtcSurface,
      modalOrSheet: hit.modalOrSheet,
      physicalStatus: hit.physicalStatus,
    });
    seen.add(label);
  }
}

for (const input of inputs) {
  if (!input.ariaLabel || seen.has(input.ariaLabel)) continue;
  if (input.result === 'NOT_APPLICABLE') continue;
  if (!input.ariaLabel.endsWith('-input') && !input.ariaLabel.includes('composer')) continue;
  cases.push({
    id: input.id,
    ariaLabel: input.ariaLabel,
    route: input.route,
    screen: input.screen,
    rtcSurface: input.rtcSurface,
    modalOrSheet: input.modalOrSheet,
    physicalStatus: input.physicalStatus,
  });
  seen.add(input.ariaLabel);
}

const outFile = path.join(root, 'docs/ui-device-recovery/INPUT-PHYSICAL-MANIFEST.json');
fs.writeFileSync(
  outFile,
  JSON.stringify({ generatedAt: new Date().toISOString(), cases }, null, 2) + '\n',
  'utf8',
);
console.log(`Wrote ${cases.length} physical cases → ${path.relative(root, outFile)}`);
