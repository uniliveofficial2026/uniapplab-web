import type { StoryDraftMedia } from '../../stories/storyDraft';
import type { Post, Reel, User } from '../../../types';
import { resolvePost, resolveReel } from '../../../lib/entityResolve';
import { normalizeUser, resolveUser, safeHttpUrl, safeMediaUrl, safeUsername } from '../../../lib/safe';
import type { FullscreenMediaState } from './types';

export type SharedLinkDbSlice = {
  posts: Post[];
  reels: Reel[];
  users: User[];
  getUserStorySegments: (userId: string) => StoryDraftMedia[];
};

export type SharedLinkFullscreenResult =
  | { kind: 'fullscreen'; state: FullscreenMediaState }
  | { kind: 'openUrl'; url: string }
  | { kind: 'none' };

export function resolveSharedLinkFullscreen(
  msgText: string,
  db: SharedLinkDbSlice
): SharedLinkFullscreenResult {
  if (msgText.includes('instacollab.app/p/')) {
    const match = msgText.match(/\/p\/([^?\s]+)/);
    const postId = match ? match[1] : null;
    const rawPost = postId ? db.posts.find((p) => p?.id === postId) : null;
    if (rawPost) {
      const post = resolvePost(db.posts, rawPost, db.users);
      const postAuthor = resolveUser(db.users, post.user);
      const mediaUrl = safeMediaUrl(post.videoUrl || post.imageUrl);
      return {
        kind: 'fullscreen',
        state: {
          items: [
            {
              url: mediaUrl,
              isVideo: !!safeHttpUrl(post.videoUrl),
              isAudio: !!post.audioUrl,
              name: post.audioUrl,
              title: `@${postAuthor.username}`,
              caption: post.caption,
              avatarUrl: postAuthor.avatarUrl,
              post,
            },
          ],
          mediaIndex: 0,
        },
      };
    }
  }

  if (msgText.includes('instacollab.app/r/')) {
    const match = msgText.match(/\/r\/([^?\s]+)/);
    const reelId = match ? match[1] : null;
    const rawReel = reelId ? db.reels.find((r) => r?.id === reelId) : null;
    if (rawReel) {
      const reel = resolveReel(db.reels, rawReel, db.users);
      const reelAuthor = resolveUser(db.users, reel.user);
      return {
        kind: 'fullscreen',
        state: {
          items: [
            {
              url: safeMediaUrl(reel.videoUrl),
              isVideo: true,
              title: `@${reelAuthor.username}`,
              caption: reel.caption,
              avatarUrl: reelAuthor.avatarUrl,
              reel,
            },
          ],
          mediaIndex: 0,
        },
      };
    }
  }

  if (msgText.includes('instacollab.app/s/')) {
    const match = msgText.match(/\/s\/([^?\s]+)/);
    const username = match ? match[1] : null;
    const storyUser = username
      ? db.users.find((u) => safeUsername(u?.username) === safeUsername(username))
      : null;
    if (storyUser) {
      const storyAuthor = normalizeUser(storyUser);
      const persistentSegments = db.getUserStorySegments(storyAuthor.id);
      const storySegments =
        persistentSegments.length > 0
          ? persistentSegments
          : [
              {
                url: `https://images.unsplash.com/photo-1621252179027-94459d278660?w=400&fit=crop&sig=${storyAuthor.id}-1`,
                isVideo: false,
              },
              {
                url: `https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&fit=crop&sig=${storyAuthor.id}-2`,
                isVideo: false,
              },
              {
                url: `https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&fit=crop&sig=${storyAuthor.id}-3`,
                isVideo: false,
              },
            ];

      const matchSeg = msgText.match(/[?&]seg=(\d+)/);
      const segIdxForClick = matchSeg ? parseInt(matchSeg[1], 10) : 0;
      const clampIdx = Math.max(0, Math.min(segIdxForClick, storySegments.length - 1));

      return {
        kind: 'fullscreen',
        state: {
          items: storySegments.map((seg: StoryDraftMedia) => ({
            url: safeMediaUrl(seg?.url),
            isVideo: !!seg?.isVideo,
            title: `@${storyAuthor.username}`,
            caption: seg?.caption || 'Story segment',
            avatarUrl: storyAuthor.avatarUrl,
            story: { user: storyAuthor },
          })),
          mediaIndex: clampIdx,
        },
      };
    }
  }

  const splitArr = msgText.split(' ');
  const lastItem = splitArr[splitArr.length - 1];
  if (lastItem.startsWith('http')) {
    return { kind: 'openUrl', url: lastItem };
  }

  return { kind: 'none' };
}
