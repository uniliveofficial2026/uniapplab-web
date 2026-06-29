import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { beginChatMediaPlayback } from '../../lib/chatMediaPlayback';

export type MessagePlaylistTrack = {
  id: string;
  kind: 'voice' | 'music' | 'video';
  url: string;
  name?: string;
  videoRefKey?: string;
};

type PlayerHandlers = {
  pause: () => void;
  playFromPlaylist: () => void;
};

type PlaylistContextValue = {
  register: (trackId: string, handlers: PlayerHandlers) => () => void;
  play: (trackId: string) => void;
  onEnded: (trackId: string) => void;
  notifyPaused: (trackId: string) => void;
  consumePlayEvent: (trackId: string) => boolean;
};

const MessageMediaPlaylistContext = createContext<PlaylistContextValue | null>(null);

export function useMessageMediaPlaylist() {
  return useContext(MessageMediaPlaylistContext);
}

export function mediaReachedEnd(el: HTMLMediaElement): boolean {
  if (el.ended) return true;
  const duration = el.duration;
  if (!Number.isFinite(duration) || duration <= 0) return false;
  return el.currentTime >= duration - 0.15;
}

export function MessageMediaPlaylistProvider({
  tracks,
  inlineVideoRefs,
  children,
}: {
  tracks: MessagePlaylistTrack[];
  inlineVideoRefs: MutableRefObject<Map<string, HTMLVideoElement>>;
  children: ReactNode;
}) {
  const playersRef = useRef(new Map<string, PlayerHandlers>());
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const activeTrackIdRef = useRef<string | null>(null);
  const suppressPlayEventsUntilRef = useRef(0);
  const advancingRef = useRef(false);
  const pendingPlayIdRef = useRef<string | null>(null);

  const pauseAllExcept = useCallback(
    (exceptId: string | null) => {
      playersRef.current.forEach((handlers, id) => {
        if (id !== exceptId) handlers.pause();
      });
      const keepKey = exceptId
        ? tracksRef.current.find((t) => t.id === exceptId)?.videoRefKey
        : undefined;
      inlineVideoRefs.current.forEach((el, key) => {
        if (key === keepKey) return;
        try {
          el.pause();
        } catch {
          /* ignore */
        }
      });
    },
    [inlineVideoRefs]
  );

  const consumePlayEvent = useCallback((trackId: string) => {
    if (Date.now() < suppressPlayEventsUntilRef.current) {
      return false;
    }
    if (activeTrackIdRef.current === trackId) {
      return false;
    }
    return true;
  }, []);

  const play = useCallback(
    (trackId: string) => {
      const track = tracksRef.current.find((t) => t.id === trackId);
      if (!track) return;

      suppressPlayEventsUntilRef.current = Date.now() + 300;
      activeTrackIdRef.current = trackId;

      const handlers = playersRef.current.get(trackId);

      if (track.kind === 'video' && track.videoRefKey) {
        beginChatMediaPlayback(handlers?.pause);
        pauseAllExcept(trackId);
        const el = inlineVideoRefs.current.get(track.videoRefKey);
        if (el) {
          el.loop = false;
          if (el.ended) el.currentTime = 0;
          void el.play().catch(() => {
            if (activeTrackIdRef.current === trackId) {
              activeTrackIdRef.current = null;
            }
          });
        }
        return;
      }

      if (!handlers) {
        pendingPlayIdRef.current = trackId;
        return;
      }

      beginChatMediaPlayback(handlers.pause);
      pauseAllExcept(trackId);
      handlers.playFromPlaylist();
    },
    [inlineVideoRefs, pauseAllExcept]
  );

  const onEnded = useCallback(
    (trackId: string) => {
      if (advancingRef.current) return;

      const list = tracksRef.current;
      const index = list.findIndex((t) => t.id === trackId);
      if (index < 0) return;

      const current = activeTrackIdRef.current;
      if (current !== null && current !== trackId) return;

      if (index >= list.length - 1) {
        activeTrackIdRef.current = null;
        return;
      }

      const nextId = list[index + 1]!.id;
      advancingRef.current = true;
      try {
        play(nextId);
      } finally {
        advancingRef.current = false;
      }
    },
    [play]
  );

  const notifyPaused = useCallback(
    (trackId: string) => {
      if (advancingRef.current) return;
      if (activeTrackIdRef.current !== trackId) return;

      const track = tracksRef.current.find((t) => t.id === trackId);
      if (track?.videoRefKey) {
        const el = inlineVideoRefs.current.get(track.videoRefKey);
        if (el && mediaReachedEnd(el)) return;
      }

      activeTrackIdRef.current = null;
    },
    [inlineVideoRefs]
  );

  const register = useCallback(
    (trackId: string, handlers: PlayerHandlers) => {
      playersRef.current.set(trackId, handlers);
      if (pendingPlayIdRef.current === trackId) {
        pendingPlayIdRef.current = null;
        queueMicrotask(() => play(trackId));
      }
      return () => {
        playersRef.current.delete(trackId);
        if (pendingPlayIdRef.current === trackId) {
          pendingPlayIdRef.current = null;
        }
        if (activeTrackIdRef.current === trackId) {
          activeTrackIdRef.current = null;
        }
      };
    },
    [play]
  );

  const value = useMemo(
    () => ({
      register,
      play,
      onEnded,
      notifyPaused,
      consumePlayEvent,
    }),
    [register, play, onEnded, notifyPaused, consumePlayEvent]
  );

  if (tracks.length <= 1) {
    return <>{children}</>;
  }

  return (
    <MessageMediaPlaylistContext.Provider value={value}>
      {children}
    </MessageMediaPlaylistContext.Provider>
  );
}

/** Register playlist handlers before paint so auto-advance never misses a target. */
export function useRegisterMessagePlaylistTrack(
  playlistTrackId: string | undefined,
  handlers: PlayerHandlers | null
) {
  const playlist = useMessageMediaPlaylist();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useLayoutEffect(() => {
    if (!playlistTrackId || !playlist || !handlersRef.current) return;
    return playlist.register(playlistTrackId, {
      pause: () => handlersRef.current?.pause(),
      playFromPlaylist: () => handlersRef.current?.playFromPlaylist(),
    });
  }, [playlist, playlistTrackId]);
}
