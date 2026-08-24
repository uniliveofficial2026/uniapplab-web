import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import type { CloudAppStatePayload } from '../cloudSync/types';
import { getFirebaseFirestore } from './app';
import { isFirebaseConfigured } from './config';

function stateDocRef(userId: string) {
  const db = getFirebaseFirestore();
  if (!db) throw new Error('Firebase is not configured');
  return doc(db, 'user_app_state', userId);
}

export async function fetchFirebaseUserAppState(
  userId: string,
): Promise<CloudAppStatePayload | null> {
  if (!isFirebaseConfigured()) return null;
  const db = getFirebaseFirestore();
  if (!db) return null;
  const snap = await getDoc(doc(db, 'user_app_state', userId));
  if (!snap.exists()) return null;
  const data = snap.data() as { payload?: CloudAppStatePayload };
  const payload = data?.payload;
  if (payload && typeof payload === 'object' && (payload.v === 1 || payload.v === 2)) {
    return payload;
  }
  return null;
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
      if (next && typeof next === 'object' && (next.v === 1 || next.v === 2)) {
        onPayload(next);
      }
    },
    (err) => {
      console.warn('[sync] Firestore user_app_state listener error:', err);
    }
  );
}
