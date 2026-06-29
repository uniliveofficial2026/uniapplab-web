import type { StoryDraftMedia } from '../../stories/storyDraft';
import type { Post, Reel, User } from '../../../types';
import { resolvePost, resolveReel } from '../../../lib/entityResolve';
import { resolvePostMediaSource } from '../../../lib/repostMedia';
import { postCarouselItemCount } from '../../../lib/mediaPlayback';
import { parseShareLink } from '../../../lib/shareLinks';
import {
  normalizeUser,
  resolvePostDisplayMedia,
  resolveUser,
  safeMediaUrl,
  safeUsername,
} from '../../../lib/safe';
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

function buildPostFullscreenItems(
  posts: Post[],
  users: User[],
  post: Post,
): FullscreenMediaState['items'] {
  const { post: mediaPost } = resolvePostMediaSource(post, post, posts, users);
  const author = resolveUser(users, mediaPost.user);
  const count = postCarouselItemCount(mediaPost);
  if (count <= 1) {
    const media = resolvePostDisplayMedia(mediaPost, 0);
    return [
      {
        url: media.url,
        isVideo: media.type === 'video' && !media.showAsImage,
        isAudio: media.type === 'audio',
        name: mediaPost.audioUrl,
        title: `@${author.username}`,
        caption: mediaPost.caption,
        avatarUrl: author.avatarUrl,
        post,
      },
    ];
  }

  return Array.from({ length: count }, (_, idx) => {
    const media = resolvePostDisplayMedia(mediaPost, idx);
    return {
      url: media.url,
      isVideo: media.type === 'video' && !media.showAsImage,
      isAudio: media.type === 'audio',
      name: mediaPost.mediaList?.[idx]?.name,
      title: `@${author.username}`,
      caption: mediaPost.caption,
      avatarUrl: author.avatarUrl,
      post,
    };
  });
}

function buildReelFullscreenItems(
  reel: Reel,
  author: User,
): FullscreenMediaState['items'] {
  const count = postCarouselItemCount(reel);
  if (count <= 1) {
    return [
      {
        url: safeMediaUrl(reel.videoUrl),
        isVideo: true,
        title: `@${author.username}`,
        caption: reel.caption,
        avatarUrl: author.avatarUrl,
        reel,
      },
    ];
  }

  return (reel.mediaList ?? []).map((item) => ({
    url: safeMediaUrl(item.url),
    isVideo: item.type === 'video',
    isAudio: item.type === 'audio',
    name: item.name,
    title: `@${author.username}`,
    caption: reel.caption,
    avatarUrl: author.avatarUrl,
    reel,
  }));
}

export function resolveSharedLinkFullscreen(
  msgText: string,
  db: SharedLinkDbSlice,
  mediaIndex = 0,
): SharedLinkFullscreenResult {
  const ref = parseShareLink(msgText);

  if (ref?.kind === 'post' && ref.postId) {
    const rawPost = db.posts.find((p) => p?.id === ref.postId);
    if (rawPost) {
      const post = resolvePost(db.posts, rawPost, db.users);
      const items = buildPostFullscreenItems(db.posts, db.users, post);
      const clampIdx = Math.max(0, Math.min(mediaIndex, items.length - 1));
      return { kind: 'fullscreen', state: { items, mediaIndex: clampIdx } };
    }
  }

  if (ref?.kind === 'reel' && ref.reelId) {
    const rawReel = db.reels.find((r) => r?.id === ref.reelId);
    if (rawReel) {
      const reel = resolveReel(db.reels, rawReel, db.users);
      const reelAuthor = resolveUser(db.users, reel.user);
      const items = buildReelFullscreenItems(reel, reelAuthor);
      const clampIdx = Math.max(0, Math.min(mediaIndex, items.length - 1));
      return { kind: 'fullscreen', state: { items, mediaIndex: clampIdx } };
    }
  }

  if (ref?.kind === 'story' && ref.storyUsername) {
    const storyUser = db.users.find(
      (u) => safeUsername(u?.username) === safeUsername(ref.storyUsername!),
    );
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
            ];

      const segIdxForClick = ref.storySegment ?? mediaIndex;
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

  if (msgText.includes('/p/')) {
    const match = msgText.match(/\/p\/([^?\s]+)/);
    const postId = match ? match[1] : null;
    const rawPost = postId ? db.posts.find((p) => p?.id === postId) : null;
    if (rawPost) {
      const post = resolvePost(db.posts, rawPost, db.users);
      const items = buildPostFullscreenItems(db.posts, db.users, post);
      const clampIdx = Math.max(0, Math.min(mediaIndex, items.length - 1));
      return { kind: 'fullscreen', state: { items, mediaIndex: clampIdx } };
    }
  }

  if (msgText.includes('/r/')) {
    const match = msgText.match(/\/r\/([^?\s]+)/);
    const reelId = match ? match[1] : null;
    const rawReel = reelId ? db.reels.find((r) => r?.id === reelId) : null;
    if (rawReel) {
      const reel = resolveReel(db.reels, rawReel, db.users);
      const reelAuthor = resolveUser(db.users, reel.user);
      const items = buildReelFullscreenItems(reel, reelAuthor);
      const clampIdx = Math.max(0, Math.min(mediaIndex, items.length - 1));
      return { kind: 'fullscreen', state: { items, mediaIndex: clampIdx } };
    }
  }

  const splitArr = msgText.split(' ');
  const lastItem = splitArr[splitArr.length - 1];
  if (lastItem.startsWith('http')) {
    return { kind: 'openUrl', url: lastItem };
  }

  return { kind: 'none' };
}
