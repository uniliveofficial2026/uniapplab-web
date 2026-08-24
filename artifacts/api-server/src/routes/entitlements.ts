import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { requireAdmin } from "../middlewares/requireAdmin";
import { getSupabaseService } from "../lib/supabase";

const router: IRouter = Router();

function isActiveEntitlement(row: {
  status?: string;
  expires_at?: string | null;
}): boolean {
  if (row.status !== "active") return false;
  if (!row.expires_at) return true;
  return Date.parse(row.expires_at) > Date.now();
}

/** Public/read entitlements for a user — keyed strictly by target user_id. */
router.get("/:userId", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userIdRaw = req.params.userId;
    const userId = Array.isArray(userIdRaw) ? userIdRaw[0] : userIdRaw;
    if (!userId) {
      res.status(400).json({ error: "userId required" });
      return;
    }

    const { data, error } = await getSupabaseService()
      .from("user_entitlements")
      .select(
        "id, user_id, entitlement_type, entitlement_id, scope, scope_id, status, starts_at, expires_at, source, metadata",
      )
      .eq("user_id", userId)
      .eq("status", "active");

    if (error) {
      // Table may not exist yet locally — return empty rather than 500.
      if (error.code === "42P01" || error.code === "PGRST205") {
        res.json({ userId, entitlements: [] });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }

    const entitlements = (data ?? []).filter(isActiveEntitlement);
    res.json({ userId, entitlements });
  } catch (err) {
    next(err);
  }
});

/** Admin grant — clients cannot self-grant. */
router.post("/grant", auth, requireAdmin, async (req, res, next) => {
  try {
    const actorId = req.authUser!.id;
    const {
      userId,
      entitlementType,
      entitlementId,
      scope,
      scopeId,
      expiresAt,
      source,
      sourceRef,
      metadata,
    } = req.body as {
      userId?: string;
      entitlementType?: string;
      entitlementId?: string;
      scope?: string;
      scopeId?: string;
      expiresAt?: string;
      source?: string;
      sourceRef?: string;
      metadata?: Record<string, unknown>;
    };

    if (!userId || !entitlementType || !entitlementId) {
      res.status(400).json({ error: "userId, entitlementType, entitlementId required" });
      return;
    }

    const { data, error } = await getSupabaseService()
      .from("user_entitlements")
      .insert({
        user_id: userId,
        entitlement_type: entitlementType,
        entitlement_id: entitlementId,
        scope: scope ?? "global",
        scope_id: scopeId ?? null,
        status: "active",
        expires_at: expiresAt ?? null,
        source: source ?? "admin",
        source_ref: sourceRef ?? null,
        granted_by: actorId,
        metadata: metadata ?? {},
      })
      .select("*")
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json({ entitlement: data });
  } catch (err) {
    next(err);
  }
});

router.post("/revoke", auth, requireAdmin, async (req, res, next) => {
  try {
    const { entitlementRowId, userId, entitlementType, entitlementId } = req.body as {
      entitlementRowId?: string;
      userId?: string;
      entitlementType?: string;
      entitlementId?: string;
    };

    let query = getSupabaseService()
      .from("user_entitlements")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("status", "active");

    if (entitlementRowId) {
      query = query.eq("id", entitlementRowId);
    } else if (userId && entitlementType && entitlementId) {
      query = query
        .eq("user_id", userId)
        .eq("entitlement_type", entitlementType)
        .eq("entitlement_id", entitlementId);
    } else {
      res.status(400).json({ error: "entitlementRowId or userId+type+id required" });
      return;
    }

    const { data, error } = await query.select("id, user_id, status").maybeSingle();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ entitlement: data });
  } catch (err) {
    next(err);
  }
});

export default router;
