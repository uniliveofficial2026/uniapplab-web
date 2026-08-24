import { uiAccess } from './accessMapLoader';
export function resolveTheme(id?: string) {
  return uiAccess.theme(id);
}
