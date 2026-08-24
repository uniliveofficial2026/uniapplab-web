import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { optionalAuth } from "../middlewares/optionalAuth";
import { getSupabaseService } from "../lib/supabase";
import { apiError } from "../lib/apiError";
import {
  BUNDLED_SNAPSHOT_ID,
  publicAssignmentPayload,
  resolveUiAssignment,
  ttlMsForSessionType,
  type AssignmentRule,
  type UiSessionType,
} from "../domain/uiConfig/assignmentResolve";
import { checksumJson } from "../domain/uiConfig/nodeValidate";

const router: IRouter = Router();

const BUNDLED_LOCKFILE = {
  snapshotId: BUNDLED_SNAPSHOT_ID,
  snapshotVersion: 1,
  schemaVersion: 1,
  platform: "all",
  experiences: {
    "auth.login": 1,
    "home.discovery": 1,
    "profile.view": 1,
    "chat.inbox": 1,
    "chat.thread": 1,
    "live.solo-video": 1,
    "wallet.home": 1,
    "settings.main": 1,
  },
  fragments: {
    "navigation.bottom": 1,
    "profile.header": 1,
    "live.seat-grid": 1,
    "wallet.balance-card": 1,
  },
  themeVersion: 4,
  assetBindingVersion: 1,
  translationCatalogVersion: 1,
  checksum: "bundled",
};

function isSessionType(value: unknown): value is UiSessionType {
  return value === "app" || value === "anonymous" || value === "live_room" || value === "pk" || value === "admin_preview";
}

function mapRule(row: Record<string, unknown>): AssignmentRule {
  const conditions = (row.scope_conditions_json && typeof row.scope_conditions_json === "object"
    ? row.scope_conditions_json
    : {}) as AssignmentRule["conditions"];
  return {
    id: String(row.id),
    ruleKey: String(row.rule_key),
    priority: Number(row.priority || 100),
    scopeType: row.scope_type as AssignmentRule["scopeType"],
    snapshotId: String(row.snapshot_id),
    allocationPercentage: Number(row.allocation_percentage ?? 100),
    startsAt: row.starts_at ? Date.parse(String(row.starts_at)) : null,
    endsAt: row.ends_at ? Date.parse(String(row.ends_at)) : null,
    applyPolicy: (row.apply_policy as AssignmentRule["applyPolicy"]) || "next_session",
    active: row.active !== false,
    conditions,
  };
}

async function loadPublishedLockfile(snapshotId: string): Promise<{ checksum: string; lockfile: unknown; compatibleRoomTypes: string[] } | null> {
  if (snapshotId === BUNDLED_SNAPSHOT_ID) {
    return { checksum: "bundled", lockfile: BUNDLED_LOCKFILE, compatibleRoomTypes: ["solo_audio", "solo_video", "audio_party", "video_multi", "pk_1v1", "pk_team"] };
  }
  try {
    const { data } = await getSupabaseService()
      .from("ui_snapshots")
      .select("id, checksum, lockfile_json, compatible_room_types, status")
      .eq("id", snapshotId)
      .maybeSingle();
    if (!data) return null;
    return {
      checksum: String(data.checksum),
      lockfile: data.lockfile_json,
      compatibleRoomTypes: Array.isArray(data.compatible_room_types) ? data.compatible_room_types.map(String) : [],
    };
  } catch {
    return null;
  }
}

