#!/usr/bin/env node
/**
 * Stage B unit/integration suite — FakeRTC + orchestrators + platform + MCP auth.
 * Does not require LiveKit Cloud.
 */
import assert from 'node:assert/strict';
import { createFakeRTCProvider } from '../lib/unilives-rtc-fake/index.mjs';
import { createUniLiveRTC } from '../lib/unilives-rtc-client/index.mjs';
import {
  createCallOrchestrator,
  createPkOrchestrator,
  createSeatOrchestrator,
  createRtcRuntime,
  createEventEnvelope,
} from '../lib/unilives-rtc-core/index.mjs';
import { createQoeGovernor, publishProfileForQoe } from '../lib/unilives-rtc-qoe/index.mjs';
import { createRtcGrant, normalizeProviderWebhook } from '../lib/unilives-rtc-server/index.mjs';
import {
  createControlPlaneStore,
  createProviderRegistry,
  createProjectGraph,
  createRtcUsageMeter,
  createTraceContext,
} from '../lib/unilives-platform-core/index.mjs';
import { createUniLive } from '../lib/unilives-sdk/index.mjs';
import { createUniLiveMcpServer } from '../lib/unilives-mcp/index.mjs';
import { createUniLiveCli } from '../lib/unilives-cli/index.mjs';
import { createUniLiveAuth } from '../lib/unilives-auth/index.mjs';
import { createUniLiveRealtime } from '../lib/unilives-realtime/index.mjs';
import { createUniLiveDeploy } from '../lib/unilives-deploy/index.mjs';
import { createUniLiveGit } from '../lib/unilives-git/index.mjs';
import { permissionsForRole } from '../lib/unilives-rtc-contracts/index.mjs';

let failed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`PASS ${name}`))
    .catch((err) => {
      failed += 1;
      console.error(`FAIL ${name}`, err);
    });
}

await test('fake_provider_join_publish', async () => {
  const provider = createFakeRTCProvider({ identity: 'u1', roomType: 'CALL_1_TO_1' });
  const rtc = createUniLiveRTC({ provider, roomType: 'CALL_1_TO_1' });
  const room = await rtc.joinRoom({
    roomId: 'call-room-1',
    token: 't',
    url: 'fake://',
    canonicalUserId: 'u1',
    role: 'caller',
  });
  assert.equal(room.connection, 'CONNECTED');
  const cam = await room.enableCamera({});
  assert.equal(cam.kind, 'video');
  await room.leave();
});

await test('provider_unavailable_does_not_destroy_business_state', async () => {
  const provider = createFakeRTCProvider({ unavailable: true });
  const calls = createCallOrchestrator();
  const call = calls.create({ callerId: 'a', calleeId: 'b' });
  assert.equal(call.state, 'RINGING');
  await assert.rejects(() => provider.joinRoom({ roomName: 'x', token: 't', url: 'fake://' }));
  assert.equal(calls.get(call.callSessionId).state, 'RINGING');
});

await test('call_orchestrator_stale_accept_and_dedupe', async () => {
  const orch = createCallOrchestrator();
  const call = orch.create({ callerId: 'a', calleeId: 'b', callSessionId: 'c1' });
  orch.applySignal({ callSessionId: 'c1', signalId: 's1', type: 'cancel' });
  const stale = orch.applySignal({ callSessionId: 'c1', signalId: 's2', type: 'accept' });
  assert.equal(stale.ignored, true);
  assert.equal(stale.reason, 'stale_accept');
  const dup = orch.applySignal({ callSessionId: 'c1', signalId: 's1', type: 'cancel' });
  assert.equal(dup.duplicate, true);
});

await test('pk_gift_score_idempotent', async () => {
  const pk = createPkOrchestrator();
  pk.start({ roomId: 'r1', hostUserId: 'host', opponentUserId: 'opp' });
  const a = pk.applyGiftScore({ roomId: 'r1', recipientUserId: 'host', points: 10, giftEventId: 'g1' });
  const b = pk.applyGiftScore({ roomId: 'r1', recipientUserId: 'host', points: 10, giftEventId: 'g1' });
  assert.equal(a.applied, true);
  assert.equal(b.duplicate, true);
  assert.equal(a.localScore, 10);
  assert.equal(b.localScore, 10);
});

