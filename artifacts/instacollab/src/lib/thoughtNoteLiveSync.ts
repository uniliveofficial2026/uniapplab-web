/**
 * Keeps thought bubbles in sync without page reloads:
 * - DB mutations re-render Avatars via useDB()
 * - HMR patches CSS/animation in dev without full reload
 * - Dispatches a lightweight event when notes change (for portals / story ring)
 */
import { db } from './db/localDb';
import type { User } from '../types';
import { thoughtNoteEpoch } from './thoughtNoteEpoch';

const THOUGHT_NOTE_EVENT = 'thought-note-live';

export type ThoughtNoteLiveDetail = {
  changedUserIds: string[];
};

let installed = false;
let lastSignature = '';

function noteSignature(): string {
  return db.users
    .map((u) => `${u.id}:${u.note ?? ''}:${u.noteUpdatedAt ?? 0}`)
    .join('|');
}

function changedThoughtUserIds(prev: string, next: string): string[] {
  const prevMap = new Map<string, string>();
  for (const part of prev.split('|')) {
    const colon = part.indexOf(':');
    if (colon <= 0) continue;
    prevMap.set(part.slice(0, colon), part);
  }
  const changed: string[] = [];
  for (const part of next.split('|')) {
    const colon = part.indexOf(':');
    if (colon <= 0) continue;
    const id = part.slice(0, colon);
    if (prevMap.get(id) !== part) changed.push(id);
  }
  return changed;
}

/** Ensure synced users always carry an epoch so cross-device animation can replay. */
export function normalizeUserThoughtEpoch(user: User): User {
  const note = user.note?.trim();
  if (!note) {
    if (!user.note && user.noteUpdatedAt === undefined) return user;
    return { ...user, note: undefined, noteUpdatedAt: undefined };
  }
  if (user.noteUpdatedAt && user.noteUpdatedAt > 0) return { ...user, note };
  return { ...user, note, noteUpdatedAt: thoughtNoteEpoch(note, undefined) };
}

export function normalizeUsersThoughtEpochs(users: User[]): User[] {
  return users.map(normalizeUserThoughtEpoch);
}

export function initThoughtNoteLiveSync(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  lastSignature = noteSignature();

  db.subscribe(() => {
    const next = noteSignature();
    if (next === lastSignature) return;
    const changedUserIds = changedThoughtUserIds(lastSignature, next);
    lastSignature = next;
    window.dispatchEvent(
      new CustomEvent<ThoughtNoteLiveDetail>(THOUGHT_NOTE_EVENT, {
        detail: { changedUserIds },
      }),
    );
  });
}

export function subscribeThoughtNoteLive(
  listener: (detail: ThoughtNoteLiveDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<ThoughtNoteLiveDetail>).detail ?? {
      changedUserIds: [],
    };
    listener(detail);
  };
  window.addEventListener(THOUGHT_NOTE_EVENT, handler);
  return () => window.removeEventListener(THOUGHT_NOTE_EVENT, handler);
}

export function dispatchThoughtNoteReplay(userId?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ThoughtNoteLiveDetail>(THOUGHT_NOTE_EVENT, {
      detail: { changedUserIds: userId ? [userId] : [] },
    }),
  );
}
