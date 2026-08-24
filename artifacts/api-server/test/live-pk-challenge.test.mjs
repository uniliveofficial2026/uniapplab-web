import test from "node:test";
import assert from "node:assert/strict";
import { LiveLifecycleService } from "../src/domain/live-lifecycle/LiveLifecycleService";

function actor(userId) {
  return { userId, role: "user" };
}

function setupTwoLives(now = Date.now()) {
  const service = new LiveLifecycleService(undefined, () => now);
  service.ensureRoom({ roomId: "room-a", roomType: "solo_video", hostUserId: "user-a" });
  service.ensureRoom({ roomId: "room-b", roomType: "solo_video", hostUserId: "user-b" });
  service.connectSession({
    roomId: "room-a",
    participantSessionId: "ps-a",
    userId: "user-a",
    role: "host",
  });
  service.connectSession({
    roomId: "room-b",
    participantSessionId: "ps-b",
    userId: "user-b",
    role: "host",
  });
  service.connectSession({
    roomId: "room-b",
    participantSessionId: "ps-c",
    userId: "user-c",
    role: "viewer",
  });
  return { service, now };
}

test("pk-challenge: A challenges B and B decline leaves both lives running", () => {
  const { service } = setupTwoLives();
  const challenge = service.createChallenge(actor("user-a"), {
    hostRoomId: "room-b",
    challengerRoomId: "room-a",
    hostUserId: "user-b",
    ttlSec: 30,
  });
  assert.equal(challenge.status, "pending");
  assert.equal(challenge.hostUserId, "user-b");
  assert.equal(challenge.challengerUserId, "user-a");
  const inboxB = service.getChallengeInbox("user-b");
  assert.equal(inboxB.incoming?.id, challenge.id);
  const declined = service.declineChallenge(actor("user-b"), challenge.id);
  assert.equal(declined.status, "declined");
  assert.equal(service.getRoom("room-a").state, "live");
  assert.equal(service.getRoom("room-b").state, "live");
  assert.equal(service.getPkSnapshot("room-b").pk, null);
});

test("pk-challenge: expiry leaves both lives running", () => {
  let now = Date.now();
  const service = new LiveLifecycleService(undefined, () => now);
  service.ensureRoom({ roomId: "room-a", roomType: "solo_video", hostUserId: "user-a" });
  service.ensureRoom({ roomId: "room-b", roomType: "solo_video", hostUserId: "user-b" });
  const challenge = service.createChallenge(actor("user-a"), {
    hostRoomId: "room-b",
    challengerRoomId: "room-a",
    hostUserId: "user-b",
    ttlSec: 30,
  });
  now += 31_000;
  const expired = service.expirePendingChallenges(now);
  assert.equal(expired[0]?.id, challenge.id);
  assert.equal(expired[0]?.status, "expired");
  assert.equal(service.getRoom("room-a").state, "live");
  assert.equal(service.getRoom("room-b").state, "live");
});

test("pk-challenge: End PK succeeds after gift version bump and patches opponent dashboard", () => {
  const { service } = setupTwoLives();
  const challenge = service.createChallenge(actor("user-a"), {
    hostRoomId: "room-b",
    challengerRoomId: "room-a",
    hostUserId: "user-b",
  });
  service.acceptChallenge(actor("user-b"), challenge.id);
  service.applyPkGiftScore("room-b", "user-b", 40, "gift-stale-1");
  const snap = service.getPkSnapshot("room-b");
  assert.ok((snap.pk?.version ?? 0) > 1);
  const ended = service.endPk("room-a", actor("user-a"), { commandId: "pk-end-stale", expectedPkVersion: 1 });
  assert.equal(ended.pkStatus, "ended");
  assert.equal(service.getRoom("room-a").state, "live");
  assert.equal(service.getRoom("room-b").state, "live");
  assert.equal(service.getDashboard("room-a", actor("user-a")).pk.state, "ended");
});

