import { uiAccess } from '../accessMapLoader';
export function useUiMotion(id: string) {
  return uiAccess.motion(id);
}
