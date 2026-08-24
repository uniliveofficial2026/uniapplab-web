/** Single source of truth for UniLive platform version. */
export const PLATFORM_VERSION = '0.1.0';
export const PLATFORM_CHANNEL = 'stable';
export const PLATFORM_NAME = 'UniLive';
export const STAGE_C_BASELINE = '6e178efda203a31d947d6afd99a59784936f5598';
export const STAGE_B_BASELINE = 'fb94cafc120995006c6368d30b7df32ae94dcea3';
export const STAGE_A_BASELINE = '4786a68';

export function getPlatformVersionInfo() {
  return {
    name: PLATFORM_NAME,
    version: PLATFORM_VERSION,
    channel: PLATFORM_CHANNEL,
    stageABaseline: STAGE_A_BASELINE,
    stageBBaseline: STAGE_B_BASELINE,
    stageCBaseline: STAGE_C_BASELINE,
  };
}
