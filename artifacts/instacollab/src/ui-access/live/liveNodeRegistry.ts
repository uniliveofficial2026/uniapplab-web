import { LIVE_UI_REGISTRY } from "./generated/liveRegistry.generated";
import type { LiveExperienceId, LiveNodeDefinition } from "./contracts";

export function listLiveNodes(): LiveNodeDefinition[] {
  return LIVE_UI_REGISTRY.nodes as unknown as LiveNodeDefinition[];
}

export function getLiveNode(nodeId: string): LiveNodeDefinition | null {
  return listLiveNodes().find((n) => n.nodeId === nodeId) ?? null;
}

export function liveNodesForExperience(experienceId: LiveExperienceId): LiveNodeDefinition[] {
  return listLiveNodes().filter((n) => n.allowedExperienceIds.includes(experienceId));
}

export function requiredLiveNodeIds(experienceId: LiveExperienceId): string[] {
  return liveNodesForExperience(experienceId).filter((n) => n.required).map((n) => n.nodeId);
}

export function liveTemplateNodeIds(): string[] {
  return listLiveNodes().filter((n) => n.template).map((n) => n.nodeId);
}
