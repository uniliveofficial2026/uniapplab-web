import type { ResolvedUiNode } from './types';

export type EditScope = 'INSTANCE' | 'SHARED_PRESET';

export function applyNodeOverride(
  nodes: ResolvedUiNode[],
  targetId: string,
  patch: Partial<Pick<ResolvedUiNode, 'componentId' | 'elementId' | 'iconAssetId' | 'motionId'>>,
  scope: EditScope = 'INSTANCE',
): ResolvedUiNode[] {
  const target = nodes.find((n) => n.id === targetId);
  if (!target) return nodes;
  const match = (n: ResolvedUiNode) =>
    scope === 'SHARED_PRESET' ? Boolean(target.elementId && n.elementId === target.elementId) : n.id === targetId;
  return nodes.map((n) => (match(n) ? { ...n, ...patch, id: n.id, actionIds: n.actionIds, dataBindingId: n.dataBindingId } : n));
}

export function independenceProof(before: ResolvedUiNode[], after: ResolvedUiNode[], targetId: string) {
  const b = before.find((n) => n.id === targetId);
  const a = after.find((n) => n.id === targetId);
  const siblingsChanged = after.some((n, i) => n.id !== targetId && JSON.stringify(n) !== JSON.stringify(before[i]));
  return {
    targetChanged: JSON.stringify(b) !== JSON.stringify(a),
    siblingsChanged,
    actionChanged: JSON.stringify(b?.actionIds) !== JSON.stringify(a?.actionIds),
    bindingChanged: b?.dataBindingId !== a?.dataBindingId,
    backendChanged: false,
  };
}
