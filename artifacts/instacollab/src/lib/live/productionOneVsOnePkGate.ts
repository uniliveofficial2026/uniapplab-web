/**
 * Shared gate: server-authoritative PK (1v1, team, Live Sell) owns presentation via PkLiveOverlay.
 * Legacy PKBattleStage must not render for this flow.
 */

type ProductionOneVsOnePkGateState = {
  /** createPkChallenge succeeded and is still pending/outgoing. */
  challengePending: boolean;
  /** Canonical active pk_1v1 session id (from inbox/accept). */
  activePkId: string | null;
  /** Overlay currently presenting challenge or OneVsOnePkRoom. */
  overlayMounted: boolean;
};

type Listener = () => void;

let lastRoute: Record<string, unknown> = {};

let state: ProductionOneVsOnePkGateState = {
  challengePending: false,
  activePkId: null,
  overlayMounted: false,
};

const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function getProductionOneVsOnePkGate(): ProductionOneVsOnePkGateState {
  return state;
}

/** True when Room must hide PKBattleStage for single/1v1 mode. */
export function shouldSuppressLegacyOneVsOnePkStage(): boolean {
  return Boolean(state.challengePending || state.activePkId || state.overlayMounted);
}

export function setProductionPkChallengePending(pending: boolean): void {
  if (state.challengePending === pending) return;
  state = { ...state, challengePending: pending };
  emit();
}

export function setProductionPkActiveId(pkId: string | null): void {
  const next = pkId?.trim() || null;
  if (state.activePkId === next) return;
  state = { ...state, activePkId: next };
  emit();
}

export function setProductionPkOverlayMounted(mounted: boolean): void {
  if (state.overlayMounted === mounted) return;
  state = { ...state, overlayMounted: mounted };
  emit();
}

export function clearProductionOneVsOnePkGate(): void {
  state = { challengePending: false, activePkId: null, overlayMounted: false };
  emit();
}

export function subscribeProductionOneVsOnePkGate(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function logProductionPkRoute(detail: Record<string, unknown>): void {
  lastRoute = { ...detail, ts: Date.now() };
  const legacyMounted =
    typeof document !== 'undefined' &&
    Boolean(
      document.querySelector(
        '[data-ui-id="live.pk.legacy.battle-stage"], .pk-battle-stage, [data-testid="pk-battle-stage"]',
      ),
    );
  if (typeof window !== 'undefined') {
    (window as unknown as { __UNILIVE_PK_TRACE__?: unknown }).__UNILIVE_PK_TRACE__ = {
      ...lastRoute,
      gate: { ...state },
      isProductionOneVsOnePk: shouldSuppressLegacyOneVsOnePkStage(),
      legacyPkRendererMounted: legacyMounted,
      legacyPkRendererActive: legacyMounted,
      legacyPkSourceFileExists: true,
    };
  }
  if (!import.meta.env.DEV) return;
  // eslint-disable-next-line no-console
  console.info('[PK_ROUTE]', {
    ...detail,
    gate: { ...state },
    isProductionOneVsOnePk: shouldSuppressLegacyOneVsOnePkStage(),
    legacyPkRendererMounted: legacyMounted,
    legacyPkRendererActive: legacyMounted,
  });
}
