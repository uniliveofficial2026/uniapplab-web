import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Music, Video, Users, Mic, User as UserIcon, Radio, Repeat2 } from 'lucide-react';
import type { User } from '../../types';
import { useDB } from '../../lib/useDB';
import { handleAvatarError, handleMediaError } from '../../lib/utils';
import { formatProfileHandle, shouldShowProfileHandle } from '../../lib/profileDisplay';
import { openUserProfileSurface } from '../../lib/profileSurface';
import { ChatInlineVideo } from './ChatInlineVideo';
import {
  openShareCardAuthor,
  parseShareLink,
  resolveShareCardMeta,
  sharePreviewLabel,
  type ShareCardMediaItem,
  type ShareKind,
} from '../../lib/shareLinks';

type SharedLinkCardProps = {
  text: string;
  isAuthor?: boolean;
  /** Message sender user id — used to resolve legacy self K-Star profile shares. */
  senderUserId?: string;
  onOpen: (mediaIndex?: number) => void;
};

function kindIcon(kind: ShareKind) {
  switch (kind) {
    case 'reel':
    case 'live':
      return Video;
    case 'party':
      return Users;
    case 'karaoke-track':
    case 'karaoke-profile':
      return Mic;
    case 'profile':
      return UserIcon;
    case 'story':
      return Radio;
    default:
      return Music;
  }
}

function isProfileKind(kind: ShareKind) {
  return kind === 'profile' || kind === 'karaoke-profile';
}

function clampMediaIndex(index: number, count: number) {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(index, count - 1));
}

