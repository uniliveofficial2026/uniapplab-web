import { useSyncExternalStore } from 'react';
import {
  getNetworkStatus,
  subscribeNetworkStatus,
  type NetworkStatus,
} from '../lib/networkStatus';

export function useNetworkStatus(): NetworkStatus {
  return useSyncExternalStore(subscribeNetworkStatus, getNetworkStatus, () => 'online');
}

export function useIsOnline(): boolean {
  return useNetworkStatus() === 'online';
}