await test('seat_orchestrator_accept', async () => {
  const seats = createSeatOrchestrator({ maxSeats: 4 });
  seats.requestJoin({ roomId: 'live1', userId: 'g1', seatIndex: 1 });
  const seat = seats.accept({ roomId: 'live1', seatIndex: 1, actorUserId: 'host' });
  assert.equal(seat.state, 'occupied');
  assert.equal(seat.occupantUserId, 'g1');
  assert.equal(seat.permissions.canPublishAudio, true);
});

await test('qoe_hysteresis_and_profiles', async () => {
  const g = createQoeGovernor('GOOD');
  const mid = g.update({ packetLoss: 0.06, rttMs: 250 });
  assert.equal(mid.state, 'DEGRADING');
  assert.equal(publishProfileForQoe('CRITICAL', { thermal: 'critical' }), 'LOW');
});

await test('rtc_grant_permissions', async () => {
  const grant = createRtcGrant({ canonicalUserId: 'u', roomId: 'r', role: 'viewer' });
  assert.equal(grant.permissions.canPublishVideo, false);
  const host = createRtcGrant({ canonicalUserId: 'u', roomId: 'r', role: 'host' });
  assert.equal(host.permissions.canPublishVideo, true);
  assert.deepEqual(permissionsForRole('guest').canPublishAudio, true);
});

await test('webhook_normalization_idempotent_id', async () => {
  const e = normalizeProviderWebhook({
    provider: 'livekit',
    providerEventId: 'evt-9',
    type: 'participant_joined',
    roomId: 'r',
    participantIdentity: 'u',
  });
  assert.equal(e.eventId, 'livekit:evt-9');
  assert.equal(e.eventType, 'RTCParticipantJoined');
});

await test('usage_meter_idempotent', async () => {
  const m = createRtcUsageMeter();
  m.apply({ eventId: '1', type: 'room_started', roomId: 'r', roomType: 'LIVE' });
  const dup = m.apply({ eventId: '1', type: 'room_started', roomId: 'r', roomType: 'LIVE' });
  assert.equal(dup.duplicate, true);
  assert.equal(m.rollup().metrics.roomCount, 1);
});

await test('control_plane_and_sdk', async () => {
  const cp = createControlPlaneStore();
  const org = cp.createOrganization({ name: 'o', actor: 't' });
  const project = cp.createProject({ organizationId: org.organizationId, name: 'p', actor: 't' });
  const cred = cp.createApiCredential({ projectId: project.projectId, kind: 'mcp', scopes: ['*'], actor: 't' });
  const uni = createUniLive({
    projectId: project.projectId,
    controlPlane: cp,
    credentialPublicId: cred.publicId,
    provider: createFakeRTCProvider({ identity: 'sdk' }),
  });
  assert.equal(uni.authorize('project:read').ok, true);
  const graph = uni.projectGraph.addPage({ path: '/', title: 'Home' });
  assert.ok(graph.pageId);
  assert.ok(createTraceContext({ roomId: 'r' }).traceId);
});

await test('mcp_requires_auth', async () => {
  const cp = createControlPlaneStore();
  const org = cp.createOrganization({ name: 'o', actor: 't' });
  const project = cp.createProject({ organizationId: org.organizationId, name: 'p', actor: 't' });
  const denied = createUniLiveMcpServer({ controlPlane: cp, requireAuth: true });
  const r1 = await denied.callTool('list_projects', {});
  assert.equal(r1.ok, false);
  const cred = cp.createApiCredential({
    projectId: project.projectId,
    kind: 'mcp',
    scopes: ['*'],
    actor: 't',
  });
  const allowed = createUniLiveMcpServer({
    controlPlane: cp,
    credentialPublicId: cred.publicId,
    requireAuth: true,
  });
  const r2 = await allowed.callTool('list_projects', {});
  assert.equal(r2.ok, true);
  const room = await allowed.callTool('create_rtc_room', { roomId: 'mcp-r1', projectId: project.projectId });
  assert.equal(room.ok, true);
});

await test('cli_doctor_and_rtc_status', async () => {
  const cli = createUniLiveCli({ cwd: process.cwd() });
  const doc = await cli.doctor();
  assert.equal(doc.ok, true);
  const rtc = await cli.rtcStatus();
  assert.equal(rtc.ok, true);
});