export function SharedLinkCard({ text, isAuthor = false, senderUserId, onOpen }: SharedLinkCardProps) {
  const db = useDB();
  const shareRef = parseShareLink(text);
  const urlHasKaraokeIdentity =
    shareRef?.kind === 'karaoke-profile' &&
    Boolean(shareRef.karaokeProfileUsername || shareRef.karaokeProfileUserId);
  const contextUserId = urlHasKaraokeIdentity
    ? undefined
    : senderUserId ?? (isAuthor ? db.currentUser?.id : undefined);
  const meta = resolveShareCardMeta(text, {
    posts: db.posts,
    reels: db.reels,
    users: db.users,
    getProfileStorySegments: (userId) => db.getProfileStorySegments(userId),
    contextUserId,
  });

  const mediaCount = meta?.mediaCount ?? meta?.mediaItems?.length ?? 0;
  const [mediaIndex, setMediaIndex] = useState(() =>
    clampMediaIndex(meta?.initialMediaIndex ?? 0, mediaCount || 1),
  );

  useEffect(() => {
    setMediaIndex(clampMediaIndex(meta?.initialMediaIndex ?? 0, mediaCount || 1));
  }, [text, meta?.initialMediaIndex, mediaCount]);

  if (!meta) return null;

  const shellClass = isAuthor
    ? 'border-primary-foreground/20 bg-primary-foreground/10'
    : 'border-border/70 bg-background/60';

  const textPrimary = isAuthor ? 'text-primary-foreground' : 'text-foreground';
  const textMuted = isAuthor ? 'text-primary-foreground/75' : 'text-muted-foreground';
  const badgeClass = isAuthor
    ? 'bg-primary-foreground/15 text-primary-foreground border-primary-foreground/20'
    : 'bg-secondary text-foreground border-border';

  const previewLabel = sharePreviewLabel(text);
  const isRepostCard = Boolean(meta.isRepost && meta.contentAuthorUserId);
  const showShareNote =
    !isRepostCard &&
    meta.caption &&
    meta.caption !== previewLabel &&
    !meta.caption.startsWith('http');
  const showRepostNote =
    isRepostCard &&
    meta.repostCaption &&
    meta.repostCaption !== previewLabel &&
    !meta.repostCaption.startsWith('http');

  const userForHandle = meta.username
    ? ({ username: meta.username, displayName: meta.displayName ?? meta.username } as User)
    : null;
  const contentUserForHandle = meta.contentAuthorUsername
    ? ({
        username: meta.contentAuthorUsername,
        displayName: meta.contentAuthorDisplayName ?? meta.contentAuthorUsername,
      } as User)
    : null;

  const Icon = kindIcon(meta.ref.kind);
  const canOpenAuthor = Boolean(
    meta.userId ||
      meta.username ||
      meta.ref.karaokeProfileUserId ||
      meta.ref.karaokeProfileUsername,
  );
  const canOpenContentAuthor = Boolean(meta.contentAuthorUserId || meta.contentAuthorUsername);

  const openAuthor = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canOpenAuthor) {
      openShareCardAuthor(meta, db.users);
    }
  };

  const openContentAuthor = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (meta.contentAuthorUserId) {
      openUserProfileSurface({ userId: meta.contentAuthorUserId });
    }
  };

  const openContent = (e: React.MouseEvent, index = mediaIndex) => {
    e.stopPropagation();
    if (isProfileKind(meta.ref.kind)) {
      openShareCardAuthor(meta, db.users);
      return;
    }
    onOpen(index);
  };

  const profileAvatarUrl =
    meta.avatarUrl ||
    meta.thumbnailUrl ||
    (isProfileKind(meta.ref.kind)
      ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
          meta.userId ??
            meta.username ??
            meta.ref.karaokeProfileUsername ??
            meta.ref.profileUsername ??
            'profile',
        )}`
      : undefined);

  const headerRow = (
    <div className={`flex items-center gap-2.5 px-3 pt-3 ${textPrimary}`}>
      {profileAvatarUrl || meta.avatarUrl ? (
        <button
          type="button"
          onClick={openAuthor}
          disabled={!canOpenAuthor}
          className="w-9 h-9 rounded-full overflow-hidden border border-white/15 shrink-0 disabled:cursor-default"
        >
          <img
            src={profileAvatarUrl || meta.avatarUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={handleAvatarError}
          />
        </button>
      ) : (
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${badgeClass}`}>
          <Icon className="w-4 h-4" />
        </div>
      )}
      <button
        type="button"
        onClick={openAuthor}
        disabled={!canOpenAuthor}
        className="flex-1 min-w-0 text-left disabled:cursor-default"
      >
        {meta.displayName || meta.username ? (
          <p className="text-[13px] font-bold truncate leading-tight hover:underline">
            {meta.displayName || `@${meta.username}`}
          </p>
        ) : meta.roomTitle ? (
          <p className="text-[13px] font-bold truncate leading-tight">{meta.roomTitle}</p>
        ) : null}
        {userForHandle && shouldShowProfileHandle(userForHandle) ? (
          <p className={`text-[11px] truncate ${textMuted}`}>{formatProfileHandle(userForHandle)}</p>
        ) : null}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {isRepostCard ? (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide ${textMuted}`}>
              <Repeat2 className="w-3 h-3" />
              Reposted
            </span>
          ) : (
            <span className={`text-[10px] font-bold uppercase tracking-wide ${textMuted}`}>
              {meta.typeLabel}
            </span>
          )}
          {meta.isLive ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          ) : null}
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => openContent(e)}
        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border shrink-0 ${badgeClass}`}
      >
        View
      </button>
    </div>
  );

  return (
    <div
      data-message-interactive="true"
      className={`flex flex-col gap-2 w-full min-w-[220px] max-w-[min(100%,320px)] rounded-2xl border overflow-hidden ${shellClass}`}
    >
      {headerRow}

      {showRepostNote ? (
        <button
          type="button"
          onClick={(e) => openContent(e)}
          className={`px-3 text-[13px] leading-snug font-medium line-clamp-3 text-left w-full ${textPrimary}`}
        >
          {meta.repostCaption}
        </button>
      ) : null}

      {showShareNote ? (
        <button
          type="button"
          onClick={(e) => openContent(e)}
          className={`px-3 text-[13px] leading-snug font-medium line-clamp-3 text-left w-full ${textPrimary}`}
        >
          {meta.caption}
        </button>
      ) : null}

      {isRepostCard ? (
        <div
          className={`mx-3 mb-3 rounded-xl border overflow-hidden ${
            isAuthor
              ? 'border-primary-foreground/15 bg-black/10'
              : 'border-border/80 bg-background/80'
          }`}
        >
          <div
            className={`flex items-center gap-2 px-2.5 py-2 border-b ${
              isAuthor ? 'border-primary-foreground/10' : 'border-border/60'
            }`}
          >
            {meta.contentAuthorAvatarUrl ? (
              <button
                type="button"
                onClick={openContentAuthor}
                disabled={!canOpenContentAuthor}
                className="w-7 h-7 rounded-full overflow-hidden border border-white/15 shrink-0 disabled:cursor-default"
              >
                <img
                  src={meta.contentAuthorAvatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={handleAvatarError}
                />
              </button>
            ) : null}
            <button
              type="button"
              onClick={openContentAuthor}
              disabled={!canOpenContentAuthor}
              className="flex-1 min-w-0 text-left disabled:cursor-default"
            >
              {meta.contentAuthorDisplayName || meta.contentAuthorUsername ? (
                <p className={`text-[12px] font-bold truncate leading-tight hover:underline ${textPrimary}`}>
                  {meta.contentAuthorDisplayName || `@${meta.contentAuthorUsername}`}
                </p>
              ) : null}
              {contentUserForHandle && shouldShowProfileHandle(contentUserForHandle) ? (
                <p className={`text-[10px] truncate ${textMuted}`}>
                  {formatProfileHandle(contentUserForHandle)}
                </p>
              ) : null}
            </button>
          </div>
          {meta.contentCaption ? (
            <p className={`px-2.5 pt-2 text-[12px] leading-snug font-medium line-clamp-2 ${textPrimary}`}>
              {meta.contentCaption}
            </p>
          ) : null}
          <ShareLinkMedia
            meta={meta}
            isAuthor={isAuthor}
            mediaIndex={mediaIndex}
            onMediaIndexChange={setMediaIndex}
            onOpen={openContent}
            embedded
          />
        </div>
      ) : (
        <ShareLinkMedia
          meta={meta}
          isAuthor={isAuthor}
          mediaIndex={mediaIndex}
          onMediaIndexChange={setMediaIndex}
          onOpen={openContent}
        />
      )}
    </div>
  );
}

