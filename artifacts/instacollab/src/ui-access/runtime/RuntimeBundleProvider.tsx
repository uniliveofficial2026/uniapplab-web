import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { detectCapability, selectTier, type CapabilitySnapshot, type DeviceTier } from "./capabilityProfile";
import { lastKnownGood, fetchCompatibleBundle } from "./runtimeBundleClient";
import { scheduleAtomicActivation } from "./activationCoordinator";
import type { CachedBundle } from "./runtimeBundleCache";

type Ctx = {
  bundle: CachedBundle;
  tier: DeviceTier;
  capability: CapabilitySnapshot;
  activating: boolean;
};

const RuntimeBundleContext = createContext<Ctx | null>(null);

export function RuntimeBundleProvider({ children }: { children: ReactNode }) {
  const capability = useMemo(() => detectCapability(), []);
  const tier = useMemo(() => selectTier(capability), [capability]);
  const [bundle, setBundle] = useState<CachedBundle>(() => lastKnownGood());
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setActivating(true);
    void fetchCompatibleBundle(ac.signal)
      .then((next) => {
        scheduleAtomicActivation(() => setBundle(next));
      })
      .finally(() => setActivating(false));
    return () => ac.abort();
  }, []);

  const value = useMemo(() => ({ bundle, tier, capability, activating }), [bundle, tier, capability, activating]);
  return <RuntimeBundleContext.Provider value={value}>{children}</RuntimeBundleContext.Provider>;
}

export function useRuntimeBundle(): Ctx {
  const ctx = useContext(RuntimeBundleContext);
  if (!ctx) {
    return {
      bundle: lastKnownGood(),
      tier: "tier-2-medium",
      capability: detectCapability(),
      activating: false,
    };
  }
  return ctx;
}
