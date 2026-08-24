import { Router, type IRouter, type Request, type Response } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { apiError } from "../lib/apiError";
import { appendAudit } from "../domain/admin-control-plane/auditService";
import { getLiveLifecycleService } from "../domain/live-lifecycle";

const router: IRouter = Router();

function actor(req: Request) {
  return {
    userId: req.authUser!.id,
    role: (req.profile?.role === "admin" || req.profile?.role === "streamer"
      ? req.profile.role
      : "user") as "user" | "streamer" | "admin",
  };
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

function audit(req: Request, action: string, resourceId: string, metadata: Record<string, unknown>) {
  appendAudit({
    actorUserId: actor(req).userId,
    actorSessionId: null,
    action,
    resourceType: "live_pk_challenge",
    resourceId,
    environment: "local",
    beforeVersion: null,
    afterVersion: resourceId,
    changeSetId: null,
    requestId: resourceId,
    safeMetadata: metadata,
  });
}

router.post("/", auth, requireNotBanned, async (req, res, next) => {
  try {
    const body = req.body as {
      hostRoomId?: string;
      challengerRoomId?: string;
      hostUserId?: string;
      pkType?: "pk_1v1" | "pk_team";
      challengerTeamUserIds?: string[];
      teamSize?: 2 | 3 | 4 | 6;
      liveSell?: boolean;
      hostMediaId?: string;
      challengerMediaId?: string;
      hostMediaSurface?: "stream" | "party";
      challengerMediaSurface?: "stream" | "party";
      durationSec?: number;
      ttlSec?: number;
    };
    const hostRoomId = String(body.hostRoomId || "").trim();
    const challengerRoomId = String(body.challengerRoomId || "").trim();
    if (!hostRoomId || !challengerRoomId) {
      apiError(res, 400, "error.invalidInput");
      return;
    }
    const service = getLiveLifecycleService();
    const challenge = service.createChallenge(actor(req), {
      hostRoomId,
      challengerRoomId,
      hostUserId: body.hostUserId?.trim() || null,
      pkType: body.pkType === "pk_team" ? "pk_team" : "pk_1v1",
      challengerTeamUserIds: Array.isArray(body.challengerTeamUserIds)
        ? body.challengerTeamUserIds.map((value) => String(value || "").trim()).filter(Boolean)
        : undefined,
      teamSize: body.teamSize === 6 ? 6 : body.teamSize === 4 ? 4 : body.teamSize === 3 ? 3 : body.teamSize === 2 ? 2 : undefined,
      liveSell: Boolean(body.liveSell),
      hostMediaId: body.hostMediaId?.trim() || null,
      challengerMediaId: body.challengerMediaId?.trim() || null,
      hostMediaSurface: body.hostMediaSurface === "stream" || body.hostMediaSurface === "party"
        ? body.hostMediaSurface
        : null,
      challengerMediaSurface:
        body.challengerMediaSurface === "stream" || body.challengerMediaSurface === "party"
          ? body.challengerMediaSurface
          : null,
      durationSec: body.durationSec,
      ttlSec: body.ttlSec,
    });
    audit(req, "live.pk.challenge.create", challenge.id, {
      status: challenge.status,
      hostUserId: challenge.hostUserId,
      challengerUserId: challenge.challengerUserId,
    });
    res.json({ challenge });
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.get("/inbox", auth, requireNotBanned, async (req, res, next) => {
  try {
    const service = getLiveLifecycleService();
    res.json(service.getChallengeInbox(actor(req).userId));
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.get("/hosts", auth, requireNotBanned, async (req, res, next) => {
  try {
    const service = getLiveLifecycleService();
    res.json({ hosts: service.listLivePkHosts(actor(req).userId) });
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.get("/:challengeId", auth, requireNotBanned, async (req, res, next) => {
  try {
    const challengeId = String(req.params.challengeId || "").trim();
    if (!challengeId) {
      apiError(res, 400, "error.notFound");
      return;
    }
    const challenge = getLiveLifecycleService().getChallenge(challengeId);
    if (!challenge) {
      apiError(res, 404, "error.notFound");
      return;
    }
    res.json({ challenge });
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.post("/:challengeId/accept", auth, requireNotBanned, async (req, res, next) => {
  try {
    const challengeId = String(req.params.challengeId || "").trim();
    if (!challengeId) {
      apiError(res, 400, "error.notFound");
      return;
    }
    const body = req.body as { teamUserIds?: string[] };
    const result = getLiveLifecycleService().acceptChallenge(actor(req), challengeId, {
      hostTeamUserIds: Array.isArray(body.teamUserIds)
        ? body.teamUserIds.map((value) => String(value || "").trim()).filter(Boolean)
        : undefined,
    });
    audit(req, "live.pk.challenge.accept", challengeId, {
      status: result.challenge.status,
      pkId: result.pk.id,
      hostUserId: result.pk.hostUserId,
      opponentUserId: result.pk.opponentUserId,
      pkType: result.pk.pkType,
      liveSell: result.pk.liveSell,
      hostTeamSize: result.pk.hostTeamUserIds.length,
      opponentTeamSize: result.pk.opponentTeamUserIds.length,
    });
    res.json(result);
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.post("/:challengeId/decline", auth, requireNotBanned, async (req, res, next) => {
  try {
    const challengeId = String(req.params.challengeId || "").trim();
    if (!challengeId) {
      apiError(res, 400, "error.notFound");
      return;
    }
    const challenge = getLiveLifecycleService().declineChallenge(actor(req), challengeId);
    audit(req, "live.pk.challenge.decline", challengeId, { status: challenge.status });
    res.json({ challenge });
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.post("/:challengeId/cancel", auth, requireNotBanned, async (req, res, next) => {
  try {
    const challengeId = String(req.params.challengeId || "").trim();
    if (!challengeId) {
      apiError(res, 400, "error.notFound");
      return;
    }
    const challenge = getLiveLifecycleService().cancelChallenge(actor(req), challengeId);
    audit(req, "live.pk.challenge.cancel", challengeId, { status: challenge.status });
    res.json({ challenge });
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

router.post("/:challengeId/expire", auth, requireNotBanned, async (req, res, next) => {
  try {
    const challengeId = String(req.params.challengeId || "").trim();
    if (!challengeId) {
      apiError(res, 400, "error.notFound");
      return;
    }
    const challenge = getLiveLifecycleService().expireChallenge(challengeId);
    audit(req, "live.pk.challenge.expire", challengeId, { status: challenge.status });
    res.json({ challenge });
  } catch (err) {
    if (!handleDomainError(res, err)) next(err);
  }
});

export default router;
