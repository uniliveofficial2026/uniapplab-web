import { uiAccess } from './accessMapLoader';
export function resolveNode(id: string) {
  return uiAccess.node(id);
}
