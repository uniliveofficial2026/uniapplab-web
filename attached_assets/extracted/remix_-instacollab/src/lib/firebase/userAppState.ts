import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { CloudAppStatePayload } from '../cloudSync/types';
import { getFirebaseFirestore } from './app';
import { isFirebaseConfigured } from './config';

function stateDocRef(userId: string) {
  const db = getFirebaseFirestore();
  if (!db) throw new Error('Firebase is not configured');
  return doc(db, 'user_app_state', userId);
}

export async function upsertFirebaseUserAppState(
  userId: string,
  payload: CloudAppStatePayload
): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const ref = stateDocRef(userId);
  await setDoc(
    ref,
    {
      payload,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
}

export function subscribeFirebaseUserAppState(
  userId: string,
  onPayload: (payload: CloudAppStatePayload) => void
): () => void {
  if (!isFirebaseConfigured()) return () => {};
  const db = getFirebaseFirestore();
  if (!db) return () => {};

  const ref = doc(db, 'user_app_state', userId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as { payload?: CloudAppStatePayload };
      const next = data?.payload;
      if (next && typeof next === 'object' && next.v === 1) {
        onPayload(next);
      }
    },
    (err) => {
      console.warn('[sync] Firestore user_app_state listener error:', err);
    }
  );
}
