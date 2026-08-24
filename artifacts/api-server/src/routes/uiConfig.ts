import { Router, type IRouter } from "express";
import { getSupabaseService } from "../lib/supabase";
import { apiError } from "../lib/apiError";
import { publicExperiencePayload } from "../domain/uiConfig/manifestValidate";
import { BUNDLED_SNAPSHOT_ID } from "../domain/uiConfig/assignmentResolve";

const router: IRouter = Router();

router.get("/bootstrap", async (_req, res, next) => {
  try {
    const sb = getSupabaseService();
    let experiences: Record<string, unknown> = {};
    let theme: unknown = null;
    let checksum = "bundled";
    try {
      const { data: published } = await sb
        .from("ui_experience_versions")
        .select("experience_key, version, schema_version, manifest_json, checksum, theme_version, status")
        .eq("status", "published");
      for (const row of published ?? []) {
        const r = row as Record<string, unknown>;
        const key = String(r.experience_key || "");
        if (!key) continue;
        experiences[key] = publicExperiencePayload({
          experience_key: key,
          version: Number(r.version),
          schema_version: Number(r.schema_version),
          manifest_json: r.manifest_json,
          checksum: String(r.checksum || ""),
          theme_version: Number(r.theme_version || 0),
        });
      }
      const { data: themeRow } = await sb
        .from("ui_theme_versions")
        .select("theme_key, version, tokens_json, checksum")
        .eq("status", "published")
        .eq("theme_key", "unilives-default")
        .maybeSingle();
      if (themeRow) {
        theme = {
          themeKey: themeRow.theme_key,
          version: themeRow.version,
          tokens: themeRow.tokens_json,
          checksum: themeRow.checksum,
        };
        checksum = String(themeRow.checksum || checksum);
      }
    } catch {
      experiences = {};
      theme = null;
    }

    res.setHeader("Cache-Control", "public, max-age=60");
    res.setHeader("ETag", `"${checksum}"`);
    res.json({
      experiences,
      theme,
      checksum,
      source: Object.keys(experiences).length ? "published" : "empty",
    });
  } catch (err) {
    next(err);
  }
});

router.get("/experiences/:experienceKey", async (req, res, next) => {
  try {
    const key = String(req.params.experienceKey || "").trim();
    if (!key) {
      apiError(res, 400, "common.unknownError");
      return;
    }
    try {
      const { data } = await getSupabaseService()
        .from("ui_experience_versions")
        .select("experience_key, version, schema_version, manifest_json, checksum, theme_version, status")
        .eq("experience_key", key)
        .eq("status", "published")
        .maybeSingle();
      if (!data) {
        apiError(res, 404, "error.notFound");
        return;
      }
      res.setHeader("ETag", `"${data.checksum}"`);
      res.json(publicExperiencePayload(data));
    } catch {
      apiError(res, 503, "common.unknownError");
    }
  } catch (err) {
    next(err);
  }
});

router.get("/themes/:themeKey", async (req, res, next) => {
  try {
    const key = String(req.params.themeKey || "").trim();
    try {
      const { data } = await getSupabaseService()
        .from("ui_theme_versions")
        .select("theme_key, version, tokens_json, checksum, status")
        .eq("theme_key", key)
        .eq("status", "published")
        .maybeSingle();
      if (!data) {
        apiError(res, 404, "error.notFound");
        return;
      }
      res.json({
        themeKey: data.theme_key,
        version: data.version,
        tokens: data.tokens_json,
        checksum: data.checksum,
      });
    } catch {
      apiError(res, 503, "common.unknownError");
    }
  } catch (err) {
    next(err);
  }
});

router.get("/snapshots/:snapshotId", async (req, res, next) => {
  try {
    const id = String(req.params.snapshotId || "").trim();
    if (!id) {
      apiError(res, 400, "common.unknownError");
      return;
    }
    if (id === BUNDLED_SNAPSHOT_ID) {
      res.setHeader("ETag", '"bundled"');
      res.json({ snapshotId: id, checksum: "bundled", status: "published", source: "bundled" });
      return;
    }
    try {
      const { data } = await getSupabaseService()
        .from("ui_snapshots")
        .select("id, snapshot_key, version, checksum, lockfile_json, status, compatible_room_types")
        .eq("id", id)
        .eq("status", "published")
        .maybeSingle();
      if (!data) {
        apiError(res, 404, "error.notFound");
        return;
      }
      res.setHeader("ETag", `"${data.checksum}"`);
      res.json({
        snapshotId: data.id,
        snapshotKey: data.snapshot_key,
        version: data.version,
        checksum: data.checksum,
        lockfile: data.lockfile_json,
        compatibleRoomTypes: data.compatible_room_types,
        status: "published",
      });
    } catch {
      apiError(res, 503, "common.unknownError");
    }
  } catch (err) {
    next(err);
  }
});

router.get("/assets", async (_req, res, next) => {
  try {
    try {
      const { data } = await getSupabaseService()
        .from("ui_asset_bindings")
        .select("asset_id, theme_key, season_key, locale, platform, density, asset_version, storage_key, checksum, approval_status")
        .eq("active", true)
        .eq("approval_status", "approved");
      res.json({ assets: data ?? [] });
    } catch {
      res.json({ assets: [] });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
