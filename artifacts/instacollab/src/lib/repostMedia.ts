import type { Post, User } from '../types';
import { resolvePost } from './entityResolve';
import { resolveUser, safeArray, safeString } from './safe';

export type FullscreenMediaItem = {
  url: string;
  isVideo?: boolean;
  isAudio?: boolean;
  name?: string;
  isText?: boolean;
  caption?: string;
  bg?: string;
  font?: string;
  alignment?: string;
  size?: string;
  color?: string;
  audioUrl?: string;
};

const REPOST_CHAIN_MAX_DEPTH = 8;

export type RepostOverlayPatch = Partial<
  Pick<Post, 'textOverlay' | 'textOverlayColor' | 'textOverlaySize' | 'textOverlayPos'>
>;

/** Resolve any post/repost wrapper against the store. */
export function resolveLivePost(
  post: Post,
  posts?: Post[] | null,
  users?: User[] | null,
): Post {
  return resolvePost(posts, post, users);
}

function mediaListHasUrls(post: Post | null | undefined): boolean {
  return safeArray<{ url?: string }>(post?.mediaList).some((item) => !!safeString(item?.url));
}

function hasRenderableMedia(post: Post | null | undefined): boolean {
  if (!post) return false;
  if (mediaListHasUrls(post)) return true;
  return !!(safeString(post.imageUrl) || safeString(post.videoUrl));
}

/** Merge sparse embed snapshots with canonical store media (imageUrl, mediaList, …). */
export function hydrateCanonicalPostMedia(
  post: Post,
  posts?: Post[] | null,
  users?: User[] | null,
): Post {
  const resolved = resolvePost(posts, post, users);
  if (hasRenderableMedia(resolved)) return resolved;

  const canonical = safeArray<Post>(posts).find((row) => row?.id === resolved.id);
  if (!canonical) return resolved;

  const canonicalList = safeArray<NonNullable<Post['mediaList']>[number]>(canonical.mediaList);
  const resolvedList = safeArray<NonNullable<Post['mediaList']>[number]>(resolved.mediaList);
  const mediaList = mediaListHasUrls(resolved)
    ? resolvedList
    : mediaListHasUrls(canonical)
      ? canonicalList
      : resolvedList.length > 0
        ? resolvedList
        : canonicalList;

  return resolvePost(
    posts,
    {
      ...resolved,
      imageUrl: safeString(resolved.imageUrl) || safeString(canonical.imageUrl),
      videoUrl: safeString(resolved.videoUrl) || safeString(canonical.videoUrl),
      audioUrl: resolved.audioUrl || canonical.audioUrl,
      mediaList: mediaList.length > 0 ? mediaList : undefined,
      filter: resolved.filter ?? canonical.filter,
      brightness: resolved.brightness ?? canonical.brightness,
      contrast: resolved.contrast ?? canonical.contrast,
    },
    users,
  );
}

/** Walk embedded repost snapshots to the root original post (canonical media). */
export function resolveRepostRootPost(
  post: Post,
  posts?: Post[] | null,
  users?: User[] | null,
  maxDepth = REPOST_CHAIN_MAX_DEPTH,
): Post {
  let current = resolvePost(posts, post, users);
  let depth = 0;
  while (current.repost && depth < maxDepth) {
    current = resolvePost(posts, current.repost, users);
    depth += 1;
  }
  const { repost: _nested, ...withoutNested } = current;
  return hydrateCanonicalPostMedia(withoutNested as Post, posts, users);
}

/** Embedded repost card for a wrapper post — always the root original. */
export function resolveRepostEmbedPost(
  livePost: Post | null | undefined,
  posts?: Post[] | null,
  users?: User[] | null,
): Post | null {
  if (!livePost?.repost) return null;
  return resolveRepostRootPost(
    resolvePost(posts, livePost.repost, users),
    posts,
    users,
  );
}

/** Canonical original post id for repost counts and share targets. */
export function resolveRepostTargetId(
  source: Post,
  posts?: Post[] | null,
  users?: User[] | null,
): string {
  return resolveRepostRootPost(resolvePost(posts, source, users), posts, users).id;
}

/** Payload stored on new repost wrappers — full canonical media, no nested repost. */
export function buildRepostEmbedSnapshot(
  source: Post,
  posts?: Post[] | null,
  users?: User[] | null,
  overlay?: RepostOverlayPatch,
): Post {
  const root = resolveRepostRootPost(resolvePost(posts, source, users), posts, users);
  const { reposts: _reposts, repost: _nested, ...payload } = root;
  return {
    ...payload,
    user: resolveUser(users, root.user),
    textOverlay: overlay?.textOverlay ?? root.textOverlay,
    textOverlayColor: overlay?.textOverlayColor ?? root.textOverlayColor,
    textOverlaySize: overlay?.textOverlaySize ?? root.textOverlaySize,
    textOverlayPos: overlay?.textOverlayPos ?? root.textOverlayPos,
  };
}

