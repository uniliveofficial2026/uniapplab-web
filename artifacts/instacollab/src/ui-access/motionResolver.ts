import { uiAccess } from './accessMapLoader';
export function resolveMotion(id: string) {
  return uiAccess.motion(id);
}
