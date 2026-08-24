/**
 * Central redaction for logs/observe — never persist secrets.
 */

const SENSITIVE_KEY =
  /^(authorization|cookie|password|passwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?token|refresh[_-]?token|session|jwt|credential|fcm|apns)/i;

const SENSITIVE_VALUE =
  /\b(eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|sk-[a-zA-Z0-9]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]+PRIVATE KEY-----)\b/;

/**
 * @param {Record<string, unknown>} fields
 */
export function redactFields(fields = {}) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = '[redacted]';
      continue;
    }
    if (typeof v === 'string' && SENSITIVE_VALUE.test(v)) {
      out[k] = '[redacted]';
      continue;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactFields(/** @type {Record<string, unknown>} */ (v));
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function redactString(message) {
  return String(message || '').replace(SENSITIVE_VALUE, '[redacted]');
}
