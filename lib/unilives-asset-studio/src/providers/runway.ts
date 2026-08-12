import { envGet } from '../config/env.js';

export function runwayConfigured(): boolean {
  return Boolean(envGet('RUNWAY_API_KEY'));
}

/**
 * Runway calls are expected via the authenticated Runway MCP in interactive sessions,
 * or a future HTTP client. This module only exposes configuration + dry-run planning.
 */
export function runwayPlanAnimation(opts: { canonicalId: string; startFramePath: string }) {
  if (!runwayConfigured()) throw new Error('RUNWAY_API_KEY is missing');
  return {
    provider: 'runway' as const,
    canonicalId: opts.canonicalId,
    startFramePath: opts.startFramePath,
    planned: true,
    note: 'Use Runway MCP generate_video / edit_video outside dry-run with one paid call max.',
  };
}
