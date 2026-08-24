import { useSyncExternalStore } from 'react';
import {
  getProductionOneVsOnePkGate,
  shouldSuppressLegacyOneVsOnePkStage,
  subscribeProductionOneVsOnePkGate,
} from '../lib/live/productionOneVsOnePkGate';

export function useSuppressLegacyOneVsOnePkStage(): boolean {
  return useSyncExternalStore(
    subscribeProductionOneVsOnePkGate,
    shouldSuppressLegacyOneVsOnePkStage,
    () => false,
  );
}

export function useProductionOneVsOnePkGate() {
  return useSyncExternalStore(
    subscribeProductionOneVsOnePkGate,
    getProductionOneVsOnePkGate,
    getProductionOneVsOnePkGate,
  );
}
