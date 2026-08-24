/**
 * Visual regression lock — structural fingerprints of approved UI surfaces.
 * Unexpected layout/class/geometry churn = FAIL (no redesign allowed).
 * Stage A: Live + Messages + Calls + Marketplace/Seller/Orders + PK.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  const p = join(root, rel);
  assert.ok(existsSync(p), `missing ${rel}`);
  return readFileSync(p, 'utf8');
}

const SURFACES = [
  // —— Live (existing approved) ——
  {
    name: 'GiftPlayOverlay',
    path: 'src/smule-rooms/components/GiftPlayOverlay.tsx',
    mustInclude: [
      'pointer-events-none absolute inset-0 z-[120]',
      'ComboBarrage',
      'ActiveGiftEffect',
    ],
  },
  {
    name: 'PartyGiftPickerPanel',
    path: 'src/smule-rooms/components/PartyGiftPickerPanel.tsx',
    mustInclude: ['PartyGiftPickerPanel'],
  },
  {
    name: 'SoloLiveView',
    path: 'src/smule-rooms/components/SoloLiveView.tsx',
    mustInclude: ['SoloLiveView', 'approved-live-overlay-canvas'],
  },
  {
    name: 'V15LiveRoomChrome',
    path: 'src/smule-rooms/components/V15LiveRoomChrome.tsx',
    mustInclude: ['V15LiveRoomChrome', 'live.approved.room-chrome'],
  },
  {
    name: 'LiveBeautySheet',
    path: 'src/smule-rooms/components/LiveBeautySheet.tsx',
    mustInclude: ['LiveBeautySheet'],
  },
  {
    name: 'MultiGuestView',
    path: 'src/smule-rooms/components/MultiGuestView.tsx',
    mustInclude: ['MultiGuestView'],
  },

  // —— Messages ——
  {
    name: 'MessagesScreen',
    path: 'src/components/messages/MessagesScreen.tsx',
    mustInclude: [
      'id="messages-screen"',
      'MessagesSidebar',
      'messages-chat-column',
    ],
  },

  // —— Calls ——
  {
    name: 'OutgoingCallStage',
    path: 'src/components/messages/OutgoingCallStage.tsx',
    mustInclude: [
      'call.outgoing.v1',
      'call.outgoing.video.v1',
      'call-approved-screen',
    ],
  },
  {
    name: 'IncomingCallDynamicBanner',
    path: 'src/components/messages/IncomingCallDynamicBanner.tsx',
    mustInclude: [
      'call.incoming.v1',
      'call.incoming.accept',
      'call.incoming.decline',
    ],
  },
  {
    name: 'CallApprovedChrome',
    path: 'src/components/messages/CallApprovedChrome.tsx',
    mustInclude: ['call-approved-island', 'call.incoming.dynamic-island'],
  },
  {
    name: 'MessagesActiveCallOverlay',
    path: 'src/components/messages/MessagesActiveCallOverlay.tsx',
    mustInclude: [
      'call.1v1.video.active',
      'call.group.video.active',
      'call.1v1.video.local-pip',
    ],
  },

  // —— Marketplace ——
  {
    name: 'ShellMarketplace',
    path: 'src/components/layout/Shell.tsx',
    mustInclude: ['Creator Marketplace', 'vibe-gradient-text'],
  },
  {
    name: 'CommerceLivePanel',
    path: 'src/smule-rooms/components/CommerceLivePanel.tsx',
    mustInclude: ['commerce.host.panel', 'commerce.viewer.panel'],
  },

  // —— Seller ——
  {
    name: 'ShopTabSeller',
    path: 'src/components/wallet/ShopTab.tsx',
    mustInclude: ['Seller Console', 'Gross Seller Receipts', 'shopMode'],
  },

  // —— Orders ——
  {
    name: 'CommerceOrdersWorkspace',
    path: 'src/smule-rooms/components/CommerceOrdersWorkspace.tsx',
    mustInclude: [
      'commerce.orders.',
      'Manage Orders',
      'ul-orders-workspace',
    ],
  },
  {
    name: 'CommerceOrdersPage',
    path: 'src/smule-rooms/components/CommerceOrdersPage.tsx',
    mustInclude: ['CommerceOrdersWorkspace', "role === 'host'"],
  },

  // —— PK ——
  {
    name: 'OneVsOnePkRoom',
    path: 'src/components/live/OneVsOnePkRoom.tsx',
    mustInclude: [
      'live.pk.1v1.room',
      'u1pk-camera-stage',
      'ONE_VS_ONE_PK_UI_IDS',
    ],
  },
  {
    name: 'TeamPkRoom',
    path: 'src/components/live/TeamPkRoom.tsx',
    mustInclude: [
      'live.pk.team.room',
      'live.pk.team.captains',
      'live.pk.team.score.bar',
      'live.pk.team.action.end-pk',
    ],
  },
  {
    name: 'PkLiveOverlay',
    path: 'src/components/live/PkLiveOverlay.tsx',
    mustInclude: [
      'live.pk.1v1.challenge.overlay',
      'live.pk.team.challenge.overlay',
    ],
  },
];

for (const surface of SURFACES) {
  test(`visual lock: ${surface.name} structure preserved`, () => {
    const src = read(surface.path);
    for (const needle of surface.mustInclude) {
      assert.ok(src.includes(needle), `${surface.name} missing fingerprint: ${needle}`);
    }
    // No temporary placeholder redesign markers
    assert.equal(/TODO redesign|placeholder UI|temp layout/i.test(src), false);
  });
}

test('visual lock: gift overlay still uses approved bottom combo + stage layout classes', () => {
  const src = read('src/smule-rooms/components/GiftPlayOverlay.tsx');
  assert.ok(src.includes('bottom-[calc(5.5rem+env(safe-area-inset-bottom))]'));
  assert.ok(src.includes('Mythic ·'));
});

test('visual lock: V15 live chrome keeps approved data-ui-id contract', () => {
  const src = read('src/smule-rooms/components/V15LiveRoomChrome.tsx');
  assert.ok(src.includes('data-ui-id="live.approved.room-chrome"'));
  assert.ok(src.includes('live.approved.realtime-indicator'));
});

test('visual lock: Team PK keeps topology grids 4v4 and 6v6', () => {
  const src = read('src/components/live/TeamPkRoom.tsx');
  assert.ok(src.includes('live.pk.team.4v4.grid'));
  assert.ok(src.includes('live.pk.team.6v6.grid'));
  assert.ok(src.includes('live.pk.team.members'));
});
