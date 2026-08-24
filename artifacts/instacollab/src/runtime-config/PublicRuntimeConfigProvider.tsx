import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadPublicRuntimeConfig } from './bootstrapClient';
import { bundledBootstrap } from './fallback';
import type { PublicBootstrapResponse } from './publicConfigSchema';
import { setActivePublicConfigVersion } from './activePublicVersion';

type Ctx = {
  config: PublicBootstrapResponse;
  source: 'network' | 'last-known-good' | 'bundled';
  financialSafe: boolean;
  publicConfigVersion: number;
};

const RuntimeCfg = createContext<Ctx | null>(null);

export function PublicRuntimeConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Ctx>(() => ({
    config: bundledBootstrap(),
    source: 'bundled',
    financialSafe: false,
    publicConfigVersion: bundledBootstrap().configVersion,
  }));

  useEffect(() => {
    let cancelled = false;
    void loadPublicRuntimeConfig().then((next) => {
      if (cancelled) return;
      setActivePublicConfigVersion(next.config.configVersion);
      setState({
        config: next.config,
        source: next.source,
        financialSafe: next.financialSafe,
        publicConfigVersion: next.config.configVersion,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <RuntimeCfg.Provider value={value}>{children}</RuntimeCfg.Provider>;
}

export function usePublicRuntimeConfig(): Ctx {
  const ctx = useContext(RuntimeCfg);
  if (!ctx) {
    const bundled = bundledBootstrap();
    return {
      config: bundled,
      source: 'bundled',
      financialSafe: false,
      publicConfigVersion: bundled.configVersion,
    };
  }
  return ctx;
}

export function sessionPublicConfigMeta(ctx: Ctx) {
  return {
    publicConfigVersion: ctx.publicConfigVersion,
    environment: ctx.config.environment,
  };
}
