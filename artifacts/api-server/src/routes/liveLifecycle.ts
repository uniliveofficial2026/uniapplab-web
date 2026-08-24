import { Router, type IRouter, type Request, type Response } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { apiError } from "../lib/apiError";
import { appendAudit } from "../domain/admin-control-plane/auditService";
import {
  getLiveLifecycleService,
  processLiveLifecycleOutbox,
  type CanonicalLiveRoomType,
  type EndLiveReason,
  type LeaveReason,
  type ParticipantRole,
} from "../domain/live-lifecycle";
import { persistCanonicalLiveEnd } from "../domain/live-lifecycle/persistCanonicalLiveEnd";

const router: IRouter = Router();
const ALLOWED_TYPES = new Set<CanonicalLiveRoomType>([
  "solo_audio",
  "solo_video",
  "audio_party",
  "video_multi",
  "pk_1v1",
  "pk_team",
  "game",
  "commerce",
]);

function actor(req: Request) {
  return {
    userId: req.authUser!.id,
    role: (req.profile?.role === "admin" || req.profile?.role === "streamer"
      ? req.profile.role
      : "user") as "user" | "streamer" | "admin",
  };
}

function roomTypeFromBody(value: unknown): CanonicalLiveRoomType {
  if (typeof value === "string" && ALLOWED_TYPES.has(value as CanonicalLiveRoomType)) {
    return value as CanonicalLiveRoomType;
  }
  return "solo_video";
}

function handleDomainError(res: Response, err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const rec = err as { status?: number; code?: string; message?: string };
  if (typeof rec.status === "number" && rec.code) {
    apiError(res, rec.status, rec.code);
    return true;
  }
  return false;
}

