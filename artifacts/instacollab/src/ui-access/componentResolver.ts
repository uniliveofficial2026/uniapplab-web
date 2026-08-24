import { uiAccess } from './accessMapLoader';
export function resolveComponent(id: string) {
  return uiAccess.component(id);
}
