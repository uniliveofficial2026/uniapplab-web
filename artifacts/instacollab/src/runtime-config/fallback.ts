import { BUNDLED_BOOTSTRAP_DEFAULTS } from './generated/publicAllowlist.generated';
import type { PublicBootstrapResponse } from './publicConfigSchema';

const LKG_KEY = 'unilive_public_runtime_config_lkg_v1';

export function bundledBootstrap(): PublicBootstrapResponse {
  return {
    schemaVersion: 1,
    configVersion: BUNDLED_BOOTSTRAP_DEFAULTS.configVersion,
    environment: BUNDLED_BOOTSTRAP_DEFAULTS.environment,
    public: JSON.parse(JSON.stringify(BUNDLED_BOOTSTRAP_DEFAULTS.public)),
    checksum: 'bundled-local-safe',
  };
}

export function readLastKnownGood(): PublicBootstrapResponse | null {
  try {
    const raw = localStorage.getItem(LKG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublicBootstrapResponse;
    if (parsed.schemaVersion !== 1) return null;
    const bundledEnv = String(BUNDLED_BOOTSTRAP_DEFAULTS.environment);
    if (parsed.environment === 'production' && bundledEnv !== 'production') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLastKnownGood(cfg: PublicBootstrapResponse): void {
  try {
    localStorage.setItem(LKG_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore quota */
  }
}

export function unsafeForStaleFinancialOrAuth(cfg: PublicBootstrapResponse | null): boolean {
  if (!cfg) return true;
  if (!cfg.public.supabaseUrl || !cfg.public.supabaseAnonKey) return true;
  return false;
}
