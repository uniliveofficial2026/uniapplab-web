import React from 'react';
import { hasProductionAuthAsset, resolveAuthAssetUrl, type AuthVisualMode } from './authResolve';

type Props = {
  mode: AuthVisualMode;
  hasCustomBackground?: boolean;
  className?: string;
};

/** Optional registry background. Missing production → null (shell orbs remain). */
export function UniLivesAuthBackground({
  mode,
  hasCustomBackground = false,
  className = 'pointer-events-none absolute inset-0',
}: Props) {
  if (hasCustomBackground) return null;
  const id = `auth.${mode}.background`;
  if (!hasProductionAuthAsset(id)) return null;
  const src = resolveAuthAssetUrl(id);
  return (
    <div className={className} aria-hidden data-unilives-auth-bg={mode}>
      <img src={src} alt="" className="h-full w-full object-cover opacity-35" />
      <div className="absolute inset-0 bg-[color:var(--color-unilives-auth-background)]/75" />
    </div>
  );
}
