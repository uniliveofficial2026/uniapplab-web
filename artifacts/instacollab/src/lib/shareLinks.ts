import type { Post, Reel, User } from '../types';
import { resolvePost, resolveReel } from './entityResolve';
import { getProfileDisplayName, getProfileHandle } from './profileDisplay';
import { captureShareProfileReturnContext } from './karaokeReturnContext';
import { isKaraokeProfileSurface, openUserProfileSurface } from './profileSurface';
import { syncKaraokeUrl, type KaraokeProfileTab } from './karaokeSearch';
import { postCarouselItemCount } from './mediaPlayback';
import { resolvePostMediaSource } from './repostMedia';
import {
  resolvePostDisplayMedia,
  resolveUser,
  safeAvatarUrl,
  safeMediaUrl,
  safeUsername,
  safeVideoUrl,
} from './safe';
import { getRoomSettings } from '../smule-rooms/utils/storage';

export type ShareKind =
  | 'post'
  | 'reel'
  | 'story'
  | 'profile'
  | 'live'
  | 'party'
  | 'karaoke-track'
  | 'karaoke-profile';

export type ShareLinkRef = {
  kind: ShareKind;
  rawUrl: string;
  postId?: string;
  reelId?: string;
  storyUsername?: string;
  storySegment?: number;
  profileUsername?: string;
  liveUserId?: string;
  partyRoomId?: string;
  karaokeTrackId?: string;
  karaokeRecordingId?: string;
  karaokeProfileUsername?: string;
  karaokeProfileUserId?: string;
  karaokeProfileTab?: KaraokeProfileTab;
};

export type SharePayload = {
  kind: ShareKind;
  shareUrl: string;
  shareText: string;
  itemTitle: string;
  notificationText: string;
};

export type ShareCardMediaItem = {
  url: string;
  posterUrl?: string;
  isVideo?: boolean;
  isAudio?: boolean;
};

export type ShareCardMeta = {
  ref: ShareLinkRef;
  typeLabel: string;
  userId?: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  caption?: string;
  thumbnailUrl?: string;
  isVideo?: boolean;
  audioLabel?: string;
  mediaItems?: ShareCardMediaItem[];
  mediaCount?: number;
  initialMediaIndex?: number;
  isRepost?: boolean;
  repostBy?: string;
  repostCaption?: string;
  contentAuthorUserId?: string;
  contentAuthorDisplayName?: string;
  contentAuthorUsername?: string;
  contentAuthorAvatarUrl?: string;
  contentCaption?: string;
  roomTitle?: string;
  isLive?: boolean;
  profileSurface?: 'app' | 'karaoke';
};

const SHARE_HOST = 'instacollab.app';

export function shareOrigin(): string {
  return `https://${SHARE_HOST}`;
}

export function formatShareMessage(shareText: string, shareUrl: string): string {
  return `${shareText}: ${shareUrl}`;
}

