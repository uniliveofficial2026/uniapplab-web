import { useState, useEffect } from 'react';
import { db } from './db/localDb';
import type { Post, Reel, User } from '../types';
import { findUserById, resolveUser, safeUserId } from './safe';
import { resolvePost, resolveReel, resolveCommentAuthor } from './entityResolve';
import type { CommentLike } from './entityResolve';

export function useDB() {
  const [, setRevision] = useState(0);

  useEffect(() => {
    const unsubscribe = db.subscribe(() => setRevision((r) => r + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  return db;
}

/** Subscribe to DB mutations (same cadence as useDB re-renders). */
export function useDbRevision(): number {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const unsubscribe = db.subscribe(() => setRevision((r) => r + 1));
    return () => {
      unsubscribe();
    };
  }, []);
  return revision;
}

/** Live user from canonical `users` table; re-renders when any screen mutates that user. */
export function useResolvedUser(
  embedded: Partial<User> | null | undefined,
  fallback?: Partial<User>
): User {
  const db = useDB();
  return resolveUser(db.users, embedded, fallback);
}

/** Live user by id from canonical `users` table. */
export function useUserById(
  userId: string | null | undefined,
  fallback?: Partial<User>
): User {
  const db = useDB();
  return findUserById(db.users, safeUserId(userId), fallback);
}

/** Live post from canonical `posts` by id. */
export function usePostById(
  postId: string | null | undefined,
  fallback?: Partial<Post>
): Post | null {
  const db = useDB();
  const id = safeStringPostId(postId);
  if (!id) return fallback ? resolvePost(db.posts, fallback as Post, db.users) : null;
  const row = db.posts.find((p) => p.id === id);
  if (!row) return fallback ? resolvePost(db.posts, fallback as Post, db.users) : null;
  return resolvePost(db.posts, row, db.users);
}

/** Live post merged with canonical store (for feed cards). */
export function useResolvedPost(
  embedded: Partial<Post> | null | undefined
): Post | null {
  const db = useDB();
  if (!embedded?.id) return null;
  return resolvePost(db.posts, embedded as Post, db.users);
}

/** Live reel merged with canonical store. */
export function useResolvedReel(
  embedded: Partial<Reel> | null | undefined
): Reel | null {
  const db = useDB();
  if (!embedded?.id) return null;
  return resolveReel(db.reels, embedded as Reel, db.users);
}

export function useResolvedCommentAuthor(
  comment: CommentLike | null | undefined,
  fallback?: Partial<User>
): User {
  const db = useDB();
  return resolveCommentAuthor(db.users, comment, fallback ?? db.currentUser);
}

function safeStringPostId(value: string | null | undefined): string | null {
  const id = typeof value === 'string' ? value.trim() : '';
  return id.length > 0 ? id : null;
}
