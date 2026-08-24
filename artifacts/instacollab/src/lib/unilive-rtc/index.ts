/**
 * UniLiveRTC public entry for the reference app.
 * Product code should prefer this over direct livekit-client usage.
 */
export { createUniLiveRTC } from '@unilives/rtc-client';
export { createFakeRTCProvider } from '@unilives/rtc-fake';
export {
  createCallOrchestrator,
  createPkOrchestrator,
  createSeatOrchestrator,
  createRoomOrchestrator,
  createLiveOrchestrator,
  createRtcRuntime,
  createEventEnvelope,
} from '@unilives/rtc-core';
export { createQoeGovernor, publishProfileForQoe, classifyQoe } from '@unilives/rtc-qoe';
export { createUniLiveRealtime } from '@unilives/realtime';

/**
 * Create production media provider (LiveKit) behind UniLiveRTC contract.
 * Falls back guidance if livekit-client missing (tests use fake).
 */
export async function createReferenceRtcProvider(options: {
  identity?: string;
  roomType?: import('@unilives/rtc-contracts').UniLiveRoomType;
  preferFake?: boolean;
} = {}) {
  if (options.preferFake) {
    const { createFakeRTCProvider } = await import('@unilives/rtc-fake');
    return createFakeRTCProvider(options);
  }
  try {
    const { createLiveKitRTCProvider } = await import('@unilives/rtc-livekit');
    return await createLiveKitRTCProvider(options);
  } catch {
    const { createFakeRTCProvider } = await import('@unilives/rtc-fake');
    return createFakeRTCProvider(options);
  }
}
