import { uiAccess } from './accessMapLoader';
export function resolveAction(id: string) {
  return uiAccess.action(id);
}
