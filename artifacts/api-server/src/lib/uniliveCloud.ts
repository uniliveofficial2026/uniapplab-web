import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createUniLiveCloud,
  createDurableUniLiveCloud,
} from "@unilives/cloud";
import { createControlPlaneStore } from "@unilives/platform-core";
import { logger } from "./logger";

type Cloud = Awaited<ReturnType<typeof createDurableUniLiveCloud>> | ReturnType<typeof createUniLiveCloud>;

let cloudPromise: Promise<Cloud> | null = null;

function createServiceClient(): SupabaseClient | null {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SECRET_KET ||
      "",
  ).trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Production: durable Supabase-backed UniLive Cloud.
 * Local/test: in-memory MVP.
 */
export function getUniLiveCloud(): Promise<Cloud> {
  if (!cloudPromise) {
    cloudPromise = (async () => {
      const controlPlane = createControlPlaneStore();
      const forceMemory = String(process.env.UNILIVE_CLOUD_PERSISTENCE || "").toLowerCase() === "memory";
      const wantDurable =
        !forceMemory &&
        (process.env.NODE_ENV === "production" ||
          String(process.env.UNILIVE_CLOUD_PERSISTENCE || "").toLowerCase() === "supabase");
      if (wantDurable) {
        const supabase = createServiceClient();
        if (supabase) {
          try {
            const cloud = await createDurableUniLiveCloud({ supabase, controlPlane });
            logger.info(
              { persistenceMode: (cloud as { persistenceMode?: string }).persistenceMode || "durable" },
              "UniLive Cloud durable persistence enabled",
            );
            return cloud;
          } catch (err) {
            logger.error({ err }, "UniLive Cloud durable init failed; falling back to memory");
          }
        } else {
          logger.warn("UniLive Cloud durable requested but Supabase service credentials missing");
        }
      }
      return createUniLiveCloud({ controlPlane });
    })();
  }
  return cloudPromise;
}
