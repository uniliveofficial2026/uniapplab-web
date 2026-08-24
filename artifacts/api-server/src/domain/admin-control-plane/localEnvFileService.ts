import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { repoPath } from "../../lib/repoRoot";
import { isLocalFilesystemWorkspace } from "./workspaceRuntimeService";

export type EnvKeyRow = {
  key: string;
  value: string;
  line: number;
};

export type LocalEnvFile = {
  path: string;
  content: string;
  keys: EnvKeyRow[];
  exists: boolean;
};

const ENV_LOCAL = ".env.local";
const MAX_ENV_BYTES = 256_000;

function assertLocalEnvAccess(): void {
  if (!isLocalFilesystemWorkspace()) {
    throw Object.assign(new Error("env file access requires local workspace"), { status: 403, code: "env.localOnly" });
  }
}

function envLocalPath(): string {
  return repoPath(ENV_LOCAL);
}

function parseEnvContent(content: string): EnvKeyRow[] {
  const keys: EnvKeyRow[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) keys.push({ key: m[1], value: m[2], line: i + 1 });
  }
  return keys;
}

/** Load `.env.local` into `process.env` so terminal and providers see latest keys. */
export function connectLocalEnvToProcess(): number {
  if (!isLocalFilesystemWorkspace()) return 0;
  const abs = envLocalPath();
  if (!existsSync(abs)) return 0;
  const content = readFileSync(abs, "utf8");
  let count = 0;
  for (const row of parseEnvContent(content)) {
    process.env[row.key] = row.value;
    count += 1;
  }
  return count;
}

export function readLocalEnvFile(): LocalEnvFile {
  assertLocalEnvAccess();
  const abs = envLocalPath();
  const exists = existsSync(abs);
  const content = exists ? readFileSync(abs, "utf8") : "";
  return {
    path: ENV_LOCAL,
    content,
    keys: parseEnvContent(content),
    exists,
  };
}

function validateEnvKey(key: string): void {
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
    throw Object.assign(new Error(`invalid env key: ${key}`), { status: 400, code: "env.invalidKey" });
  }
}

function sanitizeEnvValue(value: string): string {
  return value.replace(/[\r\n]/g, "").trim();
}

export function upsertLocalEnvEntries(entries: Record<string, string>): { path: string; updated: string[] } {
  assertLocalEnvAccess();
  const abs = envLocalPath();
  const current = existsSync(abs) ? readFileSync(abs, "utf8") : "";
  const lines = current.length ? current.split("\n") : [];
  const map = new Map<string, string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) map.set(m[1], m[2]);
  }

  const updated: string[] = [];
  for (const [rawKey, rawValue] of Object.entries(entries)) {
    const key = rawKey.trim().toUpperCase();
    validateEnvKey(key);
    const value = sanitizeEnvValue(rawValue);
    map.set(key, value);
    process.env[key] = value;
    updated.push(key);
  }

  const header = existsSync(abs) ? "" : "# Local dev secrets — never commit\n";
  const body = [...map.entries()].map(([k, v]) => `${k}=${v}`).join("\n");
  const next = `${header}${body}${body ? "\n" : ""}`;
  if (Buffer.byteLength(next, "utf8") > MAX_ENV_BYTES) {
    throw Object.assign(new Error("env file too large"), { status: 400, code: "env.tooLarge" });
  }
  writeFileSync(abs, next, "utf8");
  return { path: ENV_LOCAL, updated };
}

export function writeLocalEnvContent(content: string): { path: string; keys: EnvKeyRow[] } {
  assertLocalEnvAccess();
  if (Buffer.byteLength(content, "utf8") > MAX_ENV_BYTES) {
    throw Object.assign(new Error("env file too large"), { status: 400, code: "env.tooLarge" });
  }
  for (const row of parseEnvContent(content)) {
    validateEnvKey(row.key);
  }
  writeFileSync(envLocalPath(), content.endsWith("\n") ? content : `${content}\n`, "utf8");
  for (const row of parseEnvContent(content)) {
    process.env[row.key] = row.value;
  }
  return { path: ENV_LOCAL, keys: parseEnvContent(content) };
}

export const ENV_QUICK_PRESETS: Array<{ key: string; label: string; placeholder: string; secret?: boolean }> = [
  { key: "VITE_API_URL", label: "API URL", placeholder: "http://127.0.0.1:5001" },
  { key: "VITE_APP_ORIGIN", label: "App origin", placeholder: "http://127.0.0.1:5173" },
  { key: "ADMIN_ORIGIN", label: "Admin origin", placeholder: "http://127.0.0.1:5180" },
  { key: "GEMINI_API_KEY", label: "Gemini key", placeholder: "AIza…", secret: true },
  { key: "OPENAI_API_KEY", label: "OpenAI key", placeholder: "sk-…", secret: true },
  { key: "VERCEL_TOKEN", label: "Vercel token", placeholder: "vercel_…", secret: true },
  { key: "GITHUB_TOKEN", label: "GitHub token", placeholder: "ghp_…", secret: true },
  { key: "SUPABASE_URL", label: "Supabase URL", placeholder: "https://….supabase.co" },
  { key: "SUPABASE_ANON_KEY", label: "Supabase anon key", placeholder: "eyJ…", secret: true },
  { key: "STRIPE_SECRET_KEY", label: "Stripe secret", placeholder: "sk_live_…", secret: true },
  { key: "RUNWAY_API_KEY", label: "Runway key", placeholder: "key_…", secret: true },
  { key: "TENCENT_RTC_SDK_APP_ID", label: "Tencent SDK app id", placeholder: "1400000000" },
];
