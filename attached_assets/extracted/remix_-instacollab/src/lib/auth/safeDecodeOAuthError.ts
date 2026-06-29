/** decodeURIComponent throws on malformed % sequences — must not crash the auth flow. */
export function safeDecodeOAuthError(raw: string): string {
  const normalized = raw.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}
