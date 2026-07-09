import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseFirestore } from './app';
import { isFirebaseConfigured } from './config';

export type FirebaseCommentRow = {
  id: string;
  target_kind: 'post' | 'reel';
  target_id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type FirebaseEngagementRow = {
  target_kind: 'post' | 'reel' | 'comment';
  target_id: string;
  user_id: string;
  kind: 'like' | 'save';
};

export type FirebaseStoryRow = {
  id: string;
  author_id: string;
  payload: Record<string, unknown>;
  expires_at: string;
  created_at: string;
};

function firestore() {
  return getFirebaseFirestore();
}

export function isFirebaseSocialContentAvailable(): boolean {
  return isFirebaseConfigured() && Boolean(firestore());
}

function commentDocId(row: Pick<FirebaseCommentRow, 'id'>): string {
  return row.id;
}

function engagementDocId(row: FirebaseEngagementRow): string {
  return `${row.target_kind}_${row.target_id}_${row.user_id}_${row.kind}`;
}

export async function upsertFirebaseComment(row: FirebaseCommentRow): Promise<void> {
  const db = firestore();
  if (!db) return;
  await setDoc(doc(db, 'social_comments', commentDocId(row)), row, { merge: true });
}

export async function deleteFirebaseComment(commentId: string): Promise<void> {
  const db = firestore();
  if (!db || !commentId) return;
  await deleteDoc(doc(db, 'social_comments', commentId));
}

export async function fetchFirebaseCommentsForTargets(
  targets: Array<{ kind: 'post' | 'reel'; id: string }>,
): Promise<FirebaseCommentRow[]> {
  const db = firestore();
  if (!db || !targets.length) return [];

  const rows: FirebaseCommentRow[] = [];
  for (const target of targets.slice(0, 40)) {
    const snap = await getDocs(
      query(
        collection(db, 'social_comments'),
        where('target_kind', '==', target.kind),
        where('target_id', '==', target.id),
        orderBy('created_at', 'asc'),
        limit(500),
      ),
    );
    rows.push(
      ...snap.docs.map((entry) => {
        const data = entry.data();
        return {
          id: entry.id,
          target_kind: data.target_kind as 'post' | 'reel',
          target_id: String(data.target_id ?? ''),
          parent_id: (data.parent_id as string | null) ?? null,
          author_id: String(data.author_id ?? ''),
          body: String(data.body ?? ''),
          payload: (data.payload ?? {}) as Record<string, unknown>,
          created_at: String(data.created_at ?? new Date().toISOString()),
        };
      }),
    );
  }
  return rows;
}

export async function upsertFirebaseEngagement(row: FirebaseEngagementRow): Promise<void> {
  const db = firestore();
  if (!db) return;
  await setDoc(doc(db, 'social_engagement', engagementDocId(row)), row, { merge: true });
}

export async function deleteFirebaseEngagement(row: FirebaseEngagementRow): Promise<void> {
  const db = firestore();
  if (!db) return;
  await deleteDoc(doc(db, 'social_engagement', engagementDocId(row)));
}

export async function fetchFirebaseEngagementForTargets(
  targets: Array<{ kind: 'post' | 'reel' | 'comment'; id: string }>,
): Promise<FirebaseEngagementRow[]> {
  const db = firestore();
  if (!db || !targets.length) return [];

  const rows: FirebaseEngagementRow[] = [];
  for (const target of targets.slice(0, 40)) {
    const snap = await getDocs(
      query(
        collection(db, 'social_engagement'),
        where('target_kind', '==', target.kind),
        where('target_id', '==', target.id),
      ),
    );
    rows.push(
      ...snap.docs.map((entry) => {
        const data = entry.data();
        return {
          target_kind: data.target_kind as FirebaseEngagementRow['target_kind'],
          target_id: String(data.target_id ?? ''),
          user_id: String(data.user_id ?? ''),
          kind: data.kind as 'like' | 'save',
        };
      }),
    );
  }
  return rows;
}

export async function upsertFirebaseStory(row: FirebaseStoryRow): Promise<void> {
  const db = firestore();
  if (!db) return;
  await setDoc(doc(db, 'social_stories', row.id), row, { merge: true });
}

export async function fetchFirebaseActiveStories(limitCount = 200): Promise<FirebaseStoryRow[]> {
  const db = firestore();
  if (!db) return [];

  const now = new Date().toISOString();
  const snap = await getDocs(
    query(
      collection(db, 'social_stories'),
      where('expires_at', '>', now),
      orderBy('created_at', 'desc'),
      limit(limitCount),
    ),
  );

  return snap.docs.map((entry) => {
    const data = entry.data();
    return {
      id: entry.id,
      author_id: String(data.author_id ?? ''),
      payload: (data.payload ?? {}) as Record<string, unknown>,
      expires_at: String(data.expires_at ?? ''),
      created_at: String(data.created_at ?? new Date().toISOString()),
    };
  });
}

let socialListenerStop: Unsubscribe | null = null;

export function subscribeFirebaseSocialContent(onChange: () => void): () => void {
  const db = firestore();
  if (!db) return () => undefined;

  socialListenerStop?.();
  const primed = { comments: false, engagement: false, stories: false };

  const unsubComments = onSnapshot(collection(db, 'social_comments'), () => {
    if (!primed.comments) {
      primed.comments = true;
      return;
    }
    onChange();
  });
  const unsubEngagement = onSnapshot(collection(db, 'social_engagement'), () => {
    if (!primed.engagement) {
      primed.engagement = true;
      return;
    }
    onChange();
  });
  const unsubStories = onSnapshot(collection(db, 'social_stories'), () => {
    if (!primed.stories) {
      primed.stories = true;
      return;
    }
    onChange();
  });

  socialListenerStop = () => {
    unsubComments();
    unsubEngagement();
    unsubStories();
    socialListenerStop = null;
  };

  return socialListenerStop;
}

export function stopFirebaseSocialContentListener(): void {
  socialListenerStop?.();
  socialListenerStop = null;
}
