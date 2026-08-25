import { createHash } from "node:crypto";
import {
  BUNDLED_BOOTSTRAP_DEFAULTS,
  PUBLIC_BOOTSTRAP_FIELD_MAP,
  PUBLIC_BOOTSTRAP_IDS,
  RUNTIME_CONFIG_INVENTORY,
} from "./generated/inventory.generated";
import { detectRuntimeEnvironment, readPublicEnv } from "./envLoader";
import { unknownKeysRejected } from "./configPolicy";
import { getActive, getVersion } from "./configRepository";

const ALLOWED_PUBLIC_KEYS = new Set([
  "apiOrigin",
  "appOrigin",
  "websocketOrigin",
  "mediaOrigin",
  "cdnOrigin",
  "supportUrl",
  "supabaseUrl",
  "supabaseAnonKey",
  "firebaseApiKey",
  "firebaseAuthDomain",
  "firebaseProjectId",
  "firebaseAppId",
  "livekitUrl",
  "stripePublishableKey",
  "tencentRtcSdkAppId",
  "tencentWebarAppId",
  "mediaWorkerUrl",
  "r2PublicBaseUrl",
  "publicProviderIds",
  "features",
  "limits",
  "uiCatalogVersion",
]);

const invById = new Map<string, (typeof RUNTIME_CONFIG_INVENTORY)[number]>(
  RUNTIME_CONFIG_INVENTORY.map((d) => [d.id, d]),
);

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const next = cur[key];
    if (!next || typeof next !== "object") cur[key] = {};
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

function publicValueFor(id: string): unknown {
  const def = invById.get(id);
  if (!def) return undefined;
  if (def.classification !== "PUBLIC_RUNTIME" && def.classification !== "FEATURE_FLAG") {
    throw new Error("non-public config cannot enter bootstrap");
  }
  const raw = readPublicEnv(def.envName) || readPublicEnv(def.viteName);
  if (def.valueType === "boolean") return raw === "1" || raw === "true";
  if (def.valueType === "number") {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  return raw;
}

export function buildPublicBootstrapFromEnv(): {
  schemaVersion: 1;
  configVersion: number;
  environment: ReturnType<typeof detectRuntimeEnvironment>;
  public: Record<string, unknown>;
  checksum: string;
} {
  const environment = detectRuntimeEnvironment();
  const active = getActive(environment);
  const version = active ? getVersion(active.versionId) : undefined;
  const defaults = BUNDLED_BOOTSTRAP_DEFAULTS.public as Record<string, unknown>;
  const pub: Record<string, unknown> = JSON.parse(JSON.stringify(defaults));

  for (const id of PUBLIC_BOOTSTRAP_IDS) {
    const field = (PUBLIC_BOOTSTRAP_FIELD_MAP as Record<string, string>)[id];
    if (!field) continue;
    const value = publicValueFor(id);
    if (value === undefined || value === "") continue;
    setPath(pub, field, value);
  }

  pub.publicProviderIds = {
    supabase: "supabase",
    livekit: "livekit",
    stripe: "stripe",
    firebase: "firebase",
  };

  // Never ship localhost websocket origins outside local/test — fail open to app origin.
  {
    const ws = String(pub.websocketOrigin || "");
    const app = String(pub.appOrigin || "");
    const looksLocal =
      !ws ||
      /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(ws) ||
      (environment === "production" && /^ws:\/\//i.test(ws));
    if (looksLocal && app) {
      try {
        const u = new URL(app);
        u.protocol = u.protocol === "http:" ? "ws:" : "wss:";
        pub.websocketOrigin = u.origin;
      } catch {
        pub.websocketOrigin = "wss://app.uniapplab.com";
      }
    } else if (looksLocal) {
      pub.websocketOrigin = "wss://app.uniapplab.com";
    }
  }

  const unknown = unknownKeysRejected(pub, ALLOWED_PUBLIC_KEYS);
  if (unknown.length) throw new Error(`unknown public keys: ${unknown.join(",")}`);

  const checksum = createHash("sha256").update(JSON.stringify(pub)).digest("hex");
  return {
    schemaVersion: 1,
    configVersion: version?.version ?? BUNDLED_BOOTSTRAP_DEFAULTS.configVersion,
    environment,
    public: pub,
    checksum,
  };
}