test("pk-challenge: accept puts A and B in the same canonical PK session", () => {
  const { service } = setupTwoLives();
  const challenge = service.createChallenge(actor("user-a"), {
    hostRoomId: "room-b",
    challengerRoomId: "room-a",
    hostUserId: "user-b",
    durationSec: 180,
  });
  const accepted = service.acceptChallenge(actor("user-b"), challenge.id);
  assert.equal(accepted.challenge.status, "accepted");
  assert.equal(accepted.pk.roomId, "room-b");
  assert.equal(accepted.pk.hostUserId, "user-b");
  assert.equal(accepted.pk.opponentUserId, "user-a");
  assert.equal(accepted.pk.opponentRoomId, "room-a");
  assert.equal(accepted.pk.hostMediaId, "room-b");
  assert.equal(accepted.pk.opponentMediaId, "room-a");
  assert.equal(accepted.pk.hostMediaSurface, "party");
  assert.equal(accepted.pk.opponentMediaSurface, "party");
  assert.equal(accepted.pk.status, "active");
  assert.ok(accepted.pk.endsAt);
  const snapA = service.getPkSnapshot("room-a");
  const snapB = service.getPkSnapshot("room-b");
  assert.equal(snapA.pk?.id, accepted.pk.id);
  assert.equal(snapB.pk?.id, accepted.pk.id);
  assert.equal(snapA.hostUserId, "user-b");
  const inboxA = service.getChallengeInbox("user-a");
  const inboxB = service.getChallengeInbox("user-b");
  assert.equal(inboxA.activePk?.id, accepted.pk.id);
  assert.equal(inboxB.activePk?.id, accepted.pk.id);
});

test("pk-challenge: gift settlement updates only backend PK score once", () => {
  const { service } = setupTwoLives();
  const challenge = service.createChallenge(actor("user-a"), {
    hostRoomId: "room-b",
    challengerRoomId: "room-a",
    hostUserId: "user-b",
  });
  const { pk } = service.acceptChallenge(actor("user-b"), challenge.id);
  service.beginGiftSettlement("room-b", "gift-1", "user-b");
  service.completeGiftSettlement("gift-1", 40, "user-b");
  service.completeGiftSettlement("gift-1", 40, "user-b");
  const snap = service.getPkSnapshot("room-b");
  assert.equal(snap.pk?.id, pk.id);
  assert.equal(snap.pk?.localScore, 40);
  assert.equal(snap.pk?.opponentScore, 0);
  assert.equal(snap.pk?.sequence, 1);
  service.beginGiftSettlement("room-a", "gift-2", "user-a");
  service.completeGiftSettlement("gift-2", 15, "user-a");
  const afterOpp = service.getPkSnapshot("room-a");
  assert.equal(afterOpp.pk?.opponentScore, 15);
  assert.equal(afterOpp.pk?.localScore, 40);
});

test("pk-challenge: viewer leave does not end PK or live; End PK keeps both lives; End Live cleans PK", () => {
  const { service } = setupTwoLives();
  const challenge = service.createChallenge(actor("user-a"), {
    hostRoomId: "room-b",
    challengerRoomId: "room-a",
    hostUserId: "user-b",
  });
  service.acceptChallenge(actor("user-b"), challenge.id);
  const leave = service.leave("room-b", actor("user-c"), {
    commandId: "leave-c",
    participantSessionId: "ps-c",
    reason: "user_selected_leave",
  });
  assert.equal(leave.ended, false);
  assert.equal(service.getRoom("room-b").state, "live");
  assert.equal(service.getPkSnapshot("room-b").pk?.status, "active");

  const endedPk = service.endPk("room-a", actor("user-a"), { commandId: "pk-end-1" });
  assert.equal(endedPk.pkStatus, "ended");
  assert.equal(service.getRoom("room-a").state, "live");
  assert.equal(service.getRoom("room-b").state, "live");

  const challenge2 = service.createChallenge(actor("user-a"), {
    hostRoomId: "room-b",
    challengerRoomId: "room-a",
    hostUserId: "user-b",
  });
  service.acceptChallenge(actor("user-b"), challenge2.id);
  const roomB = service.getRoom("room-b");
  const endLive = service.endLive("room-b", actor("user-b"), {
    commandId: "end-b",
    expectedRoomVersion: roomB.version,
    reason: "host_selected_end",
  });
  assert.equal(endLive.roomState, "ending");
  assert.equal(endLive.opponentStillLive, true);
  assert.equal(service.getRoom("room-a").state, "live");
  assert.equal(["cancelled", "ended"].includes(service.getPkSnapshot("room-a").pk?.status || ""), true);
});

