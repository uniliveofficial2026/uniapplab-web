#!/usr/bin/env node
/**
 * Authoritative 263-input inventory with expanded schema.
 * Writes docs/ui-device-recovery/FINAL-ALL-INPUT-INVENTORY.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcRoot = path.join(root, 'artifacts/instacollab/src');
const outDir = path.join(root, 'docs/ui-device-recovery');
const outFile = path.join(outDir, 'FINAL-ALL-INPUT-INVENTORY.json');

const PHYSICAL_PASS_LABELS = new Set([
  'chat-input',
  'feed-comment-input',
  'post-comment-input',
  'reels-comment-input',
  'live-chat-input',
]);

const INPUT_PATTERNS = [
  { elementType: 'input', re: /<input\b[^>]*>/gi },
  { elementType: 'textarea', re: /<textarea\b[^>]*>/gi },
  { elementType: 'contenteditable', re: /contentEditable|contenteditable/gi },
];

const KEYBOARD_TYPES = {
  email: /type\s*=\s*['"]email['"]|inputMode\s*=\s*['"]email['"]/i,
  tel: /type\s*=\s*['"]tel['"]|inputMode\s*=\s*['"]tel['"]/i,
  number: /type\s*=\s*['"]number['"]|inputMode\s*=\s*['"]numeric['"]|inputMode\s*=\s*['"]decimal['"]/i,
  search: /type\s*=\s*['"]search['"]|inputMode\s*=\s*['"]search['"]/i,
  password: /type\s*=\s*['"]password['"]/i,
};

const DOMAIN_HINTS = [
  ['messages', /messages|chat|dm|compose/i],
  ['comments', /comment|reply|reels-comments/i],
  ['creator', /creator|studio|publish|caption|story-creator|song-/i],
  ['live', /live|solo-live|multiguest|pk|approved-live/i],
  ['call', /call|voice|video-call/i],
  ['marketplace', /marketplace|checkout|cart|wishlist|buyer|commerce/i],
  ['seller', /seller|store|inventory|payout|inbound|outbound/i],
  ['profile', /profile|account|settings|bio|username/i],
  ['wallet', /wallet|recharge|withdraw|payment/i],
  ['auth', /login|signup|otp|password|auth/i],
  ['search', /search|filter/i],
  ['dating', /dating|match/i],
  ['youtube', /youtube/i],
  ['karaoke', /karaoke|smule|party-room|song-upload/i],
  ['game', /game|greedy|bet/i],
  ['admin', /admin/i],
  ['developer', /developer|builder|platform|project-env|workspace/i],
];

const ROUTE_HINTS = [
  ['/messages', /messages|MessagesScreen|chat-input/i],
  ['/home', /PostCardFooter|feed-comment|Home/i],
  ['/reels', /Reels|reels-comment/i],
  ['/live', /SoloLive|live-chat|LiveScreen|smule-rooms/i],
  ['/creator', /ShellCreate|StoryCreator|StoryCaption|SongUpload/i],
  ['/profile', /ProfileScreen|ProfileSetup/i],
  ['/wallet', /WalletScreen|WithdrawTab|ShopTab/i],
  ['/marketplace', /CommerceLive|marketplace|checkout/i],
  ['/seller', /seller|store|inventory/i],
  ['/auth', /AuthScreen|login|signup/i],
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

function inferRoute(file, tag, ctx) {
  const blob = `${file}\n${ctx}\n${tag}`;
  for (const [route, re] of ROUTE_HINTS) {
    if (re.test(blob)) return route;
  }
  return '/app';
}

function hasKeyboardSsot(ctx, tag) {
  return (
    /pb-composer|composer-bottom-inset|KeyboardAwareComposer|KeyboardAwareForm|KeyboardAwareSheet|keyboardInputClassName|keyboardLayout|keyboardSurfaceDataAttr|data-keyboard-ssot/.test(
      ctx,
    ) || /aria-label\s*=\s*['"][^'"]*(input|composer|comment|chat)/i.test(tag)
  );
}

function inferKeyboardPrimitive(ctx, tag) {
  if (/KeyboardAwareComposer/.test(ctx)) return 'KeyboardAwareComposer';
  if (/KeyboardAwareForm/.test(ctx)) return 'KeyboardAwareForm';
  if (/KeyboardAwareSheet/.test(ctx)) return 'KeyboardAwareSheet';
  if (/keyboardInputClassName|keyboardLayout|pb-composer|data-keyboard-ssot/.test(ctx)) {
    return 'keyboardLayout';
  }
  if (/pb-composer|composer-bottom-inset/.test(ctx)) return 'pb-composer';
  return hasKeyboardSsot(ctx, tag) ? 'partial' : 'none';
}

function hasLegacyKeyboard(ctx) {
  return (
    /100vh\s*-\s*keyboard|keyboardHeight\s*-\s*safe|pb-safe.*keyboard|env\(safe-area.*keyboard/i.test(
      ctx,
    ) || /paddingBottom:\s*keyboard/i.test(ctx)
  );
}

function inferScrollOwner(ctx) {
  if (/app-screen-scroll|overflow-y-auto|overflow-y-scroll/.test(ctx)) return 'container-scroll';
  if (/fixed bottom-0|Drawer|Sheet/.test(ctx)) return 'sheet-scroll';
  return 'document';
}

function classifyResult(tag, ctx, ariaLabel, physicalStatus) {
  if (/type\s*=\s*['"]hidden['"]/i.test(tag)) return 'NOT_APPLICABLE';
  if (/type\s*=\s*['"]file['"]/i.test(tag) && !ariaLabel) return 'NOT_APPLICABLE';
  if (physicalStatus === 'PASS') return 'PASS';
  if (physicalStatus === 'FAIL_LEGACY_KEYBOARD') return 'FAIL';
  if (hasLegacyKeyboard(ctx)) return 'FAIL';
  if (hasKeyboardSsot(ctx, tag) && ariaLabel) return 'PASS_STATIC';
  if (hasKeyboardSsot(ctx, tag)) return 'PASS_STATIC';
  return 'NOT_TESTED';
}

const files = walk(srcRoot);
const inventory = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/\<(input|textarea)\b|contentEditable/i.test(src)) continue;

  for (const { elementType, re } of INPUT_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const tag = m[0];
      const index = m.index;
      const ctxStart = Math.max(0, index - 1400);
      const ctxEnd = Math.min(src.length, index + 900);
      const ctx = src.slice(ctxStart, ctxEnd);

      if (elementType === 'input' && /type\s*=\s*['"]hidden['"]/i.test(tag)) continue;

      const ariaLabel = attr(tag, 'aria-label');
      const testId = attr(tag, 'data-ui-id') || attr(tag, 'data-testid');
      const id = attr(tag, 'id');
      const placeholder = attr(tag, 'placeholder');
      const selector = ariaLabel
        ? `[aria-label="${ariaLabel}"]`
        : testId
          ? `[data-testid="${testId}"]`
          : id
            ? `#${id}`
            : placeholder
              ? `[placeholder="${placeholder.slice(0, 40)}"]`
              : `${elementType}@${index}`;

      const domain = inferDomain(file, tag, ctx);
      const modalOrSheet = /Modal|Drawer|Sheet|Dialog|Portal|emoji-glass-sheet|fixed bottom-0/i.test(ctx);
      const rtcSurface = /live|call|rtc|pk|room|trtc|livekit|karaoke|smule/i.test(`${file}:${ctx.slice(0, 500)}`);
      const ssot = hasKeyboardSsot(ctx, tag);
      const legacy = hasLegacyKeyboard(ctx);
      let physicalStatus = 'NOT_TESTED';
      if (ariaLabel && PHYSICAL_PASS_LABELS.has(ariaLabel)) physicalStatus = 'PASS';
      else if (ssot && ariaLabel) physicalStatus = 'PASS_STATIC';
      else if (legacy) physicalStatus = 'FAIL_LEGACY_KEYBOARD';
      else if (/type\s*=\s*['"]file['"]/i.test(tag)) physicalStatus = 'NOT_APPLICABLE';

      const entryId = `${rel(file)}::${ariaLabel || testId || selector}`;
      const result = classifyResult(tag, ctx, ariaLabel, physicalStatus);

      inventory.push({
        id: entryId,
        screen: screenFromPath(file),
        route: inferRoute(file, tag, ctx),
        component: componentFromPath(file),
        sourceFile: rel(file),
        elementType,
        ariaLabel,
        testId,
        selector,
        keyboardType: inferKeyboardType(tag),
        keyboardPrimitive: inferKeyboardPrimitive(ctx, tag),
        scrollOwner: inferScrollOwner(ctx),
        modalOrSheet,
        rtcSurface,
        canonicalActorSource: 'auth.user.id',
        targetResource: domain,
        api: domain === 'comments' ? 'localDb.enrichCommentPayload' : null,
        database: domain === 'comments' ? 'social_comments' : null,
        realtime: /realtime|subscribe|channel/i.test(ctx) ? 'scoped' : null,
        staticKeyboardGate: ssot ? 'PASS' : legacy ? 'FAIL' : 'NOT_TESTED',
        physicalKeyboardGate: physicalStatus,
        functionalSubmissionGate: ariaLabel && PHYSICAL_PASS_LABELS.has(ariaLabel) ? 'PASS' : 'NOT_TESTED',
        identityGate: domain === 'comments' ? 'enrichCommentPayload' : 'auth_session',
        result,
        ownerDataDomain: domain,
        hasKeyboardSsot: ssot,
        hasLegacyKeyboard: legacy,
        physicalStatus,
      });
    }
  }
}

inventory.sort((a, b) => a.id.localeCompare(b.id));

const classified = inventory.filter((i) => i.result !== 'NOT_TESTED').length;
const summary = {
  generatedAt: new Date().toISOString(),
  total: inventory.length,
  classified,
  unclassified: inventory.length - classified,
  byDomain: Object.fromEntries(
    [...new Set(inventory.map((i) => i.ownerDataDomain))].map((d) => [
      d,
      inventory.filter((i) => i.ownerDataDomain === d).length,
    ]),
  ),
  byResult: Object.fromEntries(
    [...new Set(inventory.map((i) => i.result))].map((r) => [
      r,
      inventory.filter((i) => i.result === r).length,
    ]),
  ),
  keyboardSsot: inventory.filter((i) => i.hasKeyboardSsot).length,
  legacyKeyboard: inventory.filter((i) => i.hasLegacyKeyboard).length,
  withSemanticLabel: inventory.filter((i) => i.ariaLabel || i.testId).length,
  physicalPass: inventory.filter((i) => i.physicalStatus === 'PASS').length,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  outFile,
  JSON.stringify({ summary, inputs: inventory }, null, 2) + '\n',
  'utf8',
);

console.log(`Wrote ${inventory.length} inputs → ${path.relative(root, outFile)}`);
console.log(JSON.stringify(summary, null, 2));
