/** Auth visual resolution — no auth logic. */

import { resolveBrandRegistryUrl } from '../../../lib/unilives-assets/brandResolve';
import { resolveAsset } from '../../../lib/unilives-assets/resolver';
import type { AssetResolveOptions } from '../../../lib/unilives-assets/types';

export type AuthVisualMode =
  | 'welcome'
  | 'login'
  | 'signup'
  | 'otp'
  | 'verification'
  | 'password-recovery';

export function authModeFromLaunchMode(
  mode: 'login' | 'signup' | 'forgot' | 'reset',
  emailMethod?: 'password' | 'otp',
): AuthVisualMode {
  if (mode === 'forgot' || mode === 'reset') return 'password-recovery';
  if (emailMethod === 'otp') return 'otp';
  if (mode === 'signup') return 'signup';
  return 'login';
}

export function resolveAuthAssetUrl(assetId: string, options?: AssetResolveOptions): string {
  const asset = resolveAsset(assetId);
  if (asset.status === 'missing' || asset.status === 'deprecated') {
    return resolveBrandRegistryUrl('brand.logo.icon', options);
  }
  return resolveBrandRegistryUrl(assetId, options);
}

export function hasProductionAuthAsset(assetId: string): boolean {
  const asset = resolveAsset(assetId);
  return asset.status === 'production' || asset.status === 'placeholder';
}

/** Tokenized input class — preserves form semantics; visual only. */
export const unilivesAuthInputClass =
  'w-full rounded-xl border border-[color:var(--color-unilives-auth-border)] bg-[color:var(--color-unilives-auth-input)] px-4 py-3 text-[15px] font-medium text-[color:var(--color-unilives-auth-text)] outline-none focus:ring-2 focus:ring-[color:var(--color-unilives-auth-focus)]/40';
