import { getActiveSnapshot } from '../activeSnapshot';
export function useUiSnapshot() {
  return getActiveSnapshot();
}
