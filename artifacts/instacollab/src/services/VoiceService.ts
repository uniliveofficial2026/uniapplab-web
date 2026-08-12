/**
 * VoiceService — provider abstraction for voice effects / changers.
 */
import type { ServiceResult, VoiceProviderId } from '../types/platform';
import {
  getVoiceProvider,
  listVoiceProviders,
  type VoiceProvider,
} from '../lib/providers/voice';

export interface VoiceService {
  listProviders(): VoiceProviderId[];
  getActiveProviderId(): VoiceProviderId;
  setActiveProviderId(id: VoiceProviderId): ServiceResult<void>;
  getProvider(id?: VoiceProviderId): VoiceProvider;
}

let activeProviderId: VoiceProviderId = 'custom';

class VoiceServiceImpl implements VoiceService {
  listProviders(): VoiceProviderId[] {
    return listVoiceProviders();
  }

  getActiveProviderId(): VoiceProviderId {
    return activeProviderId;
  }

  setActiveProviderId(id: VoiceProviderId): ServiceResult<void> {
    const provider = getVoiceProvider(id);
    if (!provider.available) {
      return { ok: false, error: `voice_provider_unavailable:${id}` };
    }
    activeProviderId = id;
    return { ok: true, data: undefined };
  }

  getProvider(id?: VoiceProviderId): VoiceProvider {
    return getVoiceProvider(id ?? activeProviderId);
  }
}

export const voiceService: VoiceService = new VoiceServiceImpl();
