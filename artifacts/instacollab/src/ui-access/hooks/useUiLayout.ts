import { uiAccess } from '../accessMapLoader';
export function useUiLayout(id: string) {
  return uiAccess.layout(id);
}