export type PostModalMediaBundle = {
  livePost: Post;
  isRepostEmbed: boolean;
  repostHeaderPost: Post | null;
  mediaPost: Post;
  mediaLivePost: Post;
  /** Wrapper post id (likes, comments, share). */
  playbackWrapperId: string;
  /** Canonical media owner id — playback coordinator for carousel/video/audio. */
  mediaPlaybackId: string;
};

/** Feed / PostModal media bundle — root media for repost wrappers. */
export function resolvePostModalMedia(
  wrapper: Post,
  posts?: Post[] | null,
  users?: User[] | null,
): PostModalMediaBundle {
  const livePost = resolveLivePost(wrapper, posts, users);
  const isRepostEmbed = !!livePost.repost;

  if (isRepostEmbed) {
    const root = resolveRepostEmbedPost(livePost, posts, users);
    const mediaLivePost = root
      ? hydrateCanonicalPostMedia(root, posts, users)
      : hydrateCanonicalPostMedia(livePost, posts, users);
    return {
      livePost,
      isRepostEmbed,
      repostHeaderPost: mediaLivePost,
      mediaPost: mediaLivePost,
      mediaLivePost,
      playbackWrapperId: livePost.id,
      mediaPlaybackId: mediaLivePost.id,
    };
  }

  const bundle = resolvePostMediaSource(wrapper, livePost, posts, users);
  const mediaLivePost = hydrateCanonicalPostMedia(bundle.livePost, posts, users);
  return {
    livePost,
    isRepostEmbed,
    repostHeaderPost: null,
    mediaPost: hydrateCanonicalPostMedia(bundle.post, posts, users),
    mediaLivePost,
    playbackWrapperId: livePost.id,
    mediaPlaybackId: mediaLivePost.id,
  };
}

/** Original post + media bundle for repost modal preview. */
export function resolveRepostPreview(
  source: Post,
  posts?: Post[] | null,
  users?: User[] | null,
): { originalPost: Post; mediaPost: Post; mediaLivePost: Post } {
  const originalPost = resolveRepostRootPost(
    resolvePost(posts, source, users),
    posts,
    users,
  );
  const bundle = resolvePostMediaSource(originalPost, originalPost, posts, users);
  const mediaLivePost = hydrateCanonicalPostMedia(bundle.livePost, posts, users);
  return {
    originalPost,
    mediaPost: hydrateCanonicalPostMedia(bundle.post, posts, users),
    mediaLivePost,
  };
}

/** Resolve the embedded repost payload against canonical posts/users. */
export function resolveRepostMediaPost(
  livePost: Post | null | undefined,
  posts?: Post[] | null,
  users?: User[] | null
): Post | null {
  return resolveRepostEmbedPost(livePost, posts, users);
}

/** Post used for carousel, playback, and fullscreen (inner repost when present). */
export function resolvePostMediaSource(
  post: Post,
  livePost: Post,
  posts?: Post[] | null,
  users?: User[] | null
): { post: Post; livePost: Post } {
  const repostMedia = resolveRepostMediaPost(livePost, posts, users);
  if (repostMedia) {
    return { post: repostMedia, livePost: repostMedia };
  }
  return { post, livePost };
}

export function isPostTextOnly(post: Post | null | undefined): boolean {
  if (!post) return false;
  return (
    (!post.mediaList || post.mediaList.length === 0) &&
    !post.videoUrl &&
    !post.imageUrl
  );
}

export function buildPostFullscreenItems(post: Post): FullscreenMediaItem[] {
  if (isPostTextOnly(post)) {
    return [
      {
        url: '',
        isText: true,
        caption: post.caption,
        bg: post.bg,
        font: post.font,
        alignment: post.alignment,
        size: post.size,
        color: post.color,
        audioUrl: post.audioUrl,
      },
    ];
  }

  const mediaList = post.mediaList || [];
  if (mediaList.length > 0) {
    return mediaList.map((m) => ({
      url: m.url,
      isVideo: m.type === 'video',
      isAudio: m.type === 'audio',
      name: m.name,
    }));
  }

  if (post.videoUrl) {
    return [{ url: post.videoUrl, isVideo: true }];
  }

  return [{ url: post.imageUrl || '', isVideo: false }];
}