function ShareLinkMedia({
  meta,
  isAuthor,
  mediaIndex,
  onMediaIndexChange,
  onOpen,
  embedded = false,
}: {
  meta: NonNullable<ReturnType<typeof resolveShareCardMeta>>;
  isAuthor: boolean;
  mediaIndex: number;
  onMediaIndexChange: (index: number) => void;
  onOpen: (e: React.MouseEvent, index?: number) => void;
  embedded?: boolean;
}) {
  const ref = meta.ref;
  const mediaItems = meta.mediaItems ?? [];
  const mediaCount = meta.mediaCount ?? mediaItems.length;
  const primaryItem = mediaItems[mediaIndex] ?? mediaItems[0];
  const hasCarousel = mediaCount > 1;
  const outerSpacing = embedded ? 'mx-0 mb-0' : 'mx-3 mb-3';
  const outerWidth = embedded ? 'w-full' : 'w-[calc(100%-1.5rem)]';

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMediaIndexChange(clampMediaIndex(mediaIndex - 1, mediaCount));
  };

  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMediaIndexChange(clampMediaIndex(mediaIndex + 1, mediaCount));
  };

  if (isProfileKind(ref.kind)) {
    const thumb =
      meta.thumbnailUrl ||
      meta.avatarUrl ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
        meta.userId ??
          meta.username ??
          ref.karaokeProfileUsername ??
          ref.profileUsername ??
          'profile',
      )}`;
    const isVectorAvatar = thumb.includes('dicebear.com');
    return (
      <button
        type="button"
        onClick={(e) => onOpen(e)}
        className={`relative ${outerSpacing} rounded-xl overflow-hidden aspect-[4/3] bg-black/20 ${outerWidth}`}
      >
        <img
          src={thumb}
          alt=""
          className={`w-full h-full ${isVectorAvatar ? 'object-contain p-6 bg-zinc-900/40' : 'object-cover'}`}
          onError={handleAvatarError}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
          <img
            src={thumb}
            alt=""
            className="w-8 h-8 rounded-full border-2 border-white/80 object-cover bg-zinc-800"
            onError={handleAvatarError}
          />
          <span className="text-[11px] font-bold text-white drop-shadow-md truncate">
            {meta.displayName || meta.username || meta.typeLabel}
          </span>
        </div>
      </button>
    );
  }

  if (ref.kind === 'party') {
    return (
      <button
        type="button"
        onClick={(e) => onOpen(e)}
        className={`relative ${outerSpacing} rounded-xl overflow-hidden aspect-video bg-black/30 ${outerWidth}`}
      >
        <img
          src={meta.thumbnailUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={handleMediaError}
        />
        <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center gap-1.5 text-white">
          <Users className="w-7 h-7" />
          <span className="text-[11px] font-bold uppercase tracking-wider px-2 text-center">
            {meta.roomTitle || 'Party Room'}
          </span>
        </div>
      </button>
    );
  }

  if (primaryItem?.isAudio || meta.audioLabel) {
    const cover = primaryItem?.posterUrl || meta.thumbnailUrl;
    return (
      <button
        type="button"
        onClick={(e) => onOpen(e, mediaIndex)}
        className={embedded ? 'px-2.5 pb-2.5 w-full text-left' : 'px-3 pb-3 w-full text-left'}
      >
        <div className="rounded-xl overflow-hidden bg-black/20 aspect-[16/10] relative flex items-center justify-center">
          {cover ? (
            <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" onError={handleMediaError} />
          ) : null}
          <div className="relative z-10 flex flex-col items-center gap-2 text-white">
            <div className="w-12 h-12 rounded-full bg-black/50 border border-white/20 flex items-center justify-center">
              <Music className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider">Audio</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className={embedded ? 'relative px-2.5 pb-2.5' : `relative ${outerSpacing}`}>
      <button
        type="button"
        onClick={(e) => onOpen(e, mediaIndex)}
        className="relative rounded-xl overflow-hidden aspect-video bg-black/30 border border-black/10 w-full"
      >
        <MediaThumb item={primaryItem} meta={meta} />
        {hasCarousel ? (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/65 text-white text-[10px] font-bold border border-white/15">
            {mediaIndex + 1}/{mediaCount}
          </div>
        ) : null}
        {ref.kind === 'story' ? (
          <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white bg-black/45 px-2.5 py-1 rounded-full">
              View Story
            </span>
          </div>
        ) : null}
        {ref.kind === 'reel' && !primaryItem?.isVideo ? (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/25">
            <Video className="w-8 h-8 text-white/90" />
          </div>
        ) : null}
        {meta.isLive ? (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        ) : null}
      </button>

      {hasCarousel ? (
        <>
          <button
            type="button"
            onClick={goPrev}
            disabled={mediaIndex <= 0}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center border border-white/20 disabled:opacity-30"
            aria-label="Previous media"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={mediaIndex >= mediaCount - 1}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center border border-white/20 disabled:opacity-30"
            aria-label="Next media"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="flex justify-center gap-1 mt-1.5">
            {Array.from({ length: mediaCount }, (_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMediaIndexChange(idx);
                }}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  idx === mediaIndex
                    ? isAuthor
                      ? 'bg-primary-foreground'
                      : 'bg-foreground'
                    : isAuthor
                      ? 'bg-primary-foreground/35'
                      : 'bg-muted-foreground/40'
                }`}
                aria-label={`Go to item ${idx + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MediaThumb({
  item,
  meta,
}: {
  item?: ShareCardMediaItem;
  meta: NonNullable<ReturnType<typeof resolveShareCardMeta>>;
}) {
  const ref = meta.ref;
  const url = item?.url || meta.thumbnailUrl;
  const poster = item?.posterUrl || meta.thumbnailUrl;

  if (item?.isVideo && url) {
    return <ChatInlineVideo src={url} poster={poster} onError={handleMediaError} />;
  }

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="w-full h-full object-cover"
        onError={handleMediaError}
      />
    );
  }

  const Icon = kindIcon(ref.kind);
  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900/80">
      <Icon className="w-8 h-8 text-white/70" />
    </div>
  );
}

export function sharedLinkMessageLabel(text: string): boolean {
  return parseShareLink(text) !== null;
}
