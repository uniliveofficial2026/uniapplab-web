/**
 * Keeps thought bubbles in sync without page reloads:
 * - DB mutations re-render Avatars via useDB()
 * - HMR patches CSS/animation in dev without full reload
 * - Dispatches a lightweight event when notes change (for portals / story ring)
 */
import { db } from './db/localDb';

const THOUGHT_NOTE_EVENT = 'thought-note-live';

let installed = false;
let lastSignature = '';

function noteSignature(): string {
  return db.users
    .map((u) => `${u.id}:${u.note ?? ''}:${u.noteUpdatedAt ?? 0}`)
    .join('|');
}

export function initThoughtNoteLiveSync(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  lastSignature = noteSignature();

  db.subscribe(() => {
    const next = noteSignature();
    if (next === lastSignature) return;
    lastSignature = next;
    window.dispatchEvent(new CustomEvent(THOUGHT_NOTE_EVENT));
  });
}

export function subscribeThoughtNoteLive(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => listener();
  window.addEventListener(THOUGHT_NOTE_EVENT, handler);
  return () => window.removeEventListener(THOUGHT_NOTE_EVENT, handler);
}
