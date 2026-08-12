/**
 * Supabase Edge Function — automation config
 * Uses platform_automation_config table (see disk_cleanup migration).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, noContent, subPath } from "../_shared/cors.ts";
import { authenticate, requireAdmin } from "../_shared/auth.ts";
import { getSupabaseService } from "../_shared/supabase.ts";

type AutomationConfig = {
  autopilot?: boolean;
  enabled?: boolean;
  autoPush?: boolean;
  githubActionsDeploy?: boolean;
  autoMachineLearning?: boolean;
  liveCloudSyncAggressive?: boolean;
  note?: string;
};

const DEFAULTS: AutomationConfig = {
  autopilot: false,
  enabled: false,
  autoPush: false,
  githubActionsDeploy: false,
  autoMachineLearning: false,
  liveCloudSyncAggressive: true,
};

function resolve(raw: AutomationConfig): AutomationConfig {
  if (!raw.autopilot) return { ...DEFAULTS, ...raw };
  return {
    ...raw,
    autopilot: true,
    enabled: true,
    autoPush: true,
    githubActionsDeploy: true,
    autoMachineLearning: true,
    liveCloudSyncAggressive: true,
  };
}

async function readConfig(): Promise<AutomationConfig> {
  try {
    const { data } = await getSupabaseService()
      .from("platform_automation_config")
      .select("config")
      .eq("id", "default")
      .maybeSingle();
    const cfg = (data?.config ?? {}) as AutomationConfig;
    return { ...DEFAULTS, ...cfg };
  } catch {
    return { ...DEFAULTS };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return noContent();

  const seg = subPath(new URL(req.url), "automation");
  if (seg.length > 0) return json({ error: "not_found" }, 404);

  if (req.method === "GET") {
    return json(resolve(await readConfig()));
  }

  if (req.method === "PATCH") {
    const ctx = await authenticate(req);
    if (ctx instanceof Response) return ctx;
    const adminErr = requireAdmin(ctx);
    if (adminErr) return adminErr;

    const body = (await req.json().catch(() => ({}))) as Partial<AutomationConfig>;
    const patch: Partial<AutomationConfig> = {};
    if (typeof body.autopilot === "boolean") patch.autopilot = body.autopilot;
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (typeof body.autoPush === "boolean") patch.autoPush = body.autoPush;
    if (typeof body.githubActionsDeploy === "boolean") {
      patch.githubActionsDeploy = body.githubActionsDeploy;
    }
    if (typeof body.autoMachineLearning === "boolean") {
      patch.autoMachineLearning = body.autoMachineLearning;
    }
    if (typeof body.liveCloudSyncAggressive === "boolean") {
      patch.liveCloudSyncAggressive = body.liveCloudSyncAggressive;
    }
    if (!Object.keys(patch).length) return json({ error: "No valid fields to update" }, 400);

    const next = resolve({ ...(await readConfig()), ...patch });
    if (patch.autopilot === true) {
      next.autopilot = true;
      next.enabled = true;
      next.autoPush = true;
      next.githubActionsDeploy = true;
      next.autoMachineLearning = true;
      next.liveCloudSyncAggressive = true;
    }

    const { error } = await getSupabaseService().from("platform_automation_config").upsert(
      { id: "default", config: next, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
    if (error) return json({ error: error.message }, 400);
    return json(next);
  }

  return json({ error: "not_found" }, 404);
});
