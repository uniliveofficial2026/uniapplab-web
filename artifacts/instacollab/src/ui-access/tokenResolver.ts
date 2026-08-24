import { uiAccess } from './accessMapLoader';
export function resolveTokens(id?: string) {
  return uiAccess.tokens(id);
}
