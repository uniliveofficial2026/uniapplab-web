let authHeaderCache: { headers: HeadersInit; exp: number } | null = null;
const AUTH_HEADER_TTL_MS = 8_000;

export function readApiAuthHeaderCache(): HeadersInit | null {
  if (authHeaderCache && authHeaderCache.exp > Date.now()) return authHeaderCache.headers;
  authHeaderCache = null;
  return null;
}

export function writeApiAuthHeaderCache(headers: HeadersInit): void {
  authHeaderCache = { headers, exp: Date.now() + AUTH_HEADER_TTL_MS };
}

export function clearApiAuthHeaderCache(): void {
  authHeaderCache = null;
}
