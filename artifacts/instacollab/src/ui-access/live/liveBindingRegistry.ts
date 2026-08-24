import { LIVE_UI_REGISTRY } from "./generated/liveRegistry.generated";

export type LiveBindingRecord = {
  id: string;
  domain: string;
  viewModelType: string;
  allowedComponentIds: string[];
  privacy: string;
};

export function listLiveBindings(): LiveBindingRecord[] {
  return LIVE_UI_REGISTRY.bindings as unknown as LiveBindingRecord[];
}

export function getLiveBinding(id: string): LiveBindingRecord | null {
  return listLiveBindings().find((b) => b.id === id) ?? null;
}

export function isRegisteredLiveBinding(id: string): boolean {
  return Boolean(getLiveBinding(id));
}

export function assertLiveBindingCompatible(bindingId: string, componentId: string): void {
  const binding = getLiveBinding(bindingId);
  if (!binding) {
    throw new Error(`unregistered live binding: ${bindingId}`);
  }
  if (binding.allowedComponentIds.length && !binding.allowedComponentIds.includes(componentId)) {
    throw new Error(`binding ${bindingId} is not allowed on component ${componentId}`);
  }
  if (bindingId === "binding.live.pk-score" && /wallet/i.test(componentId)) {
    throw new Error("PK score cannot bind to wallet");
  }
}
