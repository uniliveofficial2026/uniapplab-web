import { findComponent, uiAccess } from './accessMapLoader';
import type { ResolvedExperience } from './types';

export type UiExperienceHandle = {
  id: string;
  record: ResolvedExperience;
  element(nodeId: string): ReturnType<typeof uiAccess.node>;
  component(componentId: string): ReturnType<typeof uiAccess.component>;
  asset(assetId: string): ReturnType<typeof uiAccess.asset>;
  action(actionId: string): ReturnType<typeof uiAccess.action>;
  binding(bindingId: string): ReturnType<typeof uiAccess.binding>;
};

function nodeIdFor(record: ResolvedExperience, nodeId: string): string {
  if (nodeId.startsWith('node.')) return nodeId;
  if (nodeId.startsWith(record.key)) return `node.${nodeId}`;
  return `node.${record.key}.${nodeId}`;
}

export function resolveExperience(id: string): UiExperienceHandle {
  const record = uiAccess.experience(id);
  return {
    id: record.id,
    record,
    element: (nodeId) => uiAccess.node(nodeIdFor(record, nodeId)),
    component: (componentId) => {
      const direct = findComponent(componentId);
      if (direct) return direct;
      const node = uiAccess.node(nodeIdFor(record, componentId));
      return uiAccess.component(node.componentId);
    },
    asset: (assetId) => uiAccess.asset(assetId),
    action: (actionId) => uiAccess.action(actionId),
    binding: (bindingId) => uiAccess.binding(bindingId),
  };
}
