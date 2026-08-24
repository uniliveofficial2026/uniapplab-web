import { uiAccess } from '../accessMapLoader';
export function useUiAsset(id: string) {
  return uiAccess.asset(id);
}
