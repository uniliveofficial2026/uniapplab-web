#!/usr/bin/env node
/**
 * Scans instacollab source for editable surfaces and writes
 * docs/ui-device-recovery/FINAL-ALL-INPUT-INVENTORY.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcRoot = path.join(root, 'artifacts/instacollab/src');
const outDir = path.join(root, 'docs/ui-device-recovery');
const outFile = path.join(outDir, 'FINAL-ALL-INPUT-INVENTORY.json');

const INPUT_PATTERNS = [
  { type: 'input', re: /<input\b[^>]*>/gi },
  { type: 'textarea', re: /<textarea\b[^>]*>/gi },
  { type: 'contenteditable', re: /contentEditable|contenteditable/gi },
];

const KEYBOARD_TYPES = {
  email: /type\s*=\s*['"]email['"]|inputMode\s*=\s*['"]email['"]/i,
  tel: /type\s*=\s*['"]tel['"]|inputMode\s*=\s*['"]tel['"]/i,
  number: /type\s*=\s*['"]number['"]|inputMode\s*=\s*['"]numeric['"]|inputMode\s*=\s*['"]decimal['"]/i,
  search: /type\s*=\s*['"]search['"]|inputMode\s*=\s*['"]search['"]/i,
  password: /type\s*=\s*['"]password['"]/i,
};

const MODAL_HINTS = /Modal|Drawer|Sheet|Dialog|Portal|Popover|emoji-glass-sheet/i;
const RTC_HINTS = /live|call|rtc|pk|room|trtc|livekit|karaoke|smule/i;
const DOMAIN_HINTS = [
  ['messages', /messages|chat|dm|compose/i],
  ['comments', /comment|reply|reels-comments/i],
  ['creator', /creator|studio|publish|caption/i],
  ['live', /live|solo-live|multiguest|pk/i],
  ['call', /call|voice|video-call/i],
  ['marketplace', /marketplace|checkout|cart|wishlist|buyer/i],
  ['seller', /seller|store|inventory|payout|inbound|outbound/i],
  ['profile', /profile|account|settings|bio|username/i],
  ['wallet', /wallet|recharge|withdraw|payment/i],
  ['auth', /login|signup|otp|password|auth/i],
  ['search', /search|filter/i],
  ['dating', /dating|match/i],
  ['youtube', /youtube/i],
  ['karaoke', /karaoke|smule|party-room/i],
  ['game', /game|greedy|bet/i],
  ['admin', /admin/i],
  ['developer', /developer|builder|platform|project-env/i],
];

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist') continue;
      walk(full, acc);
    } else if (/\.(tsx|ts|jsx|js)$/.test(ent.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function rel(file) {
  return path.relative(path.join(root, 'artifacts/instacollab'), file).replace(/\\/g, '/');
}

function screenFromPath(file) {
  const r = rel(file);
  const parts = r.split('/');
  if (parts[0] === 'src' && parts[1] === 'components') return parts.slice(2, 4).join('/') || parts[2] || r;
  if (parts[0] === 'src' && parts[1] === 'smule-rooms') return `smule-rooms/${parts[2] || ''}`.replace(/\/$/, '');
  if (parts[0] === 'src' && parts[1] === 'pages') return `pages/${parts[2] || ''}`.replace(/\/$/, '');
  return r;
}

function componentFromPath(file) {
  return path.basename(file, path.extname(file));
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*['"]([^'"]+)['"]`, 'i'));
  return m?.[1] ?? null;
}

function inferKeyboardType(tag) {
  for (const [kind, re] of Object.entries(KEYBOARD_TYPES)) {
    if (re.test(tag)) return kind;
  }
  return 'text';
}

function inferDomain(file, tag, ctx) {
  const blob = `${file}\n${ctx}\n${tag}`;
  for (const [domain, re] of DOMAIN_HINTS) {
    if (re.test(blob)) return domain;
  }
  return 'general';
}

function hasKeyboardSsot(ctx, tag) {
  return (
    /pb-composer|composer-bottom-inset|KeyboardAwareComposer|keyboardInputClassName|keyboardLayout/.test(
      ctx,
    ) || /aria-label\s*=\s*['"][^'"]*(input|composer|comment|chat)/i.test(tag)
  );
}

function hasLegacyKeyboard(ctx) {
  return (
    /100vh\s*-\s*keyboard|keyboardHeight\s*-\s*safe|pb-safe.*keyboard|env\(safe-area.*keyboard/i.test(
      ctx,
    ) || /paddingBottom:\s*keyboard/i.test(ctx)
  );
}

function inferPhysicalStatus(tag, ctx) {
  if (/aria-label\s*=\s*['"]chat-input['"]/.test(tag)) return 'PASS';
  if (/aria-label\s*=\s*['"](feed|post|reels)-comment-input['"]/.test(tag)) return 'PASS_STATIC';
  if (hasKeyboardSsot(ctx, tag)) return 'PASS_STATIC';
  if (hasLegacyKeyboard(ctx)) return 'FAIL_LEGACY_KEYBOARD';
  if (/type\s*=\s*['"]hidden['"]/.test(tag)) return 'NOT_APPLICABLE';
  return 'NOT_TESTED';
}

const files = walk(srcRoot);
const inventory = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/\<(input|textarea)\b|contentEditable/i.test(src)) continue;

  for (const { type, re } of INPUT_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const tag = m[0];
      const index = m.index;
      const ctxStart = Math.max(0, index - 1200);
      const ctxEnd = Math.min(src.length, index + 800);
      const ctx = src.slice(ctxStart, ctxEnd);

      if (type === 'input' && /type\s*=\s*['"]hidden['"]/i.test(tag)) continue;
      if (type === 'input' && /type\s*=\s*['"]file['"]/i.test(tag)) continue;

      const aria = attr(tag, 'aria-label');
      const dataUi = attr(tag, 'data-ui-id') || attr(tag, 'data-testid');
      const id = attr(tag, 'id');
      const placeholder = attr(tag, 'placeholder');
      const selector = aria
        ? `[aria-label="${aria}"]`
        : dataUi
          ? `[data-ui-id="${dataUi}"]`
          : id
            ? `#${id}`
            : placeholder
              ? `[placeholder="${placeholder.slice(0, 40)}"]`
              : `${type}@${index}`;

      inventory.push({
        screen: screenFromPath(file),
        component: componentFromPath(file),
        sourceFile: rel(file),
        type,
        selector,
        keyboardType: inferKeyboardType(tag),
        insideModal: MODAL_HINTS.test(ctx),
        insideSheet: /Drawer|Sheet|emoji-glass-sheet|fixed bottom-0/i.test(ctx),
        insideRtcSurface: RTC_HINTS.test(`${file}:${ctx.slice(0, 400)}`),
        ownerDataDomain: inferDomain(file, tag, ctx),
        hasKeyboardSsot: hasKeyboardSsot(ctx, tag),
        hasLegacyKeyboard: hasLegacyKeyboard(ctx),
        physicalStatus: inferPhysicalStatus(tag, ctx),
      });
    }
  }
}

inventory.sort((a, b) =>
  `${a.sourceFile}:${a.selector}`.localeCompare(`${b.sourceFile}:${b.selector}`),
);

const summary = {
  generatedAt: new Date().toISOString(),
  total: inventory.length,
  byDomain: Object.fromEntries(
    [...new Set(inventory.map((i) => i.ownerDataDomain))].map((d) => [
      d,
      inventory.filter((i) => i.ownerDataDomain === d).length,
    ]),
  ),
  keyboardSsot: inventory.filter((i) => i.hasKeyboardSsot).length,
  legacyKeyboard: inventory.filter((i) => i.hasLegacyKeyboard).length,
  notTested: inventory.filter((i) => i.physicalStatus === 'NOT_TESTED').length,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  outFile,
  JSON.stringify({ summary, inputs: inventory }, null, 2) + '\n',
  'utf8',
);

console.log(`Wrote ${inventory.length} inputs → ${path.relative(root, outFile)}`);
console.log(JSON.stringify(summary, null, 2));
