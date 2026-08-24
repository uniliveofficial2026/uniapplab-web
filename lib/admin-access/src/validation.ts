const CODE_RE = /<\s*script|javascript:|new\s+Function|eval\s*\(|import\s*\(/i;
const SECRET_RE = /\b(sk_live_|sk_test_|-----BEGIN |SERVICE_ROLE|eyJ[a-zA-Z0-9_-]{20,}\.)/;
const AUTHORITY = ["wallet.balance", "gift.price", "entitlement.grant", "identity.role", "live.room_type", "pk.score", "livekit.grant"];

export type AccessValidationIssue = { path: string; code: string; message: string };

export function validateAdminAccessPatch(patch: unknown, path = "$"): AccessValidationIssue[] {
  const out: AccessValidationIssue[] = [];
  walk(patch, path, out);
  return out;
}

function walk(value: unknown, path: string, out: AccessValidationIssue[]): void {
  if (value == null) return;
  if (typeof value === "string") {
    if (CODE_RE.test(value)) out.push({ path, code: "forbidden_code", message: "executable payload rejected" });
    if (SECRET_RE.test(value)) out.push({ path, code: "secret_value_forbidden", message: "secret values are not accepted" });
    return;
  }
  if (typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`, out));
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const next = `${path}.${k}`;
    if (AUTHORITY.some((p) => next.endsWith(p) || k === p)) {
      out.push({ path: next, code: "authority_forbidden", message: "catalog cannot alter canonical authority" });
    }
    walk(v, next, out);
  }
}