router.post("/:roomId/ensure", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    if (!roomId) {
      apiError(res, 400, "error.notFound");
      return;
    }
    const body = req.body as {
      roomType?: string;
      hostUserId?: string;
      hasCanonicalCohostTransfer?: boolean;
    };
    const service = getLiveLifecycleService();
    const room = service.ensureRoom({
      roomId,
      roomType: roomTypeFromBody(body.roomType),
      hostUserId: actor(req).userId,
      hasCanonicalCohostTransfer: Boolean(body.hasCanonicalCohostTransfer),
    });
    res.json({
      roomId: room.roomId,
      roomType: room.roomType,
      roomState: room.state,
      roomVersion: room.version,
      startedAt: room.startedAt,
      hostUserId: room.hostUserId,
    });
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.post("/:roomId/pk-roster", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    if (!roomId) {
      apiError(res, 400, "error.notFound");
      return;
    }
    const body = req.body as { userIds?: unknown };
    const userIds = Array.isArray(body.userIds)
      ? body.userIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    const roster = getLiveLifecycleService().setPkTeamRoster(roomId, actor(req), userIds);
    res.json({ roomId, pkRosterUserIds: roster });
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.post("/:roomId/sessions", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    const body = req.body as {
      participantSessionId?: string;
      role?: ParticipantRole;
      seated?: boolean;
      roomType?: string;
    };
    if (!roomId || !body.participantSessionId?.trim()) {
      apiError(res, 400, "error.notFound");
      return;
    }
    const service = getLiveLifecycleService();
    if (!service.getRoom(roomId)) {
      if (body.role !== "host") {
        apiError(res, 404, "error.notFound");
        return;
      }
      service.ensureRoom({
        roomId,
        roomType: roomTypeFromBody(body.roomType),
        hostUserId: actor(req).userId,
      });
    }
    const session = service.connectSession({
      roomId,
      participantSessionId: body.participantSessionId.trim(),
      userId: actor(req).userId,
      role: body.role === "host" || body.role === "guest" || body.role === "moderator" ? body.role : "viewer",
      seated: Boolean(body.seated),
    });
    res.json(session);
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.get("/:roomId/leave-preview", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    const service = getLiveLifecycleService();
    const room = service.getRoom(roomId);
    if (!room) {
      apiError(res, 404, "error.notFound");
      return;
    }
    if (actor(req).userId === room.hostUserId || actor(req).role === "admin") {
      res.json(service.previewHostLeave(roomId, actor(req)));
      return;
    }
    const role = (String(req.query.role || "viewer") as ParticipantRole) || "viewer";
    res.json({
      policy: null,
      confirmationKey:
        role === "guest" ? "live.leave.confirm.guest" : "live.leave.confirm.viewer",
      deadlineAt: null,
      roomVersion: room.version,
    });
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.post("/:roomId/leave", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    const body = req.body as {
      commandId?: string;
      participantSessionId?: string;
      expectedRoomVersion?: number;
      reason?: LeaveReason;
      roomType?: string;
      role?: ParticipantRole;
      seated?: boolean;
    };
    if (!roomId || !body.commandId?.trim() || !body.participantSessionId?.trim()) {
      apiError(res, 400, "error.notFound");
      return;
    }
    const service = getLiveLifecycleService();
    if (!service.getRoom(roomId)) {
      apiError(res, 404, "error.notFound");
      return;
    }
    service.connectSession({
      roomId,
      participantSessionId: body.participantSessionId.trim(),
      userId: actor(req).userId,
      role: body.role === "host" || body.role === "guest" || body.role === "moderator" ? body.role : "viewer",
      seated: Boolean(body.seated),
    });
    const result = service.leave(roomId, actor(req), {
      commandId: body.commandId.trim(),
      participantSessionId: body.participantSessionId.trim(),
      expectedRoomVersion: body.expectedRoomVersion,
      reason: body.reason ?? "user_selected_leave",
    });
    appendAudit({
      actorUserId: actor(req).userId,
      actorSessionId: body.participantSessionId.trim(),
      action: "live.room.leave",
      resourceType: "live_room",
      resourceId: roomId,
      environment: "local",
      beforeVersion: null,
      afterVersion: String(result.roomVersion),
      changeSetId: null,
      requestId: body.commandId.trim(),
      safeMetadata: { roomState: result.roomState, role: result.role, ended: result.ended },
    });
    res.json(result);
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.post("/:roomId/end", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    const body = req.body as {
      commandId?: string;
      expectedRoomVersion?: number;
      reason?: EndLiveReason;
      roomType?: string;
    };
    if (!roomId || !body.commandId?.trim()) {
      apiError(res, 400, "error.notFound");
      return;
    }
    const service = getLiveLifecycleService();
    if (!service.getRoom(roomId)) {
      service.ensureRoom({
        roomId,
        roomType: roomTypeFromBody(body.roomType),
        hostUserId: actor(req).userId,
      });
    }
    const room = service.getRoom(roomId)!;
    const expectedRoomVersion =
      typeof body.expectedRoomVersion === "number" && body.expectedRoomVersion === room.version
        ? body.expectedRoomVersion
        : room.version;
    const result = service.endLive(roomId, actor(req), {
      commandId: body.commandId.trim(),
      expectedRoomVersion,
      reason: body.reason ?? "host_selected_end",
    });
    appendAudit({
      actorUserId: actor(req).userId,
      actorSessionId: null,
      action: "live.room.end",
      resourceType: "live_room",
      resourceId: roomId,
      environment: "local",
      beforeVersion: null,
      afterVersion: String(result.roomVersion),
      changeSetId: null,
      requestId: body.commandId.trim(),
      safeMetadata: { roomState: result.roomState, duplicate: result.duplicate, opponentStillLive: result.opponentStillLive },
    });
    void persistCanonicalLiveEnd({
      roomId,
      hostUserId: actor(req).userId,
      endedAt: new Date().toISOString(),
    }).catch(() => undefined);
    void processLiveLifecycleOutbox(service).then((outbox) => {
      if (outbox.processed === 0) service.completeEnding(roomId);
    });
    res.json(result);
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.get("/:roomId/pk/session", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    if (!roomId) {
      apiError(res, 400, "error.notFound");
      return;
    }
    const service = getLiveLifecycleService();
    res.json(service.getPkSnapshot(roomId));
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.post("/:roomId/pk/start", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    const body = req.body as {
      opponentUserId?: string;
      opponentRoomId?: string;
      hostMediaId?: string;
      opponentMediaId?: string;
      hostMediaSurface?: "stream" | "party";
      opponentMediaSurface?: "stream" | "party";
      durationSec?: number;
      multiplier?: number;
      roomType?: string;
    };
    if (!roomId) {
      apiError(res, 400, "error.notFound");
      return;
    }
    const service = getLiveLifecycleService();
    if (!service.getRoom(roomId)) {
      service.ensureRoom({
        roomId,
        roomType: roomTypeFromBody(body.roomType) === "pk_team" ? "pk_team" : "pk_1v1",
        hostUserId: actor(req).userId,
      });
    }
    const pk = service.startPk(roomId, actor(req), {
      opponentUserId: body.opponentUserId?.trim() || null,
      opponentRoomId: body.opponentRoomId?.trim() || null,
      hostMediaId: body.hostMediaId?.trim() || null,
      opponentMediaId: body.opponentMediaId?.trim() || null,
      hostMediaSurface:
        body.hostMediaSurface === "stream" || body.hostMediaSurface === "party"
          ? body.hostMediaSurface
          : null,
      opponentMediaSurface:
        body.opponentMediaSurface === "stream" || body.opponentMediaSurface === "party"
          ? body.opponentMediaSurface
          : null,
      durationSec: body.durationSec,
      multiplier: body.multiplier,
    });
    appendAudit({
      actorUserId: actor(req).userId,
      actorSessionId: null,
      action: "live.pk.start",
      resourceType: "live_pk",
      resourceId: roomId,
      environment: "local",
      beforeVersion: null,
      afterVersion: pk.id,
      changeSetId: null,
      requestId: pk.id,
      safeMetadata: { pkStatus: pk.status, opponentUserId: pk.opponentUserId },
    });
    res.json({
      roomId,
      hostUserId: pk.hostUserId,
      pk,
    });
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.post("/:roomId/pk/end", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    const body = req.body as {
      commandId?: string;
      expectedPkVersion?: number;
      reason?: string;
    };
    if (!roomId || !body.commandId?.trim()) {
      apiError(res, 400, "error.notFound");
      return;
    }
    const service = getLiveLifecycleService();
    const result = service.endPk(roomId, actor(req), {
      commandId: body.commandId.trim(),
      expectedPkVersion: body.expectedPkVersion,
    });
    appendAudit({
      actorUserId: actor(req).userId,
      actorSessionId: null,
      action: "live.pk.end",
      resourceType: "live_pk",
      resourceId: roomId,
      environment: "local",
      beforeVersion: null,
      afterVersion: result.pkId,
      changeSetId: null,
      requestId: body.commandId.trim(),
      safeMetadata: { pkStatus: result.pkStatus, roomState: result.roomState, opponentStillLive: result.opponentStillLive },
    });
    res.json(result);
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.post("/:roomId/host-dashboard/ingest", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    const body = req.body as {
      kind?: string;
      count?: number;
      audience?: {
        currentUniqueViewers?: number;
        currentConnections?: number;
        seated?: number;
        pendingSeatRequests?: number;
      };
      media?: Record<string, unknown>;
      roomType?: string;
    };
    if (!roomId || !body.kind) {
      apiError(res, 400, "error.notFound");
      return;
    }
    const service = getLiveLifecycleService();
    const kind = String(body.kind);
    if (!service.getRoom(roomId)) {
      if (kind === "audience" || kind === "media") {
        service.ensureRoom({
          roomId,
          roomType: roomTypeFromBody(body.roomType),
          hostUserId: actor(req).userId,
        });
      } else {
        apiError(res, 404, "error.notFound");
        return;
      }
    }
    if (kind === "comment") service.recordComment(roomId);
    else if (kind === "reaction") {
      const count = Math.max(1, Math.min(50, Math.floor(Number(body.count) || 1)));
      service.recordReaction(roomId, count);
    }
    else if (kind === "share") service.recordShare(roomId);
    else if (kind === "follow") service.recordFollowerGained(roomId);
    else if (kind === "audience") {
      service.ingestAudienceSnapshot(roomId, actor(req), body.audience ?? {});
    } else if (kind === "media") {
      service.getDashboard(roomId, actor(req));
      service.setMediaTelemetry(roomId, {
        connectionState: String(body.media?.connectionState ?? "unknown"),
        connectionQuality: String(body.media?.connectionQuality ?? "unknown"),
        uploadBitrate: typeof body.media?.uploadBitrate === "number" ? body.media.uploadBitrate : null,
        framesPerSecond: typeof body.media?.framesPerSecond === "number" ? body.media.framesPerSecond : null,
        packetLoss: typeof body.media?.packetLoss === "number" ? body.media.packetLoss : null,
        roundTripTime: typeof body.media?.roundTripTime === "number" ? body.media.roundTripTime : null,
      });
    } else {
      apiError(res, 400, "error.notFound");
      return;
    }
    try {
      res.json(service.getDashboard(roomId, actor(req)));
    } catch {
      res.json({ ok: true, kind });
    }
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.get("/:roomId/host-dashboard", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    const snapshot = getLiveLifecycleService().getDashboard(roomId, actor(req));
    res.json(snapshot);
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.get("/:roomId/host-dashboard/snapshot", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    const after = Number(req.query.afterSequence || 0);
    const service = getLiveLifecycleService();
    const snapshot = service.getDashboard(roomId, actor(req));
    const deltas = Number.isFinite(after) ? service.getDeltas(roomId, after) : [];
    res.json({ snapshot, deltas });
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.get("/:roomId/host-summary", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    const summary = getLiveLifecycleService().getSummary(roomId, actor(req));
    if (!summary) {
      apiError(res, 404, "error.notFound");
      return;
    }
    res.json(summary);
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

/**
 * Notify live lifecycle of a settled gift so PK scores stay server-authoritative.
 * Used when wallet settle already happened (API / local-demo) and PK must consume the event once.
 * Idempotent on clientRequestId; never trusts body.personId for actor identity.
 */
router.post("/:roomId/gifts/lifecycle-settle", auth, requireNotBanned, async (req, res, next) => {
  try {
    const roomId = String(req.params.roomId || "").trim();
    const body = req.body as {
      clientRequestId?: string;
      receiverId?: string;
      value?: number;
    };
    const clientRequestId = String(body.clientRequestId || "").trim();
    const receiverId = String(body.receiverId || "").trim();
    const value = Math.max(0, Math.floor(Number(body.value) || 0));
    if (!roomId || !clientRequestId || !receiverId || value <= 0) {
      apiError(res, 400, "error.invalidPayload");
      return;
    }
    if (value > 1_000_000) {
      apiError(res, 400, "error.invalidPayload");
      return;
    }
    const service = getLiveLifecycleService();
    let snap: ReturnType<typeof service.getPkSnapshot>;
    try {
      snap = service.getPkSnapshot(roomId);
    } catch (err) {
      if (handleDomainError(res, err)) return;
      throw err;
    }
    const pk = snap.pk;
    if (!pk || pk.status !== "active") {
      res.json({
        ok: true,
        applied: false,
        reason: "pk_not_active",
        localScore: pk?.localScore ?? null,
        opponentScore: pk?.opponentScore ?? null,
      });
      return;
    }
    const actorId = actor(req).userId;
    const participant =
      actorId === pk.hostUserId ||
      actorId === pk.opponentUserId ||
      (pk.hostTeamUserIds || []).includes(actorId) ||
      (pk.opponentTeamUserIds || []).includes(actorId);
    if (!participant) {
      apiError(res, 403, "error.forbidden");
      return;
    }
    const beforeSeq = pk.sequence ?? 0;
    service.beginGiftSettlement(roomId, clientRequestId, receiverId);
    service.completeGiftSettlement(clientRequestId, value, receiverId);
    const afterPk = service.getPkSnapshot(roomId).pk;
    const afterSeq = afterPk?.sequence ?? 0;
    const applied = afterSeq > beforeSeq;
    res.json({
      ok: true,
      applied,
      duplicate: !applied,
      giftEventId: clientRequestId,
      localScore: afterPk?.localScore ?? null,
      opponentScore: afterPk?.opponentScore ?? null,
      sequence: afterSeq,
      hostUserId: afterPk?.hostUserId ?? null,
      opponentUserId: afterPk?.opponentUserId ?? null,
    });
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

export default router;
