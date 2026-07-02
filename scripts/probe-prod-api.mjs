/**
 * Shared production API health probe — detects SPA-only deploys (HTML instead of JSON).
 */
export async function probeProdApi(origin, apiPath, options = {}) {
  const retries = options.retries ?? 2;
  const delayMs = options.delayMs ?? 2500;
  const url = `${origin.replace(/\/$/, '')}${apiPath}`;

  let last = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      },
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      if (/^<!doctype/i.test(text.trim())) {
        last = {
          ok: false,
          status: res.status,
          reason:
            'API routes not deployed — /api/* is serving the SPA. Ensure repo-root vercel.json exists and redeploy (pnpm run deploy:vercel:git).',
        };
        continue;
      }
      last = {
        ok: false,
        status: res.status,
        reason: `non-json response (${contentType}): ${text.slice(0, 120)}`,
      };
      continue;
    }

    const body = await res.json();
    return { ok: res.ok, status: res.status, body };
  }

  return last ?? { ok: false, reason: 'probe failed' };
}
