import { listLiveNodes } from "./liveNodeRegistry";

export type LiveComponentRecord = {
  componentId: string;
  nodeIds: string[];
  sourcePaths: string[];
  replaceable: boolean;
};

export function listLiveComponents(): LiveComponentRecord[] {
  const map = new Map<string, LiveComponentRecord>();
  for (const node of listLiveNodes()) {
    const rec = map.get(node.componentId) || {
      componentId: node.componentId,
      nodeIds: [],
      sourcePaths: [],
      replaceable: node.replaceable,
    };
    rec.nodeIds.push(node.nodeId);
    if (!rec.sourcePaths.includes(node.sourcePath)) rec.sourcePaths.push(node.sourcePath);
    rec.replaceable = rec.replaceable && node.replaceable;
    map.set(node.componentId, rec);
  }
  return [...map.values()];
}

export function getLiveComponent(componentId: string): LiveComponentRecord | null {
  return listLiveComponents().find((c) => c.componentId === componentId) ?? null;
}

export function isRegisteredLiveComponent(componentId: string): boolean {
  return Boolean(getLiveComponent(componentId));
}
