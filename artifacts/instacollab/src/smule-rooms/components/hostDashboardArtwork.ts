/**
 * Locked UniLive host-dashboard artworks — one design per analyzed metric pillar.
 * `v` busts CDN/browser cache when artwork files are redesigned.
 */

export const HOST_DASHBOARD_ART_ROOT = '/unilives-assets/brand/host-dashboard';
const v = 'v3';

export const HOST_DASHBOARD_ART = {
  liveScore: `${HOST_DASHBOARD_ART_ROOT}/live-score.svg?${v}`,
  audience: `${HOST_DASHBOARD_ART_ROOT}/audience.svg?${v}`,
  engagement: `${HOST_DASHBOARD_ART_ROOT}/engagement.svg?${v}`,
  earnings: `${HOST_DASHBOARD_ART_ROOT}/earnings.svg?${v}`,
  network: `${HOST_DASHBOARD_ART_ROOT}/network.svg?${v}`,
  insights: `${HOST_DASHBOARD_ART_ROOT}/insights.svg?${v}`,
  duration: `${HOST_DASHBOARD_ART_ROOT}/duration.svg?${v}`,
} as const;

export type HostDashboardArtKey = keyof typeof HOST_DASHBOARD_ART;

export function hostDashboardArtUrl(key: HostDashboardArtKey | string): string {
  if (key in HOST_DASHBOARD_ART) {
    return HOST_DASHBOARD_ART[key as HostDashboardArtKey];
  }
  return HOST_DASHBOARD_ART.insights;
}
