const SECRET_KEY = /(SECRET|PASSWORD|PRIVATE_KEY|SERVICE_ROLE|TOKEN|API_KEY)/i;

export function redactAdminAccessRecord<T extends Record<string, unknown>>(input: T): T {
  const out = { ...input };
  for (const [k, v] of Object.entries(out)) {
    if (SECRET_KEY.test(k)) (out as Record<string, unknown>)[k] = "[REDACTED]";
    else if (typeof v === "string" && /\b(sk_live_|sk_test_|-----BEGIN )/.test(v)) {
      (out as Record<string, unknown>)[k] = "[REDACTED]";
    }
  }
  return out;
}
