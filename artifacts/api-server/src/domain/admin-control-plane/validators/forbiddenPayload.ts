const FORBIDDEN_KEYS =
  /^(sql|javascript|js|jsx|html|css|eval|secret|apiUrl|api_url|href|onclick|innerHTML|dangerouslySetInnerHTML|roleOverride|walletAmount|walletBalance|giftPrice|entitlement|livekitGrant|pkScore|identityRole|serviceRole|privateKey)$/i;
const CODE_RE = /<\s*script|javascript:|new\s+Function|eval\s*\(|import\s*\(/i;
const SECRET_VALUE_RE = /\b(sk_live_|sk_test_|-----BEGIN |SERVICE_ROLE|eyJ[a-zA-Z0-9_-]{20,}\.)/;
const AUTHORITY_PATHS = ["wallet.balance", "gift.price", "entitlement.grant", "identity.role", "live.room_type", "pk.score", "livekit.grant"];

export type PayloadIssue = { path: string; code: string; message: string };

export function validateAdminPatch(patch: unknown, path = "$"): PayloadIssue[] {
  const out: PayloadIssue[] = [];
  walk(patch, path, out);
  return out;
}

function walk(value: unknown, path: string, out: PayloadIssue[]): void {
  if (value == null) return;
  if (typeof value === "string") {
    if (CODE_RE.test(value)) out.push({ path, code: "forbidden_code", message: "executable payload rejected" });
    if (SECRET_VALUE_RE.test(value)) out.push({ path, code: "secret_value_forbidden", message: "secret values are not accepted" });
    return;
  }
  if (typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`, out));
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const next = `${path}.${k}`;
    if (FORBIDDEN_KEYS.test(k)) out.push({ path: next, code: "forbidden_key", message: k });
    if (AUTHORITY_PATHS.some((p) => next.endsWith(p) || k === p)) {
      out.push({ path: next, code: "authority_forbidden", message: "UI/config cannot alter canonical authority" });
    }
    walk(v, next, out);
  }
}
