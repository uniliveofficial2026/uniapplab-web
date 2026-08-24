import type { PublishProfile, QoeState, RtcStats } from '@unilives/rtc-contracts';

export function classifyQoe(stats: RtcStats, prev?: QoeState): QoeState;
export function publishProfileForQoe(
  state: QoeState,
  ctx?: { thermal?: 'good' | 'warm' | 'hot' | 'critical'; topologyPublishers?: number },
): PublishProfile;
export function createQoeGovernor(initial?: QoeState): {
  getState(): QoeState;
  update(
    stats: RtcStats,
    ctx?: { thermal?: 'good' | 'warm' | 'hot' | 'critical'; topologyPublishers?: number },
  ): { state: QoeState; publishProfile: PublishProfile };
};
