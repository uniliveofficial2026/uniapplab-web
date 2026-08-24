import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) return null;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (!process.env[parsed.key]?.trim()) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

function loadPublicSupabaseConfig(appRoot: string): void {
  const cfgPath = path.join(appRoot, "public", "supabase-config.json");
  if (!fs.existsSync(cfgPath)) return;
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as {
      supabaseUrl?: string;
      supabaseAnonKey?: string;
    };
    if (cfg.supabaseUrl && !process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
      process.env.SUPABASE_URL = cfg.supabaseUrl.replace(/\/$/, "");
      process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;
    }
    if (cfg.supabaseAnonKey && !process.env.SUPABASE_ANON_KEY && !process.env.VITE_SUPABASE_ANON_KEY) {
      process.env.SUPABASE_ANON_KEY = cfg.supabaseAnonKey;
      process.env.VITE_SUPABASE_ANON_KEY = cfg.supabaseAnonKey;
    }
  } catch {
    /* ignore */
  }
}

/** Load repo .env files before the server reads process.env (local dev). */
export function bootstrapLocalEnv(): void {
  const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const repoRoot = path.resolve(apiRoot, "../..");
  const appRoot = path.resolve(repoRoot, "artifacts/instacollab");

  for (const file of [
    path.join(repoRoot, ".env"),
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env.development"),
    path.join(repoRoot, ".env.development.local"),
    path.join(appRoot, ".env"),
    path.join(appRoot, ".env.local"),
    path.join(apiRoot, ".env"),
    path.join(apiRoot, ".env.local"),
    path.join(repoRoot, "artifacts/admin-panel/.env"),
    path.join(repoRoot, "artifacts/admin-panel/.env.local"),
  ]) {
    loadEnvFile(file);
  }

  loadPublicSupabaseConfig(appRoot);

  if (!process.env.UNILIVE_RUNTIME_ENV) {
    process.env.UNILIVE_RUNTIME_ENV = "local";
  }
}
