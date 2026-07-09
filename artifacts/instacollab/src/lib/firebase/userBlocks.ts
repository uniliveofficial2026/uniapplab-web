import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseFirestore } from './app';
import { isFirebaseConfigured } from './config';

function db() {
  return getFirebaseFirestore();
}

export function isFirebaseBlocksAvailable(): boolean {
  return isFirebaseConfigured() && Boolean(db());
}

function blockDocId(blockerId: string, blockedId: string): string {
  return `${blockerId}_${blockedId}`;
}

export async function fetchFirebaseBlocksForUser(meId: string): Promise<{
  blockedByMe: string[];
  blockedMe: string[];
}> {
  const firestore = db();
  if (!firestore || !meId) return { blockedByMe: [], blockedMe: [] };

  const [mineSnap, againstSnap] = await Promise.all([
    getDocs(query(collection(firestore, 'user_blocks'), where('blocker_id', '==', meId))),
    getDocs(query(collection(firestore, 'user_blocks'), where('blocked_id', '==', meId))),
  ]);

  return {
    blockedByMe: mineSnap.docs
      .map((entry) => String(entry.data().blocked_id ?? ''))
      .filter(Boolean),
    blockedMe: againstSnap.docs
      .map((entry) => String(entry.data().blocker_id ?? ''))
      .filter(Boolean),
  };
}

export async function upsertFirebaseBlock(blockerId: string, blockedId: string): Promise<void> {
  const firestore = db();
  if (!firestore) return;
  await setDoc(doc(firestore, 'user_blocks', blockDocId(blockerId, blockedId)), {
    blocker_id: blockerId,
    blocked_id: blockedId,
    created_at: new Date().toISOString(),
  });
}

export async function deleteFirebaseBlock(blockerId: string, blockedId: string): Promise<void> {
  const firestore = db();
  if (!firestore) return;
  await deleteDoc(doc(firestore, 'user_blocks', blockDocId(blockerId, blockedId)));
}

let blocksListenerStop: Unsubscribe | null = null;

export function subscribeFirebaseBlocks(meId: string, onChange: () => void): () => void {
  const firestore = db();
  if (!firestore || !meId) return () => undefined;

  blocksListenerStop?.();
  const primed = { mine: false, against: false };
  const mineQuery = query(collection(firestore, 'user_blocks'), where('blocker_id', '==', meId));
  const againstQuery = query(collection(firestore, 'user_blocks'), where('blocked_id', '==', meId));

  const unsubMine = onSnapshot(mineQuery, () => {
    if (!primed.mine) {
      primed.mine = true;
      return;
    }
    onChange();
  });
  const unsubAgainst = onSnapshot(againstQuery, () => {
    if (!primed.against) {
      primed.against = true;
      return;
    }
    onChange();
  });

  blocksListenerStop = () => {
    unsubMine();
    unsubAgainst();
    blocksListenerStop = null;
  };

  return blocksListenerStop;
}

export function stopFirebaseBlocksListener(): void {
  blocksListenerStop?.();
  blocksListenerStop = null;
}