test("pk-challenge: reload snapshot recovers authoritative score and timer", () => {
  const { service, now } = setupTwoLives();
  const challenge = service.createChallenge(actor("user-a"), {
    hostRoomId: "room-b",
    challengerRoomId: "room-a",
    hostUserId: "user-b",
    durationSec: 180,
  });
  service.acceptChallenge(actor("user-b"), challenge.id);
  service.beginGiftSettlement("room-b", "gift-r", "user-b");
  service.completeGiftSettlement("gift-r", 99, "user-b");
  const snap = service.getPkSnapshot("room-b");
  assert.equal(snap.pk?.localScore, 99);
  assert.ok(snap.pk?.endsAt);
  const remaining = Math.ceil((Date.parse(snap.pk.endsAt) - now) / 1000);
  assert.ok(remaining > 0 && remaining <= 180);
});

test("pk-challenge: prefixed stream ids do not leak into lifecycle room ids", () => {
  const { service } = setupTwoLives();
  service.ensureRoom({ roomId: "stream-aaa", roomType: "solo_video", hostUserId: "user-a" });
  service.ensureRoom({ roomId: "bbb", roomType: "solo_video", hostUserId: "user-b" });
  const challenge = service.createChallenge(actor("user-a"), {
    hostRoomId: "stream-bbb",
    challengerRoomId: "stream-aaa",
    hostUserId: "user-b",
  });
  assert.equal(challenge.hostRoomId, "bbb");
  assert.equal(challenge.challengerRoomId, "aaa");
  assert.equal(challenge.hostMediaId, "bbb");
  assert.equal(challenge.challengerMediaId, "aaa");
  assert.equal(challenge.hostMediaSurface, "stream");
  assert.equal(challenge.challengerMediaSurface, "stream");
});

test("pk-challenge: listLivePkHosts returns other live solo hosts only", () => {
  const { service } = setupTwoLives();
  service.ensureRoom({ roomId: "room-c", roomType: "video_multi", hostUserId: "user-c" });
  const forA = service.listLivePkHosts("user-a");
  assert.equal(forA.length, 1);
  assert.equal(forA[0].userId, "user-b");
  assert.equal(forA[0].roomId, "room-b");
  assert.equal(forA[0].isLive, true);
  assert.equal(forA[0].isPkEligible, true);
  const forB = service.listLivePkHosts("user-b");
  assert.equal(forB[0].userId, "user-a");
});

test("pk-challenge: cannot challenge a host room that is not currently live", () => {
  const { service } = setupTwoLives();
  assert.throws(
    () =>
      service.createChallenge(actor("user-a"), {
        hostRoomId: "api-stream-missing",
        challengerRoomId: "room-a",
        hostUserId: "13f5c1a5-47f9-4847-bbbc-857af3b8b512",
      }),
    /host_room_not_live/,
  );
});