router.post("/start", optionalAuth, async (req, res, next) => {
  try {
    const sessionType = isSessionType(req.body?.sessionType) ? req.body.sessionType : req.authUser ? "app" : "anonymous";
    if (sessionType === "admin_preview") {
      if (!req.authUser) {
        apiError(res, 401, "error.unauthorized");
        return;
      }
      const role =
        (req.authUser.app_metadata as { role?: string } | undefined)?.role ??
        req.profile?.role;
      if (role !== "admin") {
        apiError(res, 403, "error.forbidden");
        return;
      }
    }

    const claimedUser = req.body?.userId ?? req.body?.user_id;
    if (claimedUser != null && req.authUser && String(claimedUser) !== req.authUser.id) {
      apiError(res, 403, "error.impersonation");
      return;
    }
    if (claimedUser != null && !req.authUser) {
      apiError(res, 403, "error.impersonation");
      return;
    }

    const platform = String(req.body?.platform || "web");
    const appVersion = String(req.body?.appVersion || "0.0.0");
    const capabilityHash = String(req.body?.capabilityHash || "unknown");
    const roomId = typeof req.body?.roomId === "string" ? req.body.roomId : null;
    const roomType = typeof req.body?.roomType === "string" ? req.body.roomType : null;
    const pkSessionId = typeof req.body?.pkSessionId === "string" ? req.body.pkSessionId : null;
    const previewSnapshotId = typeof req.body?.previewSnapshotId === "string" ? req.body.previewSnapshotId : null;
    const anonymousSessionId =
      typeof req.body?.anonymousSessionId === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(req.body.anonymousSessionId)
        ? req.body.anonymousSessionId
        : sessionType === "anonymous" || !req.authUser
          ? randomUUID()
          : null;

    let rules: AssignmentRule[] = [];
    try {
      const { data } = await getSupabaseService().from("ui_assignment_rules").select("*").eq("active", true);
      rules = (data || []).map((row) => mapRule(row as Record<string, unknown>));
    } catch {
      rules = [];
    }

    const decision = resolveUiAssignment(
      {
        sessionType,
        isAdminPreview: sessionType === "admin_preview",
        userId: req.authUser?.id ?? null,
        anonymousSessionId,
        roomId,
        roomType,
        pkSessionId,
        platform,
        appVersion,
        previewSnapshotId: sessionType === "admin_preview" ? previewSnapshotId : null,
        reducedMotion: Boolean(req.body?.reducedMotion),
      },
      rules,
    );

    let snapshotId = decision.snapshotId;
    let loaded = await loadPublishedLockfile(snapshotId);
    if (!loaded || (loaded.compatibleRoomTypes.length && roomType && !loaded.compatibleRoomTypes.includes(roomType) && sessionType === "pk")) {
      snapshotId = BUNDLED_SNAPSHOT_ID;
      loaded = await loadPublishedLockfile(BUNDLED_SNAPSHOT_ID);
    }
    if (sessionType !== "admin_preview" && snapshotId !== BUNDLED_SNAPSHOT_ID) {
      try {
        const { data: snap } = await getSupabaseService().from("ui_snapshots").select("status").eq("id", snapshotId).maybeSingle();
        if (snap && snap.status !== "published") {
          snapshotId = BUNDLED_SNAPSHOT_ID;
          loaded = await loadPublishedLockfile(BUNDLED_SNAPSHOT_ID);
        }
      } catch {
        snapshotId = BUNDLED_SNAPSHOT_ID;
        loaded = await loadPublishedLockfile(BUNDLED_SNAPSHOT_ID);
      }
    }

    const lockfile = loaded?.lockfile || BUNDLED_LOCKFILE;
    const checksum = loaded?.checksum || checksumJson(lockfile);
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + ttlMsForSessionType(sessionType)).toISOString();

    try {
      await getSupabaseService().from("ui_session_assignments").insert({
        session_id: sessionId,
        session_type: sessionType,
        user_id: req.authUser?.id ?? null,
        anonymous_session_id: anonymousSessionId,
        room_id: roomId,
        pk_session_id: pkSessionId,
        snapshot_id: snapshotId === BUNDLED_SNAPSHOT_ID ? null : snapshotId,
        assignment_rule_id: decision.ruleId,
        experiment_key: decision.experimentKey,
        variant_key: decision.variantKey,
        platform,
        app_version: appVersion,
        capability_hash: capabilityHash,
        expires_at: expiresAt,
      });
    } catch {
      /* tables may be missing locally — still return bundled pin */
    }

    res.setHeader("ETag", `"${checksum}"`);
    res.status(201).json(
      publicAssignmentPayload({
        sessionId,
        sessionType,
        snapshotId,
        checksum,
        lockfile,
        applyPolicy: decision.applyPolicy,
        expiresAt,
        source: decision.source,
      }),
    );
  } catch (err) {
    next(err);
  }
});

router.get("/:sessionId/snapshot", optionalAuth, async (req, res, next) => {
  try {
    const sessionId = String(req.params.sessionId || "");
    try {
      const { data } = await getSupabaseService()
        .from("ui_session_assignments")
        .select("*")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (!data) {
        apiError(res, 404, "error.notFound");
        return;
      }
      if (data.user_id && req.authUser && data.user_id !== req.authUser.id) {
        apiError(res, 403, "error.forbidden");
        return;
      }
      const snapshotId = data.snapshot_id || BUNDLED_SNAPSHOT_ID;
      const loaded = await loadPublishedLockfile(String(snapshotId));
      res.setHeader("ETag", `"${loaded?.checksum || "bundled"}"`);
      res.json({
        sessionId,
        snapshotId,
        checksum: loaded?.checksum || "bundled",
        lockfile: loaded?.lockfile || BUNDLED_LOCKFILE,
        expiresAt: data.expires_at,
        applyPolicy: "next_session",
      });
      return;
    } catch {
      apiError(res, 503, "common.unknownError");
    }
  } catch (err) {
    next(err);
  }
});

router.post("/:sessionId/refresh", optionalAuth, async (req, res, next) => {
  try {
    const sessionId = String(req.params.sessionId || "");
    try {
      const { data } = await getSupabaseService()
        .from("ui_session_assignments")
        .select("*")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (!data) {
        apiError(res, 404, "error.notFound");
        return;
      }
      if (new Date(String(data.expires_at)).getTime() <= Date.now()) {
        res.status(409).json({ code: "error.conflict", error: "session expired", expired: true });
        return;
      }
      const snapshotId = data.snapshot_id || BUNDLED_SNAPSHOT_ID;
      const loaded = await loadPublishedLockfile(String(snapshotId));
      res.json({
        sessionId,
        snapshotId,
        checksum: loaded?.checksum || "bundled",
        lockfile: loaded?.lockfile || BUNDLED_LOCKFILE,
        pinned: true,
        applyPolicy: "next_session",
        expiresAt: data.expires_at,
      });
    } catch {
      apiError(res, 503, "common.unknownError");
    }
  } catch (err) {
    next(err);
  }
});

router.post("/:sessionId/end", optionalAuth, async (req, res, next) => {
  try {
    const sessionId = String(req.params.sessionId || "");
    try {
      await getSupabaseService()
        .from("ui_session_assignments")
        .update({ expires_at: new Date().toISOString() })
        .eq("session_id", sessionId);
    } catch {
      /* ignore missing table */
    }
    res.json({ ok: true, sessionId });
  } catch (err) {
    next(err);
  }
});

export default router;
