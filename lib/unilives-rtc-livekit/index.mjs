import { asRtcRoomSessionId } from '@unilives/rtc-contracts';

/**
 * LiveKit media provider adapter.
 * ONLY package allowed to import livekit-client for UniLiveRTC media transport.
 * @param {{ identity?: string, roomType?: import('@unilives/rtc-contracts').UniLiveRoomType }} [options]
 * @returns {Promise<import('@unilives/rtc-contracts').UniLivesRTCProvider>}
 */
export async function createLiveKitRTCProvider(options = {}) {
  let Room;
  let RoomEvent;
  let Track;
  try {
    const lk = await import('livekit-client');
    Room = lk.Room;
    RoomEvent = lk.RoomEvent;
    Track = lk.Track;
  } catch {
    throw Object.assign(new Error('livekit_client_unavailable'), {
      code: 'LIVEKIT_CLIENT_MISSING',
      hint: 'Install livekit-client in the consuming app, or use @unilives/rtc-fake in tests',
    });
  }

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    disconnectOnPageLeave: true,
    ...(options.roomOptions || {}),
  });
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();
  /** @type {import('@unilives/rtc-contracts').RtcConnectionState} */
  let connectionState = 'FAILED';
  /** @type {import('@unilives/rtc-contracts').PublishProfile} */
  let publishProfile = 'STANDARD';
  const identity = String(options.identity || 'lk-user');

  function emit(event, ...args) {
    for (const h of listeners.get(event) || []) h(...args);
  }

  function mapConn(state) {
    const s = String(state || '');
    if (/reconnect/i.test(s)) return 'RECONNECTING';
    if (/connected/i.test(s)) return 'CONNECTED';
    if (/disconnected|failed/i.test(s)) return 'FAILED';
    return connectionState;
  }

  room.on(RoomEvent.ConnectionStateChanged, (state) => {
    connectionState = mapConn(state);
    emit('connectionStateChanged', connectionState);
  });

  return {
    async connect(input) {
      if (typeof room.prepareConnection === 'function' && input.url && input.token) {
        try {
          await room.prepareConnection(input.url, input.token);
        } catch {
          /* optional warm path */
        }
      }
      await room.connect(input.url, input.token, input.connectOptions);
      connectionState = 'CONNECTED';
      emit('connectionStateChanged', connectionState);
    },
    async disconnect() {
      await room.disconnect();
      connectionState = 'FAILED';
      emit('connectionStateChanged', connectionState);
    },
    async joinRoom(input) {
      await this.connect(input);
      const participants = [
        {
          participantSessionId: `lkps_${room.localParticipant?.identity || identity}`,
          canonicalUserId: room.localParticipant?.identity || identity,
          providerIdentity: room.localParticipant?.identity || identity,
          role: /** @type {const} */ ('viewer'),
        },
      ];
      for (const p of room.remoteParticipants.values()) {
        participants.push({
          participantSessionId: `lkps_${p.identity}`,
          canonicalUserId: p.identity,
          providerIdentity: p.identity,
          role: 'viewer',
        });
      }
      return {
        roomSessionId: asRtcRoomSessionId(`lkrs_${input.roomName}`),
        roomId: input.roomName,
        roomType: options.roomType || 'LIVE',
        connectionState: 'CONNECTED',
        participants,
      };
    },
    async leaveRoom() {
      await this.disconnect();
    },
    async publishCamera(track) {
      await room.localParticipant.publishTrack(track, { source: Track.Source.Camera });
      const ref = { trackId: track.id || `cam_${Date.now()}`, kind: /** @type {'video'} */ ('video'), source: /** @type {'camera'} */ ('camera'), muted: track.muted };
      emit('trackPublished', ref);
      return ref;
    },
    async publishMicrophone(track) {
      await room.localParticipant.publishTrack(track, { source: Track.Source.Microphone });
      const ref = { trackId: track.id || `mic_${Date.now()}`, kind: /** @type {'audio'} */ ('audio'), source: /** @type {'microphone'} */ ('microphone'), muted: track.muted };
      emit('trackPublished', ref);
      return ref;
    },
    async replaceVideoTrack(track) {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (pub?.track) await pub.track.replaceTrack(track);
    },
    async replaceAudioTrack(track) {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (pub?.track) await pub.track.replaceTrack(track);
    },
    async unpublish(trackId) {
      for (const pub of room.localParticipant.trackPublications.values()) {
        if (pub.track?.mediaStreamTrack?.id === trackId || pub.trackSid === trackId) {
          await room.localParticipant.unpublishTrack(pub.track);
          emit('trackUnpublished', { trackId, kind: pub.kind, source: 'custom', muted: true });
          return;
        }
      }
    },
    async setPublishProfile(profile) {
      publishProfile = profile;
      // Encoding mapping is provider-internal; encodings applied by LiveKit publish defaults / dynacast.
      void publishProfile;
    },
    async setSubscriptionProfile() {},
    async sendReliableData(payload, topic = 'control') {
      const data = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
      await room.localParticipant.publishData(data, { reliable: true, topic });
    },
    async sendLossTolerantData(payload, topic = 'likes') {
      const data = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
      await room.localParticipant.publishData(data, { reliable: false, topic });
    },
    async getStats() {
      return {
        bitrateUp: null,
        bitrateDown: null,
        packetLoss: null,
        rttMs: null,
        jitterMs: null,
        fps: null,
        width: null,
        height: null,
        qualityLimitation: null,
      };
    },
    getConnectionState() {
      return connectionState;
    },
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => listeners.get(event)?.delete(handler);
    },
    /** Escape hatch for Stage A attach() paths — documented compatibility boundary only. */
    getNativeRoom() {
      return room;
    },
  };
}

export { createLiveKitToken, ensureLiveKitRoom, deleteLiveKitRoom, isLiveKitConfigured, getLiveKitUrl } from '@workspace/livekit';
