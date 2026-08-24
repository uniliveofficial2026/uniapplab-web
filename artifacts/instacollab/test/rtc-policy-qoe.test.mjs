import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferTopologyFromRoomName,
  resolveRoomTopologyPolicy,
  liveKitCreateRoomOptions,
} from '../src/lib/rtc/roomTopologyPolicy.ts';
import {
  ingestNetworkQoESample,
  resetNetworkQoEForTests,
  getNetworkQoEPolicy,
} from '../src/lib/rtc/networkQoEGovernor.ts';

test('room policy: no global maxParticipants=50 for live stream rooms', () => {
  const live = resolveRoomTopologyPolicy('ic-stream-abc');
  assert.ok(live.maxAudienceParticipants > 50);
  assert.equal(live.maxPublishers, 1);
  const call = resolveRoomTopologyPolicy('ic-chat-call-video-t1');
  assert.ok(call.maxAudienceParticipants <= 16);
  const opts = liveKitCreateRoomOptions('ic-party-room1');
  assert.notEqual(opts.maxParticipants, 50);
  assert.ok(opts.metadata.includes('unilivesTopology'));
});

test('room policy: inferTopologyFromRoomName', () => {
  assert.equal(inferTopologyFromRoomName('ic-stream-x'), 'LIVE');
  assert.equal(inferTopologyFromRoomName('ic-party-x'), 'MULTI_GUEST');
  assert.equal(inferTopologyFromRoomName('ic-chat-call-audio-x'), 'CALL_1TO1');
});

test('network QoE: hysteresis avoids instant oscillation', () => {
  resetNetworkQoEForTests();
  ingestNetworkQoESample({
    connectionQuality: 'excellent',
    packetLossPct: 0,
    rttMs: 40,
  });
  assert.equal(getNetworkQoEPolicy().state, 'GOOD');
  const t0 = Date.now();
  for (let i = 0; i < 8; i += 1) {
    ingestNetworkQoESample({
      connectionQuality: 'poor',
      packetLossPct: 15,
      rttMs: 500,
      reconnecting: true,
      atMs: t0 + i * 100,
    });
  }
  assert.notEqual(getNetworkQoEPolicy().state, 'GOOD');
});
