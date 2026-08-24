import { uiAccess } from './accessMapLoader';
export function resolveContent(id: string) {
  return uiAccess.content(id);
}
