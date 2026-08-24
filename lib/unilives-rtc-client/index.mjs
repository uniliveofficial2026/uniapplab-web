import { createRtcRuntime } from '@unilives/rtc-core';

/**
 * Public UniLiveRTC client. Product code should use this instead of LiveKit Room.
 * @param {{ provider: import('@unilives/rtc-contracts').UniLivesRTCProvider, roomType?: import('@unilives/rtc-contracts').UniLiveRoomType }} options
 */
export function createUniLiveRTC(options) {
  if (!options?.provider) throw new Error('provider_required');
  const runtime = createRtcRuntime({ provider: options.provider });

  return {
    runtime,
    /**
     * @param {{ roomId: string, token: string, url: string, canonicalUserId: string, role?: import('@unilives/rtc-contracts').RtcRole }} input
     */
    async joinRoom(input) {
      if (!runtime.roomOrchestrator.getRoom(input.roomId)) {
        runtime.roomOrchestrator.createRoom({
          roomId: input.roomId,
          roomType: options.roomType || 'LIVE',
          hostUserId: input.canonicalUserId,
        });
      }
      const joined = await runtime.roomOrchestrator.join(input);
      return {
        session: joined.session,
        room: joined.room,
        async enableCamera(track) {
          return options.provider.publishCamera(track);
        },
        async enableMicrophone(track) {
          return options.provider.publishMicrophone(track);
        },
        get participants() {
          return joined.session.participants;
        },
        get connection() {
          return options.provider.getConnectionState();
        },
        async getNetwork() {
          const stats = await options.provider.getStats();
          return runtime.qoe.update(stats);
        },
        async leave() {
          return runtime.roomOrchestrator.leave({
            roomId: input.roomId,
            canonicalUserId: input.canonicalUserId,
          });
        },
      };
    },
  };
}
