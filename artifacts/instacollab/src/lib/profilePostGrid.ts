import type { Post } from '../types';
import type { LocalDB } from './db/localDbType';
import { countCommentThread, resolvePost } from './entityResolve';
import { resolvePostMediaSource } from './repostMedia';
import { resolvePostDisplayMedia, safeMediaUrl } from './safe';

export type ProfileGridPost = {
  id: string;
  thumbUrl: string;
  likes: number;
  comments: number;
  isVideo: boolean;
};

/** Canonical thumbnail + live engagement counts for profile grids. */
export function resolveProfileGridPost(
  raw: Post,
  db: Pick<LocalDB, 'posts' | 'users' | 'postComments'>,
): ProfileGridPost {
  const livePost = resolvePost(db.posts, raw, db.users);
  const { post: mediaPost } = resolvePostMediaSource(livePost, livePost, db.posts, db.users);
  const thread = db.postComments[livePost.id];
  const comments = Math.max(
    Number(livePost.comments) || 0,
    countCommentThread(thread),
  );
  const media = resolvePostDisplayMedia(mediaPost);
  const thumbUrl = safeMediaUrl(
    media.showAsImage ? media.url : media.posterUrl || media.url,
  );
  return {
    id: livePost.id,
    thumbUrl,
    likes: Number(livePost.likes) || 0,
    comments,
    isVideo: media.type === 'video' && !media.showAsImage,
  };
}
