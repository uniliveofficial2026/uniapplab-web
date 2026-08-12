import { envGet } from '../config/env.js';

const MESHY_BASE = 'https://api.meshy.ai';

export function meshyConfigured(): boolean {
  return Boolean(envGet('MESHY_API_KEY'));
}

/** Paid Meshy call stub — not invoked during package construction / dry-run. */
export async function meshyCreateTextTo3d(body: Record<string, unknown>): Promise<{ dryRun?: boolean; status: string; body?: unknown }> {
  const key = envGet('MESHY_API_KEY');
  if (!key) throw new Error('MESHY_API_KEY is missing');
  const res = await fetch(`${MESHY_BASE}/openapi/v2/text-to-3d`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Meshy request failed with status ${res.status}`);
  }
  return { status: 'submitted', body: await res.json() };
}
