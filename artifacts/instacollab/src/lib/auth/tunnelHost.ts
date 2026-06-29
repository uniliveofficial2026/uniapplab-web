/** Hostnames used by quick tunnels in this repo (see npm run dev:public). */
export function isDevTunnelHostname(hostname: string): boolean {
  return /\.trycloudflare\.com$/i.test(hostname) || /\.loca\.lt$/i.test(hostname);
}

export function isDevTunnelOrigin(origin?: string): boolean {
  if (!origin && typeof window === 'undefined') return false;
  try {
    const host = new URL(origin ?? window.location.href).hostname;
    return isDevTunnelHostname(host);
  } catch {
    return false;
  }
}

/** Firebase Authorized domains entry (hostname only). */
export function tunnelAuthorizedDomain(hostname: string): string {
  return hostname;
}
