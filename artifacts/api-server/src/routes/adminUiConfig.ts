import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { getSupabaseService } from "../lib/supabase";
import { apiError } from "../lib/apiError";
import { checksumJson, validateUiManifest } from "../domain/uiConfig/manifestValidate";
import { validateScopeConditions, validateSnapshotLockfile, validateUiFragment } from "../domain/uiConfig/nodeValidate";

const router: IRouter = Router();
router.use(auth, requireNotBanned, requireAdmin);

async function audit(input: {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  previousVersion?: number | null;
  newVersion?: number | null;
  reason?: string;
}): Promise<void> {
  try {
    await getSupabaseService().from("ui_publish_audit").insert({
      actor_user_id: input.actor,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      previous_version: input.previousVersion ?? null,
      new_version: input.newVersion ?? null,
      reason: input.reason ?? null,
    });
  } catch {
    /* audit best-effort */
  }
}

router.post("/experiences/:experienceKey/drafts", async (req, res, next) => {
  try {
    const key = String(req.params.experienceKey || "").trim();
    const manifest = req.body?.manifest ?? req.body;
    const issues = validateUiManifest(manifest);
    if (issues.length) {
      res.status(400).json({ code: "ui.manifest.invalid", issues, error: "invalid manifest" });
      return;
    }
    const checksum = checksumJson(manifest);
    const sb = getSupabaseService();
    const { data: exp } = await sb
      .from("ui_experiences")
      .upsert(
        { experience_key: key, platform: String(manifest.platform || "all"), active: true, updated_at: new Date().toISOString() },
        { onConflict: "experience_key" },
      )
      .select("id")
      .maybeSingle();

    const { data: latest } = await sb
      .from("ui_experience_versions")
      .select("version")
      .eq("experience_key", key)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = Number(latest?.version || 0) + 1;

    const { data, error } = await sb
      .from("ui_experience_versions")
      .insert({
        experience_id: exp?.id ?? null,
        experience_key: key,
        version: nextVersion,
        schema_version: manifest.schemaVersion,
        manifest_json: manifest,
        theme_version: manifest.themeVersion ?? 4,
        status: "draft",
        checksum,
        created_by: req.authUser!.id,
      })
      .select("id, version, status, checksum")
      .single();
    if (error) {
      apiError(res, 503, "common.unknownError");
      return;
    }
    await audit({
      actor: req.authUser!.id,
      action: "draft",
      entityType: "ui_experience_version",
      entityId: String(data.id),
      newVersion: data.version,
    });
    res.status(201).json({ id: data.id, version: data.version, status: data.status, checksum: data.checksum });
  } catch (err) {
    next(err);
  }
});

