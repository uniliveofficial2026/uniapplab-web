/**
 * Stage A — source contracts for auth-/code-gated mount surfaces
 * (PK invite sheet, Team PK, Admin Control Center, reel video element wiring).
 * No secrets / no E2E login. Run: node --test test/stage-a-mount-contracts.test.mjs
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

test('contract: PKInviteSheet exposes approved invite/setup ui ids', () => {
  const src = read('src/smule-rooms/components/PKInviteSheet.tsx');
  assert.match(src, /data-ui-id=\{`live\.pk\.setup\.\$\{setupType\}`\}/);
  assert.match(src, /data-ui-id="live\.pk\.invite\.panel"/);
  assert.match(src, /data-ui-id="live\.pk\.setup\.overlay"/);
  assert.match(src, /export function PKInviteSheet/);
});

test('contract: Room wires PKInviteSheet open state (no authless public route)', () => {
  const src = read('src/smule-rooms/pages/Room.tsx');
  assert.match(src, /PKInviteSheet/);
  assert.match(src, /isPkInviteOpen/);
  assert.match(src, /setIsPkInviteOpen\(true\)/);
});

test('contract: Team PK + 1v1 PK room surfaces keep approved data-ui-ids', () => {
  const team = read('src/components/live/TeamPkRoom.tsx');
  const one = read('src/components/live/OneVsOnePkRoom.tsx');
  assert.match(team, /live\.pk\.team\.room/);
  assert.match(team, /live\.pk\.team\.4v4\.grid/);
  assert.match(team, /live\.pk\.team\.6v6\.grid/);
  assert.match(one, /live\.pk\.1v1\.room/);
});

test('contract: Workspace admin panel is access-code gated (no secretless E2E)', () => {
  const gate = read('src/components/workspace/WorkspaceGate.tsx');
  const access = read('src/lib/workspaceAccess.ts');
  const screen = read('src/components/workspace/WorkspaceScreen.tsx');
  const admin = read('src/components/admin/AdminControlCenter.tsx');
  assert.match(gate, /Workspace always requires the staff access code/);
  assert.match(gate, /WorkspaceAuthScreen/);
  assert.match(access, /verifyWorkspaceAccessCode/);
  assert.match(screen, /AdminControlCenter/);
  assert.match(screen, /id="btn-workspace-admin-portal"/);
  assert.match(admin, /export function AdminControlCenter/);
  assert.match(admin, /System overview/);
  // Do not assert the staff code value — secrets stay out of smoke claims.
  assert.doesNotMatch(gate, /1998/);
});

test('contract: Admin embed gift-preview host is a secretless admin route', () => {
  const host = read('src/components/admin/AdminEmbedGiftPreviewHost.tsx');
  const app = read('src/App.tsx');
  assert.match(host, /data-admin-embed-gift-preview/);
  assert.match(host, /AdminEmbedGiftPreviewHost/);
  assert.match(app, /admin-embed\/gift-preview/);
  assert.match(app, /AdminEmbedGiftPreviewHost/);
});

test('contract: ReelsScreen mounts AppNativeVideo for video slides', () => {
  const reels = read('src/components/reels/ReelsScreen.tsx');
  const video = read('src/components/common/AppNativeVideo.tsx');
  assert.match(reels, /data-reel-snap-item/);
  assert.match(reels, /data-reel-index=/);
  assert.match(reels, /AppNativeVideo/);
  assert.match(reels, /showVideoSlide/);
  assert.match(video, /<video/);
  assert.match(video, /data-playback-scope/);
});

test('contract: Outgoing call approved chrome ids remain wired', () => {
  const stage = read('src/components/messages/OutgoingCallStage.tsx');
  const chrome = read('src/components/messages/CallApprovedChrome.tsx');
  const provider = read('src/contexts/ChatCallProviderImpl.tsx');
  const overlay = read('src/components/messages/MessagesActiveCallOverlay.tsx');
  assert.match(stage, /call\.outgoing\.v1/);
  assert.match(stage, /call\.outgoing\.video\.v1/);
  assert.match(chrome, /call\.outgoing\.dynamic-island/);
  assert.match(provider, /CallDynamicIsland/);
  assert.match(provider, /MessagesActiveCallOverlay/);
  assert.match(overlay, /OutgoingCallStage/);
});
