import { uiAccess } from '../accessMapLoader';
export function useUiNode(id: string) {
  return uiAccess.node(id);
}