export function extractShareUrl(text: string): string | null {
  const match = text.match(/https?:\/\/(?:www\.)?instacollab\.app\/[^\s]+/i);
  if (match) return match[0];
  const hashRoom = text.match(/#karaoke-room\/([^\s#?]+)/i);
  if (hashRoom) {
    const origin = typeof window !== 'undefined' ? window.location.origin : shareOrigin();
    return `${origin}${typeof window !== 'undefined' ? window.location.pathname : '/'}#karaoke-room/${hashRoom[1]}`;
  }
  const lastToken = text.trim().split(/\s+/).pop();
  if (lastToken?.startsWith('http')) return lastToken;
  return null;
}

export function isShareLinkMessage(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') return false;
  if (/instacollab\.app\//i.test(text)) return true;
  if (/#karaoke-room\//i.test(text)) return true;
  return parseShareLink(text) !== null;
}

function parseSegment(text: string): number | undefined {
  const match = text.match(/[?&]seg=(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

export function parseShareLink(text: string): ShareLinkRef | null {
  const rawUrl = extractShareUrl(text);
  if (!rawUrl) return null;

  const normalized = rawUrl.replace(/^https?:\/\/(?:www\.)?/i, '');

  let m = normalized.match(/^instacollab\.app\/p\/([^/?#\s]+)/i);
  if (m) {
    return { kind: 'post', rawUrl, postId: m[1] };
  }

  m = normalized.match(/^instacollab\.app\/r\/([^/?#\s]+)/i);
  if (m) {
    return { kind: 'reel', rawUrl, reelId: m[1] };
  }

  m = normalized.match(/^instacollab\.app\/s\/([^/?#\s]+)/i);
  if (m) {
    return {
      kind: 'story',
      rawUrl,
      storyUsername: decodeURIComponent(m[1]),
      storySegment: parseSegment(rawUrl),
    };
  }

  m = normalized.match(/^instacollab\.app\/u\/([^/?#\s]+)/i);
  if (m) {
    return {
      kind: 'profile',
      rawUrl,
      profileUsername: decodeURIComponent(m[1]),
    };
  }

  m = normalized.match(/^instacollab\.app\/live\/([^/?#\s]+)/i);
  if (m) {
    return { kind: 'live', rawUrl, liveUserId: m[1] };
  }

  m = normalized.match(/^instacollab\.app\/room\/([^/?#\s]+)/i);
  if (m) {
    return { kind: 'party', rawUrl, partyRoomId: m[1] };
  }

  m = normalized.match(/^instacollab\.app\/k\/t\/([^/?#\s]+)/i);
  if (m) {
    const rec = rawUrl.match(/[?&]recording=([^&\s]+)/i);
    return {
      kind: 'karaoke-track',
      rawUrl,
      karaokeTrackId: m[1],
      karaokeRecordingId: rec?.[1],
    };
  }

  m = normalized.match(/^instacollab\.app\/k\/u\/id\/([^/?#\s]+)/i);
  if (m) {
    const tab = rawUrl.match(/[?&]profileTab=([^&\s]+)/i)?.[1] as KaraokeProfileTab | undefined;
    return {
      kind: 'karaoke-profile',
      rawUrl,
      karaokeProfileUserId: decodeURIComponent(m[1]),
      karaokeProfileTab: tab,
    };
  }

  m = normalized.match(/^instacollab\.app\/k\/u\/([^/?#\s]+)/i);
  if (m) {
    const tab = rawUrl.match(/[?&]profileTab=([^&\s]+)/i)?.[1] as KaraokeProfileTab | undefined;
    const segment = decodeURIComponent(m[1]);
    if (segment.toLowerCase() !== 'id') {
      return {
        kind: 'karaoke-profile',
        rawUrl,
        karaokeProfileUsername: segment,
        karaokeProfileTab: tab,
      };
    }
  }

  if (/#karaoke-room\/([^/?#\s]+)/i.test(rawUrl)) {
    m = rawUrl.match(/#karaoke-room\/([^/?#\s]+)/i);
    if (m) {
      return { kind: 'party', rawUrl, partyRoomId: m[1] };
    }
  }

  try {
    const url = new URL(rawUrl);
    const tab = url.searchParams.get('tab');
    const user = url.searchParams.get('user');
    const track = url.searchParams.get('track');
    const recording = url.searchParams.get('recording');
    if (tab === 'profile' || user) {
      const profileTab = url.searchParams.get('profileTab') as KaraokeProfileTab | null;
      const userIdParam = url.searchParams.get('userId');
      return {
        kind: 'karaoke-profile',
        rawUrl,
        karaokeProfileUserId: userIdParam ?? undefined,
        karaokeProfileUsername: user ? safeUsername(user) : undefined,
        karaokeProfileTab: profileTab ?? undefined,
      };
    }
    if (track) {
      return {
        kind: 'karaoke-track',
        rawUrl,
        karaokeTrackId: track,
        karaokeRecordingId: recording ?? undefined,
      };
    }
  } catch {
    /* ignore malformed URLs */
  }

  return null;
}

export function buildPostSharePayload(postId: string): SharePayload {
  const shareUrl = `${shareOrigin()}/p/${postId}`;
  return {
    kind: 'post',
    shareUrl,
    shareText: 'Shared a post',
    itemTitle: 'Share Post',
    notificationText: 'Shared a post with you',
  };
}

export function buildReelSharePayload(reelId: string): SharePayload {
  const shareUrl = `${shareOrigin()}/r/${reelId}`;
  return {
    kind: 'reel',
    shareUrl,
    shareText: 'Shared a reel',
    itemTitle: 'Share Reel',
    notificationText: 'Shared a reel with you',
  };
}

export function buildStorySharePayload(username: string, segmentIndex = 0): SharePayload {
  const handle = username.replace(/^@/, '');
  const shareUrl = `${shareOrigin()}/s/${encodeURIComponent(handle)}?seg=${segmentIndex}`;
  return {
    kind: 'story',
    shareUrl,
    shareText: `Shared @${handle}'s story`,
    itemTitle: 'Share Story',
    notificationText: `Shared @${handle}'s story with you`,
  };
}

export function buildProfileSharePayloadFromUser(
  user: Pick<User, 'id' | 'username' | 'displayName'> & { handle?: string },
  options?: { isSelf?: boolean; surface?: 'app' | 'karaoke'; profileTab?: KaraokeProfileTab | null },
): SharePayload {
  const name = getProfileDisplayName(user);
  const handle = getProfileHandle(user) || user.handle?.replace(/^@/, '') || user.username;
  const isSelf = options?.isSelf ?? false;
  const surface = options?.surface ?? 'app';

  if (surface === 'karaoke') {
    const cleanHandle = handle?.replace(/^@/, '').trim();
    const profileTabQuery = options?.profileTab
      ? `?profileTab=${encodeURIComponent(options.profileTab)}`
      : '';
    const shareUrl = user.id
      ? `${shareOrigin()}/k/u/id/${encodeURIComponent(user.id)}${profileTabQuery}`
      : cleanHandle
        ? `${shareOrigin()}/k/u/${encodeURIComponent(cleanHandle)}${profileTabQuery}`
        : `${shareOrigin()}/k/u/id/${encodeURIComponent(user.id)}${profileTabQuery}`;
    return {
      kind: 'karaoke-profile',
      shareUrl,
      shareText: isSelf ? 'Check out my K-Star profile' : `Check out ${name} on K-Star`,
      itemTitle: isSelf ? 'Share Your K-Star Profile' : `Share ${name}'s Profile`,
      notificationText: isSelf ? 'Shared their K-Star profile' : `Shared ${name}'s K-Star profile`,
    };
  }

  const shareUrl = handle
    ? `${shareOrigin()}/u/${encodeURIComponent(handle)}`
    : `${shareOrigin()}/?tab=profile&userId=${encodeURIComponent(user.id)}`;

  return {
    kind: 'profile',
    shareUrl,
    shareText: isSelf ? 'Check out my profile' : `Check out ${name}'s profile`,
    itemTitle: isSelf ? 'Share Your Profile' : `Share ${name}'s Profile`,
    notificationText: isSelf ? 'Shared their profile' : `Shared ${name}'s profile`,
  };
}

export function buildLiveSharePayload(userId: string, displayName?: string): SharePayload {
  const shareUrl = `${shareOrigin()}/live/${encodeURIComponent(userId)}`;
  const label = displayName?.trim() || 'a live stream';
  return {
    kind: 'live',
    shareUrl,
    shareText: `Join ${label} live`,
    itemTitle: 'Share Live',
    notificationText: `Invited you to ${label} live`,
  };
}

export function buildPartySharePayload(roomId: string, roomTitle?: string): SharePayload {
  const shareUrl = `${shareOrigin()}/room/${encodeURIComponent(roomId)}`;
  const label = roomTitle?.trim() || 'a party room';
  return {
    kind: 'party',
    shareUrl,
    shareText: `Join my party room: ${label}`,
    itemTitle: 'Share Party Room',
    notificationText: `Invited you to party room: ${label}`,
  };
}

export function buildKaraokeTrackSharePayload(options: {
  trackId: string;
  recordingId?: string | null;
  title?: string;
}): SharePayload {
  const base = `${shareOrigin()}/k/t/${encodeURIComponent(options.trackId)}`;
  const shareUrl = options.recordingId
    ? `${base}?recording=${encodeURIComponent(options.recordingId)}`
    : base;
  const label = options.title?.trim() || 'this karaoke cover';
  return {
    kind: 'karaoke-track',
    shareUrl,
    shareText: `Listen to ${label} on K-Star`,
    itemTitle: 'Share Cover',
    notificationText: `Shared a K-Star cover: ${label}`,
  };
}

export function sharePreviewLabel(text: string): string | null {
  const ref = parseShareLink(text);
  if (!ref) return null;
  switch (ref.kind) {
    case 'post':
      return 'Shared a post';
    case 'reel':
      return 'Shared a reel';
    case 'story':
      return ref.storyUsername ? `Shared @${ref.storyUsername}'s story` : 'Shared a story';
    case 'profile':
      return ref.profileUsername ? `Shared @${ref.profileUsername}'s profile` : 'Shared a profile';
    case 'live':
      return 'Shared a live stream';
    case 'party':
      return 'Shared a party room';
    case 'karaoke-track':
      return 'Shared a K-Star cover';
    case 'karaoke-profile':
      return ref.karaokeProfileUsername
        ? `Shared @${ref.karaokeProfileUsername} on K-Star`
        : 'Shared a K-Star profile';
    default:
      return 'Shared content';
  }
}

function resolveUserShareAvatar(user: User | undefined, seed?: string): string {
  if (user?.avatarUrl?.trim()) {
    return safeAvatarUrl(user.avatarUrl);
  }
  const avatarSeed = seed ?? user?.id ?? user?.username ?? 'user';
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(avatarSeed))}`;
}

function resolveShareProfileAvatar(user: User | undefined, ref: ShareLinkRef): string {
  return resolveUserShareAvatar(
    user,
    user?.id ??
      ref.karaokeProfileUserId ??
      ref.profileUsername ??
      ref.karaokeProfileUsername,
  );
}

/** Resolve a K-Star profile share link to a user row when possible. */
function resolveKaraokeProfileUser(
  ref: ShareLinkRef,
  users: User[],
  contextUserId?: string,
): User | undefined {
  if (ref.karaokeProfileUserId) {
    const byId = users.find((u) => u.id === ref.karaokeProfileUserId);
    if (byId) return byId;
  }
  if (ref.karaokeProfileUsername) {
    const byUsername = users.find(
      (u) => safeUsername(u.username) === safeUsername(ref.karaokeProfileUsername!),
    );
    if (byUsername) return byUsername;
  }
  const hasExplicitIdentity = Boolean(ref.karaokeProfileUserId || ref.karaokeProfileUsername);
  if (!hasExplicitIdentity && contextUserId) {
    return users.find((u) => u.id === contextUserId);
  }
  return undefined;
}

function karaokeProfileHandleParam(user: User | undefined, ref: ShareLinkRef): string | null {
  if (user?.username) return `@${user.username}`;
  if (ref.karaokeProfileUsername) return `@${safeUsername(ref.karaokeProfileUsername)}`;
  return null;
}

/** Navigate to a K-Star profile from a share ref (messages, notifications, etc.). */
function openKaraokeProfileFromShare(
  ref: ShareLinkRef,
  users: User[],
  hints?: { userId?: string; username?: string },
): void {
  const hasUrlIdentity = Boolean(ref.karaokeProfileUserId || ref.karaokeProfileUsername);
  const resolved =
    (ref.karaokeProfileUserId
      ? users.find((u) => u.id === ref.karaokeProfileUserId)
      : undefined) ??
    (ref.karaokeProfileUsername
      ? users.find(
          (u) => safeUsername(u.username) === safeUsername(ref.karaokeProfileUsername!),
        )
      : undefined) ??
    (!hasUrlIdentity && hints?.userId
      ? users.find((u) => u.id === hints.userId)
      : undefined) ??
    (!hasUrlIdentity && hints?.username
      ? users.find((u) => safeUsername(u.username) === safeUsername(hints.username!))
      : undefined);

  const profileTab = ref.karaokeProfileTab ?? 'covers';
  const userId = hasUrlIdentity
    ? (resolved?.id ?? ref.karaokeProfileUserId ?? null)
    : (resolved?.id ?? hints?.userId ?? null);
  const username = hasUrlIdentity
    ? (resolved?.username ?? ref.karaokeProfileUsername ?? null)
    : (resolved?.username ?? hints?.username ?? null);
  const userParam =
    karaokeProfileHandleParam(resolved, ref) ??
    (username ? `@${safeUsername(username)}` : null);

  if (!isKaraokeProfileSurface()) {
    syncKaraokeUrl({
      tab: 'profile',
      profileTab,
      user: userParam,
      track: null,
      recording: null,
    });
    window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'karaoke' } }));
  }

  const returnContext = captureShareProfileReturnContext();
  const closeRoomFlow = returnContext.surface === 'karaoke-party-room';

  const dispatchOpen = () => {
    window.dispatchEvent(
      new CustomEvent('karaoke-profile-open', {
        detail: {
          userId,
          username,
          profileTab,
          closeRoomFlow,
          fromShare: true,
          returnContext,
        },
      }),
    );
  };

  if (isKaraokeProfileSurface()) {
    dispatchOpen();
    return;
  }

  // KaraokeScreen lazy-mounts after tab switch — defer so the listener is registered.
  requestAnimationFrame(() => {
    requestAnimationFrame(dispatchOpen);
  });
}

/** Open the user shown on a share card (profile, post author, story owner, etc.). */
export function openShareCardAuthor(meta: ShareCardMeta, users: User[] = []): void {
  const findUser = (username?: string) => {
    if (!username) return undefined;
    return users.find((u) => safeUsername(u.username) === safeUsername(username));
  };

  if (meta.ref.kind === 'karaoke-profile' || meta.profileSurface === 'karaoke') {
    const hasUrlIdentity = Boolean(
      meta.ref.karaokeProfileUserId || meta.ref.karaokeProfileUsername,
    );
    openKaraokeProfileFromShare(meta.ref, users, hasUrlIdentity ? undefined : {
      userId: meta.userId,
      username: meta.username ?? undefined,
    });
    return;
  }

  if (meta.userId) {
    openUserProfileSurface({ userId: meta.userId });
    return;
  }

  const profileUsername = meta.ref.profileUsername ?? meta.ref.storyUsername ?? meta.username;
  const user = findUser(profileUsername);
  if (user) {
    openUserProfileSurface({ userId: user.id });
  }
}

export function resolveShareCardMeta(
  text: string,
  db: {
    posts: Post[];
    reels: Reel[];
    users: User[];
    getProfileStorySegments: (userId: string) => { url?: string; isVideo?: boolean; caption?: string }[];
    contextUserId?: string;
  },
): ShareCardMeta | null {
  const ref = parseShareLink(text);
  if (!ref) return null;

  const findUser = (username?: string) => {
    if (!username) return undefined;
    return db.users.find((u) => safeUsername(u.username) === safeUsername(username));
  };

  const authorMeta = (user: User | undefined, typeLabel: string, extra?: Partial<ShareCardMeta>): ShareCardMeta => ({
    ref,
    typeLabel,
    userId: user?.id,
    displayName: user ? getProfileDisplayName(user) : undefined,
    username: user?.username,
    avatarUrl: user?.avatarUrl,
    ...extra,
  });

  const buildPostMediaItems = (post: Post): ShareCardMediaItem[] => {
    if (post.mediaList?.length) {
      return post.mediaList.map((item) => ({
        url: safeMediaUrl(item.url),
        posterUrl: safeMediaUrl(post.imageUrl),
        isVideo: item.type === 'video',
        isAudio: item.type === 'audio',
      }));
    }
    if (post.videoUrl) {
      return [{
        url: safeVideoUrl(post.videoUrl) || safeMediaUrl(post.imageUrl),
        posterUrl: safeMediaUrl(post.imageUrl),
        isVideo: true,
      }];
    }
    if (post.imageUrl) {
      return [{ url: safeMediaUrl(post.imageUrl) }];
    }
    if (post.audioUrl) {
      return [{
        url: safeMediaUrl(post.imageUrl || post.audioCoverUrl),
        posterUrl: safeMediaUrl(post.imageUrl || post.audioCoverUrl),
        isAudio: true,
      }];
    }
    return [];
  };

  const buildReelMediaItems = (reel: Reel): ShareCardMediaItem[] => {
    if (reel.mediaList?.length) {
      return reel.mediaList.map((item) => ({
        url: safeMediaUrl(item.url),
        posterUrl: safeMediaUrl(reel.imageUrl),
        isVideo: item.type === 'video',
        isAudio: item.type === 'audio',
      }));
    }
    if (reel.videoUrl) {
      return [{ url: safeVideoUrl(reel.videoUrl) || '', posterUrl: safeMediaUrl(reel.imageUrl), isVideo: true }];
    }
    return [];
  };

  const shareNote = text
    .replaceAll(/https?:\/\/[^\s]+/g, '')
    .replace(/^[^:]+:\s*/, '')
    .trim();

  switch (ref.kind) {
    case 'post': {
      const rawPost = ref.postId ? db.posts.find((p) => p.id === ref.postId) : undefined;
      if (!rawPost) {
        return { ref, typeLabel: 'Post', caption: shareNote || undefined };
      }
      const post = resolvePost(db.posts, rawPost, db.users);
      const isRepost = Boolean(post.repost);
      const mediaPost = resolvePostMediaSource(post, post, db.posts, db.users).post;
      const contentAuthor = resolveUser(db.users, mediaPost.user);
      const reposter = isRepost ? resolveUser(db.users, post.user) : undefined;
      const mediaItems = buildPostMediaItems(mediaPost);
      const firstMedia = resolvePostDisplayMedia(mediaPost, 0);
      const mediaCount = postCarouselItemCount(mediaPost);
      const typeLabel = isRepost
        ? 'Repost'
        : firstMedia.type === 'video'
          ? 'Video'
          : firstMedia.type === 'audio'
            ? 'Audio'
            : mediaCount > 1
              ? `Post · ${mediaCount} items`
              : 'Post';

      const reposterMeta = reposter ?? contentAuthor;

      return authorMeta(reposterMeta, typeLabel, {
        caption: isRepost ? undefined : mediaPost.caption?.trim() || shareNote || undefined,
        thumbnailUrl: firstMedia.url || firstMedia.posterUrl,
        isVideo: firstMedia.type === 'video',
        audioLabel: mediaPost.audioUrl,
        mediaItems,
        mediaCount,
        isRepost,
        repostBy: reposter ? getProfileDisplayName(reposter) : undefined,
        repostCaption: isRepost ? post.caption?.trim() || shareNote || undefined : undefined,
        avatarUrl: isRepost
          ? resolveUserShareAvatar(reposter, reposter?.id ?? reposter?.username)
          : undefined,
        contentAuthorUserId: isRepost ? contentAuthor.id : undefined,
        contentAuthorDisplayName: isRepost ? getProfileDisplayName(contentAuthor) : undefined,
        contentAuthorUsername: isRepost ? contentAuthor.username : undefined,
        contentAuthorAvatarUrl: isRepost
          ? resolveUserShareAvatar(contentAuthor, contentAuthor.id ?? contentAuthor.username)
          : undefined,
        contentCaption: isRepost ? mediaPost.caption?.trim() : undefined,
      });
    }
    case 'reel': {
      const rawReel = ref.reelId ? db.reels.find((r) => r.id === ref.reelId) : undefined;
      if (!rawReel) {
        return { ref, typeLabel: 'Reel', caption: shareNote || undefined };
      }
      const reel = resolveReel(db.reels, rawReel, db.users);
      const author = resolveUser(db.users, reel.user);
      const mediaItems = buildReelMediaItems(reel);
      const mediaCount = postCarouselItemCount(reel);
      return authorMeta(author, mediaCount > 1 ? `Reel · ${mediaCount} clips` : 'Reel', {
        caption: reel.caption?.trim() || shareNote || undefined,
        thumbnailUrl: safeMediaUrl(reel.videoUrl || reel.imageUrl),
        isVideo: true,
        mediaItems,
        mediaCount,
      });
    }
    case 'story': {
      const storyUser = findUser(ref.storyUsername);
      const segments = storyUser ? db.getProfileStorySegments(storyUser.id) : [];
      const segIdx = ref.storySegment ?? 0;
      const segment = segments[segIdx] ?? segments[0];
      const mediaItems: ShareCardMediaItem[] = segments.length
        ? segments.map((seg) => ({
            url: safeMediaUrl(seg?.url),
            isVideo: !!seg?.isVideo,
          }))
        : segment?.url
          ? [{ url: safeMediaUrl(segment.url), isVideo: !!segment.isVideo }]
          : [];
      return authorMeta(storyUser, segments.length > 1 ? `Story · ${segments.length}` : 'Story', {
        caption: segment?.caption?.trim() || shareNote || undefined,
        thumbnailUrl: safeMediaUrl(segment?.url),
        isVideo: !!segment?.isVideo,
        mediaItems,
        mediaCount: segments.length || (segment ? 1 : 0),
        initialMediaIndex: segIdx,
      });
    }
    case 'profile': {
      const user = findUser(ref.profileUsername);
      const avatarUrl = resolveShareProfileAvatar(user, ref);
      return authorMeta(user, 'Profile', {
        caption: user?.bio?.trim() || shareNote || undefined,
        thumbnailUrl: avatarUrl,
        avatarUrl,
      });
    }
    case 'live': {
      const user = ref.liveUserId
        ? db.users.find((u) => u.id === ref.liveUserId)
        : undefined;
      return authorMeta(user, 'Live', {
        caption: shareNote || 'Tap to join live',
        thumbnailUrl: user?.avatarUrl,
        isVideo: true,
        isLive: true,
      });
    }
    case 'party': {
      const roomTitle = ref.partyRoomId
        ? getRoomSettings(ref.partyRoomId).roomName?.trim()
        : undefined;
      return {
        ref,
        typeLabel: 'Party Room',
        roomTitle: roomTitle || (ref.partyRoomId ? `Room #${ref.partyRoomId}` : undefined),
        caption: shareNote || roomTitle || 'Join karaoke party room',
        thumbnailUrl:
          'https://images.unsplash.com/photo-1516280440502-6c9ab45187fb?w=800&auto=format&fit=crop&q=60',
      };
    }
    case 'karaoke-track':
      return {
        ref,
        typeLabel: 'K-Star Cover',
        caption: shareNote || 'Tap to listen on K-Star',
        thumbnailUrl:
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=60',
        isVideo: true,
      };
    case 'karaoke-profile': {
      const user = resolveKaraokeProfileUser(ref, db.users, db.contextUserId);
      const handleFromUrl = ref.karaokeProfileUsername
        ? safeUsername(ref.karaokeProfileUsername)
        : undefined;
      const avatarUrl = resolveShareProfileAvatar(user, ref);
      return authorMeta(user, 'K-Star Profile', {
        caption: user?.bio?.trim() || shareNote || undefined,
        thumbnailUrl: avatarUrl,
        avatarUrl,
        profileSurface: 'karaoke',
        username: user?.username ?? handleFromUrl,
        displayName: user
          ? getProfileDisplayName(user)
          : handleFromUrl
            ? `@${handleFromUrl}`
            : undefined,
        userId: user?.id ?? ref.karaokeProfileUserId,
      });
    }
    default:
      return null;
  }
}

export function openShareLink(ref: ShareLinkRef, users: User[] = []): void {
  const findUser = (username?: string) => {
    if (!username) return undefined;
    return users.find((u) => safeUsername(u.username) === safeUsername(username));
  };

  switch (ref.kind) {
    case 'post':
      window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'home' } }));
      break;
    case 'reel':
      window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'reels' } }));
      break;
    case 'story': {
      const storyUser = findUser(ref.storyUsername);
      if (storyUser) {
        window.dispatchEvent(
          new CustomEvent('open-story', { detail: { userId: storyUser.id } }),
        );
      }
      break;
    }
    case 'profile': {
      const user = findUser(ref.profileUsername);
      if (user) {
        window.dispatchEvent(
          new CustomEvent('show-profile-preview', { detail: { userId: user.id } }),
        );
      }
      break;
    }
    case 'live':
      window.dispatchEvent(
        new CustomEvent('navigate', {
          detail: { tab: 'live', ...(ref.liveUserId ? { userId: ref.liveUserId } : {}) },
        }),
      );
      break;
    case 'party':
      window.dispatchEvent(
        new CustomEvent('navigate', {
          detail: { tab: 'karaoke' },
        }),
      );
      if (ref.partyRoomId) {
        window.dispatchEvent(
          new CustomEvent('karaoke-room-open', { detail: { roomId: ref.partyRoomId } }),
        );
      }
      break;
    case 'karaoke-track':
    case 'karaoke-profile':
      if (ref.kind === 'karaoke-profile') {
        openKaraokeProfileFromShare(ref, users);
        return;
      }
      window.dispatchEvent(
        new CustomEvent('navigate', { detail: { tab: 'karaoke' } }),
      );
      if (ref.karaokeTrackId) {
        window.dispatchEvent(
          new CustomEvent('karaoke-track-open', {
            detail: {
              trackId: ref.karaokeTrackId,
              recordingId: ref.karaokeRecordingId ?? null,
            },
          }),
        );
      }
      break;
    default:
      break;
  }
}