await test('auth_memory_and_realtime_lanes', async () => {
  const auth = createUniLiveAuth({ adapter: 'memory' });
  const signed = await auth.signIn({ email: 'a@b.c', password: 'x' });
  assert.ok(signed.user.canonicalUserId.startsWith('person_'));
  const rt = createUniLiveRealtime();
  let got = null;
  rt.subscribe('likes', (m) => {
    got = m;
  });
  await rt.publish({ topic: 'likes', lane: 'LOSS_TOLERANT', payload: { n: 1 } });
  assert.equal(got.payload.n, 1);
  const env = createEventEnvelope({
    eventType: 'x',
    lane: 'SERVER_AUTHORITATIVE',
    eventClass: 'AUTHORITATIVE_EVENT',
  });
  assert.equal(env.lane, 'SERVER_AUTHORITATIVE');
});

await test('deploy_git_registry', async () => {
  const cp = createControlPlaneStore();
  const org = cp.createOrganization({ name: 'o', actor: 't' });
  const project = cp.createProject({ organizationId: org.organizationId, name: 'p', actor: 't' });
  const env = cp.listEnvironments(project.projectId)[0];
  const deploy = createUniLiveDeploy({ controlPlane: cp });
  const d = await deploy.start({
    projectId: project.projectId,
    environmentId: env.environmentId,
    gitSha: 'abc123',
    actor: 't',
  });
  await deploy.complete(d.deploymentId, { providerDeploymentId: 'v1', actor: 't' });
  const git = createUniLiveGit({ repository: { fullName: 'org/repo' } });
  assert.equal((await git.getRepository()).fullName, 'org/repo');
  assert.ok(createProviderRegistry().resolve('rtc').provider === 'livekit');
  assert.ok(createProjectGraph({ projectId: project.projectId }).toJSON().version === 1);
});

await test('live_runtime_end_to_end_fake', async () => {
  const provider = createFakeRTCProvider({ identity: 'host' });
  const runtime = createRtcRuntime({ provider });
  const started = await runtime.liveOrchestrator.start({
    roomId: 'live-e2e',
    hostUserId: 'host',
    token: 't',
    url: 'fake://',
  });
  assert.ok(started.session.roomSessionId);
  await runtime.liveOrchestrator.end({ roomId: 'live-e2e' });
});

await test('livekit_import_boundary_scan', async () => {
  const { execSync } = await import('node:child_process');
  const { LIVEKIT_CLIENT_IMPORT_ALLOWLIST, LIVEKIT_SERVER_IMPORT_ALLOWLIST } = await import(
    './livekit-import-allowlist.mjs'
  );
  const root = new URL('..', import.meta.url).pathname;
  function scan(pattern) {
    return execSync(`rg -l "${pattern}" artifacts/instacollab/src lib artifacts/api-server/src supabase/functions --glob '!**/node_modules/**' || true`, {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  function offenders(files, allow) {
    return files.filter((f) => !allow.some((a) => f.includes(a)));
  }
  const clientFiles = scan(`from ['\\"]livekit-client['\\"]|import\\(['\\"]livekit-client['\\"]\\)`);
  const clientOff = offenders(clientFiles, LIVEKIT_CLIENT_IMPORT_ALLOWLIST);
  assert.equal(clientOff.length, 0, `unauthorized livekit-client imports:\n${clientOff.join('\n')}`);
  const serverFiles = scan(`from ['\\"]livekit-server-sdk['\\"]|import\\(['\\"]livekit-server-sdk['\\"]\\)`);
  const serverOff = offenders(serverFiles, LIVEKIT_SERVER_IMPORT_ALLOWLIST);
  assert.equal(serverOff.length, 0, `unauthorized livekit-server-sdk imports:\n${serverOff.join('\n')}`);
  console.log(
    `  livekit-client sites=${clientFiles.length}; livekit-server-sdk sites=${serverFiles.length} (allowlisted)`,
  );
});

if (failed) {
  console.error(`\nStage B tests failed: ${failed}`);
  process.exit(1);
}
console.log('\nStage B unit suite PASS');
