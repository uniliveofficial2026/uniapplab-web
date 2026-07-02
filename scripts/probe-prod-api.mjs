/**
 * Shared production API health probe — detects SPA-only deploys (HTML instead of JSON).
 */
export async function probeProdApi(origin, apiPath) {
  const url = `${origin.replace(/\/$/, '')}${apiPath}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (/^<!doctype/i.test(text.trim())) {
      return {
        ok: false,
        status: res.status,
        reason:
          'API routes not deployed — /api/* is serving the SPA. Redeploy with api-server (pnpm run deploy:vercel or git push).',
      };
    }
    return { ok: false, status: res.status, reason: `non-json response: ${text.slice(0, 120)}` };
  }
  const body = await res.json();
  return { ok: res.ok, status: res.status, body };
}
