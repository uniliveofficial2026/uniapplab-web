import { useEffect, useSyncExternalStore } from 'react';
import {
  clearPlaybackIntent,
  registerPlaybackElement,
  setPlaybackIntent,
} from './playbackAudio';
import { postPlaybackId } from './postPlayback';

export type PostAudioIntent = {
  priority: number;
  wantsPlay: boolean;
};

type PostAudioEntry = {
  soundtrackUrl?: string;
  textAudioUrl?: string;
  loop: boolean;
  muted: boolean;
  onEnded?: () => void;
  soundtrackIntents: Map<string, PostAudioIntent>;
  textIntents: Map<string, PostAudioIntent>;
};

const entries = new Map<string, PostAudioEntry>();
const pinnedPostIds = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function getOrCreateEntry(postId: string): PostAudioEntry {
  let entry = entries.get(postId);
  if (!entry) {
    entry = {
      loop: true,
      muted: false,
      soundtrackIntents: new Map(),
      textIntents: new Map(),
    };
    entries.set(postId, entry);
  }
  return entry;
}

function winningIntent(intents: Map<string, PostAudioIntent>): PostAudioIntent | null {
  let best: PostAudioIntent | null = null;
  for (const intent of intents.values()) {
    if (!intent.wantsPlay) continue;
    if (!best || intent.priority > best.priority) {
      best = intent;
    }
  }
  return best;
}

function pruneEntry(postId: string) {
  if (pinnedPostIds.has(postId)) return;
  const entry = entries.get(postId);
  if (!entry) return;
  const hasSoundtrack = entry.soundtrackUrl && entry.soundtrackIntents.size > 0;
  const hasText = entry.textAudioUrl && entry.textIntents.size > 0;
  if (!hasSoundtrack && !hasText) {
    entries.delete(postId);
  }
}

/** Keep shared <audio> mounted while the feed Post row exists. */
export function pinPostAudioEntry(postId: string) {
  pinnedPostIds.add(postId);
}

export function unpinPostAudioEntry(postId: string) {
  pinnedPostIds.delete(postId);
  pruneEntry(postId);
  notify();
}

export function subscribePostAudioRegistry(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPostAudioRegistrySnapshot(): Map<string, PostAudioEntry> {
  return entries;
}

export function getPostAudioEntry(postId: string): PostAudioEntry | undefined {
  return entries.get(postId);
}

export function postSoundtrackShouldPlay(postId: string): boolean {
  const entry = entries.get(postId);
  if (!entry?.soundtrackUrl || entry.muted) return false;
  return !!winningIntent(entry.soundtrackIntents);
}

export function postTextAudioShouldPlay(postId: string): boolean {
  const entry = entries.get(postId);
  if (!entry?.textAudioUrl || entry.muted) return false;
  return !!winningIntent(entry.textIntents);
}

/** Sync registry + coordinator so feed resumes before modal unmounts. */
export function boostPostFeedAudioRegistry(postId: string, priority: number) {
  const entry = entries.get(postId);
  if (!entry) return;
  const boost = (
    intents: Map<string, PostAudioIntent>,
    surface: 'soundtrack' | 'text-audio'
  ) => {
    const intent = intents.get('feed');
    if (!intent) return;
    intent.wantsPlay = true;
    setPlaybackIntent(postPlaybackId(postId, surface), 'feed', priority, true);
  };
  boost(entry.soundtrackIntents, 'soundtrack');
  boost(entry.textIntents, 'text-audio');
  notify();
}

/** One shared <audio> per post — feed + modal only set intents (no remount = no gap). */
export function usePostPlaybackAudio(
  postId: string,
  intentKey: string,
  options: {
    soundtrackUrl?: string;
    textAudioUrl?: string;
    priority: number;
    active: boolean;
    muted: boolean;
    loop?: boolean;
    onEnded?: () => void;
  }
) {
  const {
    soundtrackUrl,
    textAudioUrl,
    priority,
    active,
    muted,
    loop = true,
    onEnded,
  } = options;

  useEffect(() => {
    const entry = getOrCreateEntry(postId);
    entry.loop = loop;
    entry.muted = muted;
    entry.onEnded = onEnded;
    if (soundtrackUrl !== undefined) {
      entry.soundtrackUrl = soundtrackUrl;
    }
    if (textAudioUrl !== undefined) {
      entry.textAudioUrl = textAudioUrl;
    }

    const wantsPlay = active && !muted;
    if (entry.soundtrackUrl) {
      entry.soundtrackIntents.set(intentKey, { priority, wantsPlay });
      setPlaybackIntent(
        postPlaybackId(postId, 'soundtrack'),
        intentKey,
        priority,
        wantsPlay
      );
    }
    if (entry.textAudioUrl) {
      entry.textIntents.set(intentKey, { priority, wantsPlay });
      setPlaybackIntent(
        postPlaybackId(postId, 'text-audio'),
        intentKey,
        priority,
        wantsPlay
      );
    }
    notify();

    return () => {
      const e = entries.get(postId);
      if (!e) return;
      e.soundtrackIntents.delete(intentKey);
      e.textIntents.delete(intentKey);
      clearPlaybackIntent(postPlaybackId(postId, 'soundtrack'), intentKey);
      clearPlaybackIntent(postPlaybackId(postId, 'text-audio'), intentKey);
      pruneEntry(postId);
      notify();
    };
  }, [
    postId,
    intentKey,
    soundtrackUrl,
    textAudioUrl,
    priority,
    active,
    muted,
    loop,
    onEnded,
  ]);
}

export function usePostAudioRegistry() {
  return useSyncExternalStore(
    subscribePostAudioRegistry,
    getPostAudioRegistrySnapshot,
    () => new Map()
  );
}

export function bindPostCanonicalAudio(
  postId: string,
  surface: 'soundtrack' | 'text-audio',
  el: HTMLAudioElement | null
) {
  registerPlaybackElement(postPlaybackId(postId, surface), 'canonical', el);
}
