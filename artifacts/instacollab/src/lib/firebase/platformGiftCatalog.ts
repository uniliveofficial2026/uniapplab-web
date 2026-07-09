import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import type { PublishedGiftItem } from '../live/giftEffectCatalogTypes';
import { getFirebaseFirestore } from './app';
import { isFirebaseConfigured } from './config';

const COLLECTION = 'platform_gift_catalog';
const DOC_ID = 'default';

function firestore() {
  return getFirebaseFirestore();
}

export function isFirebasePlatformGiftCatalogAvailable(): boolean {
  return isFirebaseConfigured() && Boolean(firestore());
}

function catalogDocRef() {
  const db = firestore();
  if (!db) throw new Error('Firebase is not configured');
  return doc(db, COLLECTION, DOC_ID);
}

export async function fetchFirebasePlatformGiftCatalog(): Promise<PublishedGiftItem[]> {
  const db = firestore();
  if (!db) return [];
  try {
    const snap = await getDoc(catalogDocRef());
    if (!snap.exists()) return [];
    const data = snap.data();
    return Array.isArray(data.gifts) ? (data.gifts as PublishedGiftItem[]) : [];
  } catch (err) {
    console.warn('[platform-gifts/firebase] fetch failed:', err);
    return [];
  }
}

export async function publishFirebasePlatformGiftCatalog(
  gifts: PublishedGiftItem[],
): Promise<void> {
  const db = firestore();
  if (!db) return;
  try {
    await setDoc(
      catalogDocRef(),
      {
        gifts,
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn('[platform-gifts/firebase] publish failed:', err);
    throw err;
  }
}

export function subscribeFirebasePlatformGiftCatalog(onChange: () => void): () => void {
  const db = firestore();
  if (!db) return () => undefined;

  let unsub: Unsubscribe | null = null;
  try {
    unsub = onSnapshot(
      catalogDocRef(),
      () => onChange(),
      (err) => console.warn('[platform-gifts/firebase] realtime failed:', err),
    );
  } catch (err) {
    console.warn('[platform-gifts/firebase] subscribe failed:', err);
  }

  return () => {
    unsub?.();
  };
}
