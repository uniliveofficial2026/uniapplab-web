import { uiAccess } from '../accessMapLoader';
export function useUiTokens(id?: string) {
  return uiAccess.tokens(id);
}
