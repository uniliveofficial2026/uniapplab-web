import { uiAccess } from '../accessMapLoader';
export function useUiAction(id: string) {
  return uiAccess.action(id);
}
