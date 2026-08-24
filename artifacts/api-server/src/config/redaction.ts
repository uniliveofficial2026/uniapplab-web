const SECRETISH =
  /(SECRET|PASSWORD|PRIVATE_KEY|SERVICE_ROLE|SIGNING_KEY|WEBHOOK_SECRET|ACCESS_KEY|TOKEN|API_SECRET)/i;

export function redactRecord(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SECRETISH.test(k)) out[k] = "[REDACTED]";
    else if (v && typeof v === "object" && !Array.isArray(v)) out[k] = redactRecord(v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}

export function redactErrorMessage(message: string): string {
  return String(message || "")
    .replace(/-----BEGIN [\s\S]+?PRIVATE KEY-----/g, "[REDACTED]")
    .replace(/\bsk_(live|test)_[A-Za-z0-9]+/g, "[REDACTED]")
    .replace(/\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, "[REDACTED]");
}
