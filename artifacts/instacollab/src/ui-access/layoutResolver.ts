import { uiAccess } from './accessMapLoader';
export function resolveLayout(id: string) {
  return uiAccess.layout(id);
}
