import { getActiveSession } from '../activeSnapshot';
export function useUiSession() {
  return getActiveSession();
}
