import { LIVE_UI_REGISTRY } from "./generated/liveRegistry.generated";

export type LiveActionRecord = {
  id: string;
  mapsToExistingAction: string | null;
  backendCommandSupported: boolean;
  note: string;
};

export function listLiveActions(): LiveActionRecord[] {
  return LIVE_UI_REGISTRY.actions as unknown as LiveActionRecord[];
}

export function getLiveAction(id: string): LiveActionRecord | null {
  return listLiveActions().find((a) => a.id === id) ?? null;
}

export function isRegisteredLiveAction(id: string): boolean {
  return Boolean(getLiveAction(id));
}

export function liveActionDomainTarget(id: string): string | null {
  return getLiveAction(id)?.mapsToExistingAction ?? null;
}

export const FORBIDDEN_LIVE_ACTION_PAIRS = LIVE_UI_REGISTRY.forbiddenActionPairs as unknown as ReadonlyArray<readonly [string, string]>;

export function assertLiveActionCompatible(nodeActionId: string, proposedActionId: string): void {
  if (!isRegisteredLiveAction(proposedActionId)) {
    throw new Error(`unregistered live action: ${proposedActionId}`);
  }
  for (const [from, to] of FORBIDDEN_LIVE_ACTION_PAIRS) {
    if (nodeActionId === from && proposedActionId === to) {
      throw new Error(`incompatible live action remap: ${from} → ${to}`);
    }
  }
  if (nodeActionId.startsWith("live.room.leave") && proposedActionId.startsWith("live.gift")) {
    throw new Error("leave control cannot map to gift purchase");
  }
  if (nodeActionId.includes("score") && proposedActionId.startsWith("wallet")) {
    throw new Error("score label cannot bind to wallet");
  }
}
