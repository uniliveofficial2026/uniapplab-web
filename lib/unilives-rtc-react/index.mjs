import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/** @typedef {import('@unilives/rtc-client').createUniLiveRTC extends (...args: any) => infer R ? R : never} UniLiveRTCClient */
/** @typedef {Awaited<ReturnType<UniLiveRTCClient['joinRoom']>>} UniLiveRoomHandle */

const UniLiveRTCContext = createContext(null);

/**
 * Provider for @unilives/rtc-client instance. Provider-neutral — no LiveKit types.
 * @param {{ rtc: UniLiveRTCClient, children: import('react').ReactNode }} props
 */
export function UniLiveRTCProvider({ rtc, children }) {
  const value = useMemo(() => rtc, [rtc]);
  return React.createElement(UniLiveRTCContext.Provider, { value }, children);
}

export function useUniLiveRTC() {
  const rtc = useContext(UniLiveRTCContext);
  if (!rtc) {
    throw new Error('useUniLiveRTC requires UniLiveRTCProvider');
  }
  return rtc;
}

/**
 * Join and track a room session.
 * @param {{ roomId: string, token: string, url: string, canonicalUserId: string, role?: string, autoJoin?: boolean }} config
 */
export function useRoom(config) {
  const rtc = useUniLiveRTC();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [connection, setConnection] = useState('DISCONNECTED');
  const joinedRef = useRef(false);

  const join = useCallback(async () => {
    if (!config?.roomId || joinedRef.current) return room;
    setError(null);
    try {
      const handle = await rtc.joinRoom({
        roomId: config.roomId,
        token: config.token,
        url: config.url,
        canonicalUserId: config.canonicalUserId,
        role: config.role,
      });
      joinedRef.current = true;
      setRoom(handle);
      setConnection(handle.connection || 'CONNECTED');
      return handle;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [rtc, config?.roomId, config?.token, config?.url, config?.canonicalUserId, config?.role, room]);

  const leave = useCallback(async () => {
    if (!room) return;
    await room.leave();
    joinedRef.current = false;
    setRoom(null);
    setConnection('DISCONNECTED');
  }, [room]);

  useEffect(() => {
    if (config?.autoJoin === false) return undefined;
    let cancelled = false;
    join().catch(() => {
      if (!cancelled) setConnection('DISCONNECTED');
    });
    return () => {
      cancelled = true;
    };
  }, [join, config?.autoJoin]);

  useEffect(() => {
    if (!room) return undefined;
    setConnection(room.connection || 'CONNECTED');
    return undefined;
  }, [room]);

  return { room, join, leave, error, connection };
}

/**
 * Participant list for the active room handle.
 * @param {UniLiveRoomHandle | null | undefined} room
 */
export function useParticipants(room) {
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    if (!room) {
      setParticipants([]);
      return undefined;
    }
    setParticipants(Array.isArray(room.participants) ? [...room.participants] : []);
    return undefined;
  }, [room, room?.participants?.length]);

  return participants;
}

/**
 * Poll network/QoE state from provider-neutral room API.
 * @param {UniLiveRoomHandle | null | undefined} room
 * @param {{ intervalMs?: number }} [options]
 */
export function useNetworkQuality(room, options = {}) {
  const intervalMs = Math.max(1000, options.intervalMs ?? 5000);
  const [quality, setQuality] = useState(null);

  useEffect(() => {
    if (!room?.getNetwork) {
      setQuality(null);
      return undefined;
    }
    let active = true;
    const tick = async () => {
      try {
        const next = await room.getNetwork();
        if (active) setQuality(next);
      } catch {
        if (active) setQuality(null);
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [room, intervalMs]);

  return quality;
}

/**
 * Local camera/mic publish helpers.
 * @param {UniLiveRoomHandle | null | undefined} room
 */
export function useLocalMedia(room) {
  const [cameraTrack, setCameraTrack] = useState(null);
  const [microphoneTrack, setMicrophoneTrack] = useState(null);
  const [error, setError] = useState(null);

  const enableCamera = useCallback(
    async (track) => {
      if (!room?.enableCamera) throw new Error('room_not_ready');
      setError(null);
      try {
        const published = await room.enableCamera(track);
        setCameraTrack(published);
        return published;
      } catch (err) {
        setError(err);
        throw err;
      }
    },
    [room],
  );

  const enableMicrophone = useCallback(
    async (track) => {
      if (!room?.enableMicrophone) throw new Error('room_not_ready');
      setError(null);
      try {
        const published = await room.enableMicrophone(track);
        setMicrophoneTrack(published);
        return published;
      } catch (err) {
        setError(err);
        throw err;
      }
    },
    [room],
  );

  return { cameraTrack, microphoneTrack, enableCamera, enableMicrophone, error };
}