test("pk-challenge: solo 2v2 can start with captains only", () => {
  const { service } = setupTwoLives();
  const challenge = service.createChallenge(actor("user-a"), {
    hostRoomId: "room-b",
    challengerRoomId: "room-a",
    hostUserId: "user-b",
    pkType: "pk_team",
    teamSize: 2,
    challengerTeamUserIds: ["user-a"],
  });
  assert.equal(challenge.teamSize, 2);
  assert.deepEqual(challenge.challengerTeamUserIds, ["user-a"]);
  const accepted = service.acceptChallenge(actor("user-b"), challenge.id, {
    hostTeamUserIds: ["user-b"],
  });
  assert.equal(accepted.pk.pkType, "pk_team");
  assert.deepEqual(accepted.pk.opponentTeamUserIds, ["user-a"]);
  assert.deepEqual(accepted.pk.hostTeamUserIds, ["user-b"]);
  assert.equal(accepted.pk.teamSize, 2);
});

test("pk-challenge: team roster can hold 6 per side without extra seated guests", () => {
  const { service } = setupTwoLives();
  const left = ["user-a", "m1", "m2", "m3", "m4", "m5"];
  const right = ["user-b", "n1", "n2", "n3", "n4", "n5"];
  assert.deepEqual(service.setPkTeamRoster("room-a", actor("user-a"), left), left);
  assert.deepEqual(service.setPkTeamRoster("room-b", actor("user-b"), right), right);
  const challenge = service.createChallenge(actor("user-a"), {
    hostRoomId: "room-b",
    challengerRoomId: "room-a",
    hostUserId: "user-b",
    pkType: "pk_team",
    teamSize: 6,
    challengerTeamUserIds: left,
  });
  const accepted = service.acceptChallenge(actor("user-b"), challenge.id, { hostTeamUserIds: right });
  assert.equal(accepted.pk.hostTeamUserIds.length, 6);
  assert.equal(accepted.pk.opponentTeamUserIds.length, 6);
  assert.equal(accepted.pk.teamSize, 6);
});

test("pk-challenge: accept is idempotent and decline after accept is rejected", () => {
  const { service } = setupTwoLives();
  const challenge = service.createChallenge(actor("user-a"), {
    hostRoomId: "room-b",
    challengerRoomId: "room-a",
    hostUserId: "user-b",
  });
  const first = service.acceptChallenge(actor("user-b"), challenge.id);
  const second = service.acceptChallenge(actor("user-b"), challenge.id);
  assert.equal(first.pk.id, second.pk.id);
  assert.throws(() => service.declineChallenge(actor("user-b"), challenge.id));
});

test("pk-challenge: same challenge id is delivered to the live target inbox", () => {
  const { service } = setupTwoLives();
  const challenge = service.createChallenge(actor("user-a"), {
    hostRoomId: "room-b",
    challengerRoomId: "room-a",
    hostUserId: "user-b",
  });
  const inboxB = service.getChallengeInbox("user-b");
  const inboxA = service.getChallengeInbox("user-a");
  assert.equal(inboxB.incoming?.id, challenge.id);
  assert.equal(inboxA.outgoing?.id, challenge.id);
  assert.equal(inboxB.incoming?.challengerUserId, "user-a");
  assert.equal(inboxB.incoming?.hostUserId, "user-b");
});

test("pk-challenge: accepted session contains both canonical user ids", () => {
  const { service } = setupTwoLives();
  const challenge = service.createChallenge(actor("user-a"), {
    hostRoomId: "room-b",
    challengerRoomId: "room-a",
    hostUserId: "user-b",
  });
  const { pk } = service.acceptChallenge(actor("user-b"), challenge.id);
  const ids = [pk.hostUserId, pk.opponentUserId].sort();
  assert.deepEqual(ids, ["user-a", "user-b"]);
  assert.equal(pk.hostUserId, "user-b");
  assert.equal(pk.opponentUserId, "user-a");
});

test("pk-challenge: listLivePkHosts never invents stream-catalog stub hosts", () => {
  const { service } = setupTwoLives();
  const hosts = service.listLivePkHosts("user-a");
  assert.ok(hosts.every((row) => !String(row.roomId).startsWith("api-stream-")));
  assert.ok(hosts.every((row) => row.isLive === true));
  assert.equal(hosts.length, 1);
  assert.equal(hosts[0].userId, "user-b");
});
