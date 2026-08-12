/**
 * BeautyService — provider abstraction over existing Tencent / DeepAR pipelines.
 * Banuba / Agora stubs until keys exist. No UI changes.
 */
import type { BeautyProviderId, ServiceResult } from '../types/platform';
import {
  getBeautyProvider,
  listBeautyProviders,
  type BeautyProvider,
} from '../lib/providers/beauty';

export interface BeautyService {
  listProviders(): BeautyProviderId[];
  getActiveProviderId(): BeautyProviderId;
  setActiveProviderId(id: BeautyProviderId): ServiceResult<void>;
  getProvider(id?: BeautyProviderId): BeautyProvider;
}

let activeProviderId: BeautyProviderId = 'tencent';

class BeautyServiceImpl implements BeautyService {
  listProviders(): BeautyProviderId[] {
    return listBeautyProviders();
  }

  getActiveProviderId(): BeautyProviderId {
    return activeProviderId;
  }

  setActiveProviderId(id: BeautyProviderId): ServiceResult<void> {
    const provider = getBeautyProvider(id);
    if (!provider.available) {
      return { ok: false, error: `beauty_provider_unavailable:${id}` };
    }
    activeProviderId = id;
    return { ok: true, data: undefined };
  }

  getProvider(id?: BeautyProviderId): BeautyProvider {
    return getBeautyProvider(id ?? activeProviderId);
  }
}

export const beautyService: BeautyService = new BeautyServiceImpl();
