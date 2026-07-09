import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { getFirebaseFirestore } from './app';
import { isFirebaseConfigured } from './config';

const COLLECTION = 'platform_app_brand';
const DOC_ID = 'default';

export type FirebasePlatformAppBrandRow = {
  logo_url: string | null;
  logo_media_type: 'image' | 'video';
  updated_at: string;
};

function firestore() {
  return getFirebaseFirestore();
}

export function isFirebasePlatformAppBrandAvailable(): boolean {
  return isFirebaseConfigured() && Boolean(firestore());
}

function brandDocRef() {
  const db = firestore();
  if (!db) throw new Error('Firebase is not configured');
  return doc(db, COLLECTION, DOC_ID);
}

export async function fetchFirebasePlatformAppBrand(): Promise<FirebasePlatformAppBrandRow | null> {
  const db = firestore();
  if (!db) return null;
  try {
    const snap = await getDoc(brandDocRef());
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      logo_url:
        typeof data.logo_url === 'string' && data.logo_url.trim() ? data.logo_url.trim() : null,
      logo_media_type: data.logo_media_type === 'video' ? 'video' : 'image',
      updated_at: String(data.updated_at ?? ''),
    };
  } catch (err) {
    console.warn('[platform-brand/firebase] fetch failed:', err);
    return null;
  }
}

export async function publishFirebasePlatformAppBrand(input: {
  logoUrl: string | null;
  mediaType: 'image' | 'video';
}): Promise<void> {
  const db = firestore();
  if (!db) return;
  try {
    await setDoc(
      brandDocRef(),
      {
        logo_url: input.logoUrl?.trim() ? input.logoUrl.trim() : null,
        logo_media_type: input.mediaType,
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn('[platform-brand/firebase] publish failed:', err);
    throw err;
  }
}

export function subscribeFirebasePlatformAppBrand(onChange: () => void): () => void {
  const db = firestore();
  if (!db) return () => undefined;

  let unsub: Unsubscribe | null = null;
  try {
    unsub = onSnapshot(
      brandDocRef(),
      () => onChange(),
      (err) => console.warn('[platform-brand/firebase] realtime failed:', err),
    );
  } catch (err) {
    console.warn('[platform-brand/firebase] subscribe failed:', err);
  }

  return () => {
    unsub?.();
  };
}