router.post("/versions/:versionId/validate", async (req, res, next) => {
  try {
    const id = String(req.params.versionId || "");
    const sb = getSupabaseService();
    const { data: row } = await sb.from("ui_experience_versions").select("*").eq("id", id).maybeSingle();
    if (!row) {
      apiError(res, 404, "error.notFound");
      return;
    }
    const issues = validateUiManifest(row.manifest_json);
    if (issues.length) {
      res.status(400).json({ code: "ui.manifest.invalid", issues, error: "invalid manifest" });
      return;
    }
    if (row.status === "published") {
      res.status(409).json({ code: "error.conflict", error: "published versions are immutable" });
      return;
    }
    const { data, error } = await sb
      .from("ui_experience_versions")
      .update({ status: "validated", validated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("version", row.version)
      .select("id, status, version, checksum")
      .maybeSingle();
    if (error || !data) {
      apiError(res, 409, "error.conflict");
      return;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/versions/:versionId/publish", async (req, res, next) => {
  try {
    const id = String(req.params.versionId || "");
    const sb = getSupabaseService();
    const { data: row } = await sb.from("ui_experience_versions").select("*").eq("id", id).maybeSingle();
    if (!row) {
      apiError(res, 404, "error.notFound");
      return;
    }
    if (row.status === "published") {
      res.json({ id: row.id, status: "published", version: row.version, checksum: row.checksum, immutable: true });
      return;
    }
    if (row.status !== "validated" && row.status !== "draft") {
      apiError(res, 409, "error.conflict");
      return;
    }
    const issues = validateUiManifest(row.manifest_json);
    if (issues.length) {
      res.status(400).json({ code: "ui.manifest.invalid", issues, error: "invalid manifest" });
      return;
    }

    await sb
      .from("ui_experience_versions")
      .update({ status: "superseded", superseded_at: new Date().toISOString() })
      .eq("experience_key", row.experience_key)
      .eq("status", "published");

    const { data, error } = await sb
      .from("ui_experience_versions")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", id)
      .eq("version", row.version)
      .select("id, status, version, checksum")
      .maybeSingle();
    if (error || !data) {
      apiError(res, 409, "error.conflict");
      return;
    }
    await audit({
      actor: req.authUser!.id,
      action: "publish",
      entityType: "ui_experience_version",
      entityId: id,
      previousVersion: row.version,
      newVersion: data.version,
      reason: typeof req.body?.reason === "string" ? req.body.reason : undefined,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/versions/:versionId/rollback", async (req, res, next) => {
  try {
    const id = String(req.params.versionId || "");
    const sb = getSupabaseService();
    const { data: row } = await sb.from("ui_experience_versions").select("*").eq("id", id).maybeSingle();
    if (!row) {
      apiError(res, 404, "error.notFound");
      return;
    }
    const issues = validateUiManifest(row.manifest_json);
    if (issues.length) {
      res.status(400).json({ code: "ui.manifest.invalid", issues, error: "cannot rollback invalid manifest" });
      return;
    }
    await sb
      .from("ui_experience_versions")
      .update({ status: "superseded", superseded_at: new Date().toISOString() })
      .eq("experience_key", row.experience_key)
      .eq("status", "published");
    const { data, error } = await sb
      .from("ui_experience_versions")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, status, version, checksum")
      .maybeSingle();
    if (error || !data) {
      apiError(res, 409, "error.conflict");
      return;
    }
    await audit({
      actor: req.authUser!.id,
      action: "rollback",
      entityType: "ui_experience_version",
      entityId: id,
      newVersion: data.version,
      reason: typeof req.body?.reason === "string" ? req.body.reason : "rollback",
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/themes/:themeKey/drafts", async (req, res, next) => {
  try {
    const key = String(req.params.themeKey || "").trim();
    const tokens = req.body?.tokens ?? req.body;
    if (!tokens || typeof tokens !== "object") {
      apiError(res, 400, "common.unknownError");
      return;
    }
    const checksum = checksumJson(tokens);
    const sb = getSupabaseService();
    const { data: latest } = await sb
      .from("ui_theme_versions")
      .select("version")
      .eq("theme_key", key)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const version = Number(latest?.version || 0) + 1;
    const { data, error } = await sb
      .from("ui_theme_versions")
      .insert({
        theme_key: key,
        version,
        tokens_json: tokens,
        status: "draft",
        checksum,
        created_by: req.authUser!.id,
      })
      .select("id, version, status, checksum")
      .single();
    if (error) {
      apiError(res, 503, "common.unknownError");
      return;
    }
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/themes/:versionId/publish", async (req, res, next) => {
  try {
    const id = String(req.params.versionId || "");
    const sb = getSupabaseService();
    const { data: row } = await sb.from("ui_theme_versions").select("*").eq("id", id).maybeSingle();
    if (!row) {
      apiError(res, 404, "error.notFound");
      return;
    }
    await sb
      .from("ui_theme_versions")
      .update({ status: "superseded" })
      .eq("theme_key", row.theme_key)
      .eq("status", "published");
    const { data, error } = await sb
      .from("ui_theme_versions")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, version, status, checksum")
      .maybeSingle();
    if (error || !data) {
      apiError(res, 409, "error.conflict");
      return;
    }
    await audit({
      actor: req.authUser!.id,
      action: "theme_publish",
      entityType: "ui_theme_version",
      entityId: id,
      newVersion: data.version,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/fragments/:fragmentKey/versions", async (req, res, next) => {
  try {
    const key = String(req.params.fragmentKey || "").trim();
    const content = req.body?.content ?? req.body;
    const issues = validateUiFragment(content);
    if (issues.length) {
      res.status(400).json({ code: "ui.fragment.invalid", issues, error: "invalid fragment" });
      return;
    }
    const checksum = checksumJson(content);
    const sb = getSupabaseService();
    await sb.from("ui_fragments").upsert({ fragment_key: key, fragment_type: String(req.body?.fragmentType || "section"), active: true, updated_at: new Date().toISOString() }, { onConflict: "fragment_key" });
    const { data: latest } = await sb.from("ui_fragment_versions").select("version").eq("fragment_key", key).order("version", { ascending: false }).limit(1).maybeSingle();
    const version = Number(latest?.version || 0) + 1;
    const { data, error } = await sb
      .from("ui_fragment_versions")
      .insert({
        fragment_key: key,
        version,
        schema_version: content.schemaVersion,
        content_json: content,
        status: "draft",
        checksum,
        created_by: req.authUser!.id,
      })
      .select("id, version, status, checksum")
      .single();
    if (error) {
      apiError(res, 503, "common.unknownError");
      return;
    }
    await audit({ actor: req.authUser!.id, action: "fragment_draft", entityType: "ui_fragment_version", entityId: String(data.id), newVersion: data.version });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/fragments/:versionId/validate", async (req, res, next) => {
  try {
    const id = String(req.params.versionId || "");
    const sb = getSupabaseService();
    const { data: row } = await sb.from("ui_fragment_versions").select("*").eq("id", id).maybeSingle();
    if (!row) {
      apiError(res, 404, "error.notFound");
      return;
    }
    if (row.status === "published") {
      res.status(409).json({ code: "error.conflict", error: "published versions are immutable" });
      return;
    }
    const issues = validateUiFragment(row.content_json);
    if (issues.length) {
      res.status(400).json({ code: "ui.fragment.invalid", issues, error: "invalid fragment" });
      return;
    }
    const { data, error } = await sb
      .from("ui_fragment_versions")
      .update({ status: "validated", validated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("version", row.version)
      .select("id, status, version, checksum")
      .maybeSingle();
    if (error || !data) {
      apiError(res, 409, "error.conflict");
      return;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/fragments/:versionId/publish", async (req, res, next) => {
  try {
    const id = String(req.params.versionId || "");
    const sb = getSupabaseService();
    const { data: row } = await sb.from("ui_fragment_versions").select("*").eq("id", id).maybeSingle();
    if (!row) {
      apiError(res, 404, "error.notFound");
      return;
    }
    const issues = validateUiFragment(row.content_json);
    if (issues.length) {
      res.status(400).json({ code: "ui.fragment.invalid", issues, error: "invalid fragment" });
      return;
    }
    await sb.from("ui_fragment_versions").update({ status: "superseded", superseded_at: new Date().toISOString() }).eq("fragment_key", row.fragment_key).eq("status", "published");
    const { data, error } = await sb
      .from("ui_fragment_versions")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", id)
      .eq("version", row.version)
      .select("id, status, version, checksum")
      .maybeSingle();
    if (error || !data) {
      apiError(res, 409, "error.conflict");
      return;
    }
    await audit({ actor: req.authUser!.id, action: "fragment_publish", entityType: "ui_fragment_version", entityId: id, newVersion: data.version });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/snapshots", async (req, res, next) => {
  try {
    const lockfile = req.body?.lockfile ?? req.body;
    const issues = validateSnapshotLockfile(lockfile);
    if (issues.length) {
      res.status(400).json({ code: "ui.snapshot.invalid", issues, error: "invalid snapshot" });
      return;
    }
    const checksum = checksumJson(lockfile);
    const sb = getSupabaseService();
    const key = String(lockfile.snapshotId || req.body?.snapshotKey || "snapshot");
    const { data: latest } = await sb.from("ui_snapshots").select("version").eq("snapshot_key", key).order("version", { ascending: false }).limit(1).maybeSingle();
    const version = Number(latest?.version || 0) + 1;
    const { data, error } = await sb
      .from("ui_snapshots")
      .insert({
        snapshot_key: key,
        version,
        platform: String(lockfile.platform || "all"),
        schema_version: 1,
        status: "draft",
        checksum,
        lockfile_json: lockfile,
        compatible_room_types: Array.isArray(req.body?.compatibleRoomTypes) ? req.body.compatibleRoomTypes : lockfile.compatibleRoomTypes || [],
        created_by: req.authUser!.id,
      })
      .select("id, version, status, checksum")
      .single();
    if (error) {
      apiError(res, 503, "common.unknownError");
      return;
    }
    await audit({ actor: req.authUser!.id, action: "snapshot_draft", entityType: "ui_snapshot", entityId: String(data.id), newVersion: data.version });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/snapshots/:snapshotId/validate", async (req, res, next) => {
  try {
    const id = String(req.params.snapshotId || "");
    const sb = getSupabaseService();
    const { data: row } = await sb.from("ui_snapshots").select("*").eq("id", id).maybeSingle();
    if (!row) {
      apiError(res, 404, "error.notFound");
      return;
    }
    const issues = validateSnapshotLockfile(row.lockfile_json);
    if (issues.length) {
      res.status(400).json({ code: "ui.snapshot.invalid", issues, error: "invalid snapshot" });
      return;
    }
    const { data, error } = await sb
      .from("ui_snapshots")
      .update({ status: "validated", validated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("version", row.version)
      .select("id, status, version, checksum")
      .maybeSingle();
    if (error || !data) {
      apiError(res, 409, "error.conflict");
      return;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/snapshots/:snapshotId/publish", async (req, res, next) => {
  try {
    const id = String(req.params.snapshotId || "");
    const sb = getSupabaseService();
    const { data: row } = await sb.from("ui_snapshots").select("*").eq("id", id).maybeSingle();
    if (!row) {
      apiError(res, 404, "error.notFound");
      return;
    }
    const issues = validateSnapshotLockfile(row.lockfile_json);
    if (issues.length) {
      res.status(400).json({ code: "ui.snapshot.invalid", issues, error: "invalid snapshot" });
      return;
    }
    await sb.from("ui_snapshots").update({ status: "superseded", superseded_at: new Date().toISOString() }).eq("snapshot_key", row.snapshot_key).eq("status", "published");
    const { data, error } = await sb
      .from("ui_snapshots")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", id)
      .eq("version", row.version)
      .select("id, status, version, checksum")
      .maybeSingle();
    if (error || !data) {
      apiError(res, 409, "error.conflict");
      return;
    }
    await audit({ actor: req.authUser!.id, action: "snapshot_publish", entityType: "ui_snapshot", entityId: id, newVersion: data.version });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/snapshots/:snapshotId/rollback", async (req, res, next) => {
  try {
    const id = String(req.params.snapshotId || "");
    const sb = getSupabaseService();
    const { data: row } = await sb.from("ui_snapshots").select("*").eq("id", id).maybeSingle();
    if (!row) {
      apiError(res, 404, "error.notFound");
      return;
    }
    const issues = validateSnapshotLockfile(row.lockfile_json);
    if (issues.length) {
      res.status(400).json({ code: "ui.snapshot.invalid", issues, error: "cannot rollback invalid snapshot" });
      return;
    }
    await sb.from("ui_snapshots").update({ status: "superseded", superseded_at: new Date().toISOString() }).eq("snapshot_key", row.snapshot_key).eq("status", "published");
    const { data, error } = await sb
      .from("ui_snapshots")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, status, version, checksum")
      .maybeSingle();
    if (error || !data) {
      apiError(res, 409, "error.conflict");
      return;
    }
    await audit({ actor: req.authUser!.id, action: "snapshot_rollback", entityType: "ui_snapshot", entityId: id, newVersion: data.version, reason: typeof req.body?.reason === "string" ? req.body.reason : "rollback" });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/assignments", async (req, res, next) => {
  try {
    const conditions = req.body?.scopeConditions || {};
    const issues = validateScopeConditions(conditions);
    if (issues.length) {
      res.status(400).json({ code: "ui.assignment.invalid", issues, error: "invalid assignment scope" });
      return;
    }
    const sb = getSupabaseService();
    const { data, error } = await sb
      .from("ui_assignment_rules")
      .insert({
        rule_key: String(req.body?.ruleKey || `rule-${Date.now()}`),
        priority: Number(req.body?.priority || 100),
        scope_type: String(req.body?.scopeType || "global"),
        scope_conditions_json: conditions,
        snapshot_id: String(req.body?.snapshotId || ""),
        allocation_percentage: Number(req.body?.allocationPercentage ?? 100),
        apply_policy: String(req.body?.applyPolicy || "next_session"),
        active: true,
        created_by: req.authUser!.id,
      })
      .select("id, rule_key, scope_type, snapshot_id, active")
      .single();
    if (error) {
      apiError(res, 503, "common.unknownError");
      return;
    }
    await audit({ actor: req.authUser!.id, action: "assignment_create", entityType: "ui_assignment_rule", entityId: String(data.id) });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/assignments/:assignmentId/disable", async (req, res, next) => {
  try {
    const id = String(req.params.assignmentId || "");
    const sb = getSupabaseService();
    const { data, error } = await sb
      .from("ui_assignment_rules")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, active")
      .maybeSingle();
    if (error || !data) {
      apiError(res, 404, "error.notFound");
      return;
    }
    await audit({ actor: req.authUser!.id, action: "assignment_disable", entityType: "ui_assignment_rule", entityId: id });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
