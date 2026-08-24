import { uiAccess } from './accessMapLoader';
export function resolveElement(id: string) {
  return uiAccess.element(id);
}
