import { uiAccess } from './accessMapLoader';
export function resolveAsset(id: string) {
  return uiAccess.asset(id);
}
