import { uiAccess } from '../accessMapLoader';
export function useUiElement(id: string) {
  return uiAccess.element(id);
}
