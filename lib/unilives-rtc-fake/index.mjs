import { asRtcRoomSessionId } from '@unilives/rtc-contracts';

/**
 * In-memory UniLiveRTC provider for business-logic tests without LiveKit.
 * @returns {import('@unilives/rtc-contracts').UniLivesRTCProvider}
 */
export function createFakeRTCProvider(options = {}) {
  const identity = String(options.identity || 'fake-user');
  /** @type {Map<string, Set<(...args: any[]) => void>>} */
  const listeners = new Map();
  /** @type {import('@unilives/rtc-contracts').RtcConnectionState} */
  let connectionState = 'FAILED';
  /** @type {import('@unilives/rtc-contracts').RtcSession | null} */
  let session = null;
  /** @type {Map<string, import('@unilives/rtc-contracts').RtcTrackRef>} */
  const tracks = new Map();
  /** @type {import('@unilives/rtc-contracts').PublishProfile} */
  let publishProfile = 'STANDARD';
  /** @type {import('@unilives/rtc-contracts').SubscriptionProfile} */
  let subscriptionProfile = 'FULLSCREEN_HOST';
  let dataSeq = 0;
  const unavailable = Boolean(options.unavailable);

  function emit(event, ...args) {
    for (const handler of listeners.get(event) || []) handler(...args);
  }

  return {
    async connect(input) {
      if (unavailable) throw Object.assign(new Error('rtc_provider_unavailable'), { code: 'RTC_UNAVAILABLE' });
      connectionState = 'CONNECTED';
      emit('connectionStateChanged', connectionState);
      void input;
    },
    async disconnect() {
      connectionState = 'FAILED';
      session = null;
      tracks.clear();
      emit('connectionStateChanged', connectionState);
    },
    async joinRoom(input) {
      if (unavailable) throw Object.assign(new Error('rtc_provider_unavailable'), { code: 'RTC_UNAVAILABLE' });
      await this.connect(input);
      const roomSessionId = asRtcRoomSessionId(`frs_${Date.now().toString(36)}`);
      session = {
        roomSessionId,
        roomId: input.roomName,
        roomType: options.roomType || 'LIVE',
        connectionState: 'CONNECTED',
        participants: [
          {
            participantSessionId: `fps_${identity}`,
            canonicalUserId: identity,
            providerIdentity: identity,
            role: options.role || 'viewer',
          },
        ],
      };
      emit('participantJoined', session.participants[0]);
      return session;
    },
    async leaveRoom() {
      if (session) emit('participantLeft', session.participants[0]);
      await this.disconnect();
    },
    async publishCamera(track) {
      const ref = {
        trackId: `vid_${tracks.size + 1}`,
        kind: /** @type {'video'} */ ('video'),
        source: /** @type {'camera'} */ ('camera'),
        muted: !track || track.muted === true,
      };
      tracks.set(ref.trackId, ref);
      emit('trackPublished', ref);
      return ref;
    },
    async publishMicrophone(track) {
      const ref = {
        trackId: `aud_${tracks.size + 1}`,
        kind: /** @type {'audio'} */ ('audio'),
        source: /** @type {'microphone'} */ ('microphone'),
        muted: !track || track.muted === true,
      };
      tracks.set(ref.trackId, ref);
      emit('trackPublished', ref);
      return ref;
    },
    async replaceVideoTrack() {},
    async replaceAudioTrack() {},
    async unpublish(trackId) {
      const ref = tracks.get(trackId);
      tracks.delete(trackId);
      if (ref) emit('trackUnpublished', ref);
    },
    async setPublishProfile(profile) {
      publishProfile = profile;
    },
    async setSubscriptionProfile(profile) {
      subscriptionProfile = profile;
    },
    async sendReliableData(payload, topic = 'control') {
      dataSeq += 1;
      emit('data', { lane: 'RELIABLE_CONTROL', topic, payload, sequence: dataSeq });
    },
    async sendLossTolerantData(payload, topic = 'likes') {
      dataSeq += 1;
      emit('data', { lane: 'LOSS_TOLERANT', topic, payload, sequence: dataSeq });
    },
    async getStats() {
      return {
        bitrateUp: publishProfile === 'LOW' ? 200_000 : 800_000,
        bitrateDown: 600_000,
        packetLoss: connectionState === 'DEGRADED' ? 0.08 : 0.01,
        rttMs: 40,
        jitterMs: 5,
        fps: 24,
        width: 720,
        height: 1280,
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
    /** test helper */
    _setConnectionState(next) {
      connectionState = next;
      if (session) session.connectionState = next === 'RECOVERED' ? 'CONNECTED' : next;
      emit('connectionStateChanged', connectionState);
    },
    _getPublishProfile() {
      return publishProfile;
    },
    _getSubscriptionProfile() {
      return subscriptionProfile;
    },
  };
}
