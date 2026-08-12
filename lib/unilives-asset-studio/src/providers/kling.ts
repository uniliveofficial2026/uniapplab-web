import { envGet } from '../config/env.js';

export function klingConfigured(): boolean {
  const api = envGet('KLING_API_KEY');
  if (api) return true;
  return Boolean(envGet('KLING_ACCESS_KEY') && envGet('KLING_SECRET_KEY'));
}

export function klingPlanAnimation(opts: { canonicalId: string; startFramePath: string }) {
  if (!klingConfigured()) throw new Error('Kling credentials missing');
  return {
    provider: 'kling' as const,
    canonicalId: opts.canonicalId,
    startFramePath: opts.startFramePath,
    planned: true,
    note: 'Kling HTTP client reserved; one paid call max when dry-run is false.',
  };
}
