import {
  assertLiveActionCompatible,
  getLiveAction,
  liveActionDomainTarget,
} from "../../ui-access/live/liveActionRegistry";

/**
 * Presentation action → domain service. Components never write Supabase tables.
 */
export function dispatchLiveAction(actionId: string, _payload: Record<string, unknown> = {}) {
  const rec = getLiveAction(actionId);
  if (!rec) {
    throw new Error(`unregistered live action: ${actionId}`);
  }
  assertLiveActionCompatible(actionId, actionId);
  return {
    actionId,
    domainAction: liveActionDomainTarget(actionId),
    backendCommandSupported: rec.backendCommandSupported,
    note: rec.note,
  };
}
