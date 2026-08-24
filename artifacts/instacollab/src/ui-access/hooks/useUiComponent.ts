import { uiAccess } from '../accessMapLoader';
export function useUiComponent(id: string) {
  return uiAccess.component(id);
}
