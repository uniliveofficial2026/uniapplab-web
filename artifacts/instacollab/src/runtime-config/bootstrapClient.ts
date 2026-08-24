import { apiBaseUrl } from '../lib/platformApi';
import { parsePublicBootstrap, type PublicBootstrapResponse } from './publicConfigSchema';
import { assertNoSecretFields, isPublicConfigCompatible } from './compatibility';
import { bundledBootstrap, readLastKnownGood, unsafeForStaleFinancialOrAuth, writeLastKnownGood } from './fallback';

export async function fetchPublicBootstrap(signal?: AbortSignal): Promise<PublicBootstrapResponse> {
  const res = await fetch(`${apiBaseUrl()}/api/app-config/bootstrap`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
  });
  if (!res.ok) throw new Error(`bootstrap_http_${res.status}`);
  const json = await res.json();
  const parsed = parsePublicBootstrap(json);
  assertNoSecretFields(parsed.public as unknown as Record<string, unknown>);
  if (!isPublicConfigCompatible(parsed.schemaVersion, parsed.environment)) {
    throw new Error('incompatible_public_config');
  }
  return parsed;
}

export async function loadPublicRuntimeConfig(): Promise<{
  config: PublicBootstrapResponse;
  source: 'network' | 'last-known-good' | 'bundled';
  financialSafe: boolean;
}> {
  try {
    const config = await fetchPublicBootstrap();
    writeLastKnownGood(config);
    return { config, source: 'network', financialSafe: true };
  } catch {
    const lkg = readLastKnownGood();
    if (lkg && !unsafeForStaleFinancialOrAuth(lkg)) {
      return { config: lkg, source: 'last-known-good', financialSafe: false };
    }
    return { config: bundledBootstrap(), source: 'bundled', financialSafe: false };
  }
}
