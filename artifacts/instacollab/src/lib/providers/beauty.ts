/**
 * Beauty provider adapters — map to existing Tencent / DeepAR code.
 * Banuba / Agora are stubs until credentials exist. No UI changes.
 */
import type { BeautyProviderId } from '../../types/platform';

export type BeautyProvider = {
  id: BeautyProviderId;
  label: string;
  available: boolean;
  note: string;
};

const PROVIDERS: Record<BeautyProviderId, BeautyProvider> = {
  tencent: {
    id: 'tencent',
    label: 'Tencent WebAR',
    available: true,
    note: 'Implemented via lib/webar/useTencentWebAR and related modules.',
  },
  deepar: {
    id: 'deepar',
    label: 'DeepAR',
    available: true,
    note: 'Implemented via lib/deepar/useDeepAR.',
  },
  banuba: {
    id: 'banuba',
    label: 'Banuba',
    available: false,
    note: 'Stub — wire SDK when Banuba license is configured.',
  },
  agora: {
    id: 'agora',
    label: 'Agora Extensions',
    available: false,
    note: 'Stub — wire Agora beauty extension when configured.',
  },
};

export function listBeautyProviders(): BeautyProviderId[] {
  return Object.keys(PROVIDERS) as BeautyProviderId[];
}

export function getBeautyProvider(id: BeautyProviderId): BeautyProvider {
  return PROVIDERS[id] ?? PROVIDERS.tencent;
}
