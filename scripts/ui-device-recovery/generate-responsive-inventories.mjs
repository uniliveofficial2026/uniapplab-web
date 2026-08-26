#!/usr/bin/env node
/**
 * Generates responsive recovery inventories from router + source scan.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const app = path.join(root, 'artifacts/instacollab');
const outDir = path.join(root, 'docs/ui-device-recovery');

function read(rel) {
  return fs.readFileSync(path.join(app, rel), 'utf8');
}

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', 'dist', 'generated'].includes(ent.name)) continue;
      walk(full, acc);
    } else if (/\.(tsx|ts|css)$/.test(ent.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const TAB_PATH_BLOCK = read('src/lib/appShellRoutes.ts').match(
  /export const TAB_PATH[^=]+=\s*\{([\s\S]*?)\};/,
)?.[1] || '';

const SCREENS = [];
for (const m of TAB_PATH_BLOCK.matchAll(/(\w[\w-]*):\s*'([^']+)'/g)) {
  SCREENS.push({
    screenId: m[1],
    route: m[2],
    component: `${m[1]}Tab`,
    mobileSupported: true,
    tabletSupported: true,
    desktopSupported: true,
    scrollOwner: m[1] === 'reels' || m[1] === 'live' ? 'screen' : 'main',
    headerType: 'shell',
    bottomNav: !['rooms', 'greedy-tap'].includes(m[1]),
    safeAreaTop: 'shell',
    safeAreaBottom: 'shell',
    keyboardInputs: 'varies',
    modals: 'varies',
    hardware: m[1] === 'live' || m[1] === 'rooms' ? ['camera', 'mic'] : [],
    functionalActions: ['navigate', 'render'],
    status: 'INDEXED',
  });
}

const EXTRA_SCREENS = [
  { screenId: 'splash', route: '/splash', component: 'SplashScreen', scrollOwner: 'none' },
  { screenId: 'onboarding', route: '/onboarding', component: 'OnboardingScreen', scrollOwner: 'screen' },
  { screenId: 'auth', route: '/auth', component: 'AuthScreen', scrollOwner: 'screen' },
  { screenId: 'trending', route: '/trending', component: 'TrendingScreen', scrollOwner: 'screen' },
  { screenId: 'post-modal', route: 'overlay:post', component: 'PostModal', scrollOwner: 'modal-body' },
  { screenId: 'solo-live', route: '/room/solo', component: 'SoloLiveView', scrollOwner: 'screen' },
  { screenId: 'marketplace', route: 'overlay:marketplace', component: 'CommerceLivePanel', scrollOwner: 'sheet' },
  { screenId: 'seller-center', route: '/seller', component: 'SellerCenter', scrollOwner: 'main' },
  { screenId: 'admin', route: '/admin', component: 'AdminPanel', scrollOwner: 'main' },
  { screenId: 'notifications', route: '/notifications', component: 'NotificationsScreen', scrollOwner: 'main' },
];

for (const s of EXTRA_SCREENS) {
  SCREENS.push({
    mobileSupported: true,
    tabletSupported: true,
    desktopSupported: true,
    headerType: s.screenId.includes('live') ? 'immersive' : 'shell',
    bottomNav: !['solo-live', 'post-modal', 'auth', 'splash', 'onboarding'].includes(s.screenId),
    safeAreaTop: s.screenId.includes('live') ? 'immersive-chrome' : 'shell',
    safeAreaBottom: s.screenId.includes('live') ? 'composer' : 'shell',
    keyboardInputs: 'varies',
    modals: 'varies',
    hardware: s.screenId.includes('live') ? ['camera', 'mic'] : [],
    functionalActions: ['render'],
    status: 'INDEXED',
    ...s,
  });
}

const srcFiles = walk(path.join(app, 'src'));
const viewportHackPatterns = [
  { id: '100vh', re: /\b100vh\b/g },
  { id: 'h-screen', re: /\bh-screen\b/g },
  { id: 'min-h-screen', re: /\bmin-h-screen\b/g },
  { id: 'innerHeight', re: /window\.innerHeight/g },
  { id: 'visualViewport', re: /visualViewport/g },
  { id: 'raw-safe-area', re: /env\(safe-area-inset/g },
  { id: 'keyboardHeight', re: /keyboardHeight|keyboardWillShow|keyboardDidShow/g },
  { id: 'position-fixed', re: /position:\s*fixed|position:\s*['"]fixed['"]|\bfixed\b/g },
  { id: 'position-sticky', re: /position:\s*sticky|\bsticky\b/g },
];

const viewportHacks = [];
for (const file of srcFiles) {
  const rel = path.relative(app, file);
  const text = fs.readFileSync(file, 'utf8');
  for (const pat of viewportHackPatterns) {
    const matches = text.match(pat.re);
    if (matches?.length) {
      viewportHacks.push({
        file: rel,
        pattern: pat.id,
        count: matches.length,
        classification:
          pat.id === 'raw-safe-area' && /safeArea\.ts|index\.css/.test(rel)
            ? 'SSOT_OWNER'
            : pat.id === 'visualViewport' && /safeArea\.ts/.test(rel)
              ? 'SSOT_OWNER'
              : pat.id === 'raw-safe-area'
                ? 'REVIEW_TOKEN_MIGRATION'
                : 'REVIEW',
      });
    }
  }
}

const MODAL_PATTERNS = [
  { re: /<Dialog\b|<Modal\b|<Drawer\b|SheetContent|BottomSheet|AccountSwitcherModal|PostModal|ShellCreateModal/g, type: 'modal' },
];
const modals = [];
for (const file of srcFiles.filter((f) => f.endsWith('.tsx'))) {
  const rel = path.relative(app, file);
  const text = fs.readFileSync(file, 'utf8');
  for (const pat of MODAL_PATTERNS) {
    if (pat.re.test(text)) {
      modals.push({
        route: rel.replace(/^src\//, '').replace(/\.tsx$/, ''),
        component: path.basename(rel, '.tsx'),
        maxWidth: 'viewport',
        maxHeight: 'var(--app-vv-height)',
        scrollOwner: 'modal-body',
        safeTop: 'var(--app-safe-top)',
        safeBottom: 'var(--app-composer-bottom-inset)',
        keyboardAware: /keyboardLayout|pb-composer|composer-bottom-inset/i.test(text),
        physicalStatus: 'NOT_TESTED',
      });
    }
  }
}

const scrollOwnerMatrix = SCREENS.map((s) => ({
  route: s.route,
  screenId: s.screenId,
  rootScrollOwner: s.scrollOwner === 'main' ? '#root > main' : 'screen',
  nestedScrollOwner: s.scrollOwner === 'modal-body' ? '.modal-body' : null,
  sheetScrollOwner: s.scrollOwner === 'sheet' ? '.sheet-body' : null,
  keyboardScrollOwner: /live|messages|comment|modal/.test(s.screenId)
    ? 'nearest-scroll-container'
    : null,
}));

const componentGeometry = [
  {
    screen: 'shell',
    component: 'mobile-bottom-nav',
    selector: '.mobile-bottom-nav',
    role: 'bottomNav',
    safeBounds: 'above --app-safe-bottom',
    overflow: 'none',
    overlap: 'none',
    minTouchSize: 44,
    textOverflow: 'truncate',
    status: 'INDEXED',
  },
  {
    screen: 'messages',
    component: 'chat-composer',
    selector: '[data-testid="chat-input"]',
    role: 'composer',
    safeBounds: '--app-composer-bottom-inset',
    overflow: 'none',
    overlap: 'none',
    minTouchSize: 44,
    textOverflow: 'ellipsis',
    status: 'INDEXED',
  },
  {
    screen: 'live',
    component: 'live-chat-input',
    selector: '[data-testid="live-chat-input"]',
    role: 'composer',
    safeBounds: '--app-composer-bottom-inset',
    overflow: 'none',
    overlap: 'none',
    minTouchSize: 44,
    textOverflow: 'ellipsis',
    status: 'INDEXED',
  },
];

const generatedAt = new Date().toISOString();

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'FINAL-SCREEN-INVENTORY.json'),
  JSON.stringify({ generatedAt, count: SCREENS.length, screens: SCREENS }, null, 2),
);
fs.writeFileSync(
  path.join(outDir, 'FINAL-SCROLL-OWNER-MATRIX.json'),
  JSON.stringify({ generatedAt, count: scrollOwnerMatrix.length, entries: scrollOwnerMatrix }, null, 2),
);
fs.writeFileSync(
  path.join(outDir, 'FINAL-MODAL-GEOMETRY-MATRIX.json'),
  JSON.stringify({ generatedAt, count: modals.length, modals }, null, 2),
);
fs.writeFileSync(
  path.join(outDir, 'FINAL-COMPONENT-GEOMETRY-MATRIX.json'),
  JSON.stringify(
    { generatedAt, count: componentGeometry.length, components: componentGeometry },
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(outDir, 'VIEWPORT-HACK-AUDIT.json'),
  JSON.stringify(
    {
      generatedAt,
      count: viewportHacks.length,
      ssotOwners: viewportHacks.filter((h) => h.classification === 'SSOT_OWNER').length,
      review: viewportHacks.filter((h) => h.classification !== 'SSOT_OWNER').length,
      entries: viewportHacks,
    },
    null,
    2,
  ),
);

fs.writeFileSync(
  path.join(outDir, 'FINAL-SAFE-AREA-MATRIX.json'),
  JSON.stringify(
    {
      generatedAt,
      entries: SCREENS.map((s) => ({
        screenId: s.screenId,
        route: s.route,
        topSafeArea: s.safeAreaTop,
        bottomSafeArea: s.safeAreaBottom,
        keyboardOpen: 'composer-inset',
        keyboardClosed: 'static-safe-bottom',
        modal: s.screenId.includes('modal') ? 'sheet-safe-top' : 'inherit',
        sheet: s.scrollOwner === 'sheet' ? 'vv-max-height' : 'none',
        status: 'INDEXED',
      })),
    },
    null,
    2,
  ),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      screens: SCREENS.length,
      scrollOwners: scrollOwnerMatrix.length,
      modals: modals.length,
      components: componentGeometry.length,
      viewportHacks: viewportHacks.length,
    },
    null,
    2,
  ),
);
