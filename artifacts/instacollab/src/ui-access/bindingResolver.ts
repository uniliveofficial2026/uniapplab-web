import { uiAccess } from './accessMapLoader';
export function resolveBinding(id: string) {
  return uiAccess.binding(id);
}
