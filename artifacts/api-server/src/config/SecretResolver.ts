import { envPresent } from "./envLoader";

export type ParsedSecretReference = {
  scheme: "env" | "supabase-secret" | "cloudflare-secret" | "vercel-secret";
  name: string;
  raw: string;
};

const SCHEMES = new Set(["env", "supabase-secret", "cloudflare-secret", "vercel-secret"]);

export function parseSecretReference(raw: string): ParsedSecretReference {
  const trimmed = String(raw || "").trim();
  const idx = trimmed.indexOf("://");
  if (idx <= 0) throw new Error("invalid secret reference");
  const scheme = trimmed.slice(0, idx);
  const name = trimmed.slice(idx + 3).trim();
  if (!SCHEMES.has(scheme)) throw new Error(`unsupported secret reference scheme: ${scheme}`);
  if (scheme === "vault") throw new Error("vault:// is not configured in this repository");
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error("invalid secret reference name");
  return { scheme: scheme as ParsedSecretReference["scheme"], name, raw: `${scheme}://${name}` };
}

/** Resolve a secret for server use only. Never serialize the return value to clients. */
export function resolveServerSecret(raw: string): string {
  const ref = parseSecretReference(raw);
  if (ref.scheme === "cloudflare-secret") {
    throw new Error("cloudflare-secret:// is Worker-only");
  }
  if (ref.scheme === "supabase-secret") {
    throw new Error("supabase-secret:// is Edge-only");
  }
  const value = String(process.env[ref.name] || "").trim();
  return value;
}

export function secretReferenceAvailable(raw: string): { ok: boolean; reason?: string } {
  try {
    const ref = parseSecretReference(raw);
    if (ref.scheme === "cloudflare-secret") return { ok: false, reason: "worker_only" };
    if (ref.scheme === "supabase-secret") return { ok: false, reason: "edge_only" };
    if (!envPresent(ref.name)) return { ok: false, reason: "missing" };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "invalid" };
  }
}
