import { uiAccess } from '../accessMapLoader';
export function useUiTheme(id?: string) {
  return uiAccess.theme(id);
}
