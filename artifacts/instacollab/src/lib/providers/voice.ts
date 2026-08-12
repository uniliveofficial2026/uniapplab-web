/**
 * Voice effect provider adapters.
 * Custom DSP is available; Agora / Tencent Effects stubs until wired.
 */
import type { VoiceProviderId } from '../../types/platform';

export type VoiceProvider = {
  id: VoiceProviderId;
  label: string;
  available: boolean;
  note: string;
};

const PROVIDERS: Record<VoiceProviderId, VoiceProvider> = {
  custom: {
    id: 'custom',
    label: 'Custom DSP / Web Audio',
    available: true,
    note: 'Existing room voice-effect pipeline on published audio tracks.',
  },
  agora: {
    id: 'agora',
    label: 'Agora Voice Effects',
    available: false,
    note: 'Stub — enable when Agora voice effects SDK is configured.',
  },
  tencent: {
    id: 'tencent',
    label: 'Tencent Effects',
    available: false,
    note: 'Stub — enable when Tencent voice effects are configured.',
  },
};

export function listVoiceProviders(): VoiceProviderId[] {
  return Object.keys(PROVIDERS) as VoiceProviderId[];
}

export function getVoiceProvider(id: VoiceProviderId): VoiceProvider {
  return PROVIDERS[id] ?? PROVIDERS.custom;
}
