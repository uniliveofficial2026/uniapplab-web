import React from 'react';
import { Gift, Mic2, Radio, ShieldAlert } from 'lucide-react';
import { AppNativeVideo } from '../common/AppNativeVideo';
import { AdminRoomLiveEmbed } from './AdminRoomLiveEmbed';
import { AdminUserProgressCard } from './AdminUserProgressCard';
import { handleAvatarError } from '../../lib/utils';
import { safeAvatarUrl } from '../../lib/safe';
import { getRoomExpProgress } from '../../smule-rooms/utils/roomExp';
import type { Post, Reel, User } from '../../types';

export type AdminPreviewSection =
  | 'overview'
  | 'users'
  | 'posts'
  | 'reels'
  | 'comments'
  | 'messages'
  | 'live'
  | 'party'
  | 'gifts'
  | 'wallet'
  | 'dating'
  | 'karaoke'
  | 'moderation'
  | 'platform'
  | 'integrations'
  | 'auth'
  | 'user';

export type AdminPreviewModel = {
  kind: string;
  title: string;
  subtitle?: string;
  caption?: string;
  body?: string;
  image?: string | null;
  video?: string | null;
  avatarUrl?: string | null;
  badges?: string[];
  meta?: Array<{ label: string; value: string }>;
  reported?: boolean;
  mediaItems?: Array<{ url: string; type: 'image' | 'video' | 'audio' }>;
  embed?: {
    roomId?: string | null;
    roomMode?: string | null;
    hostUserId?: string | null;
    streamId?: string | null;
    posterUrl?: string | null;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function payloadMedia(payload: Record<string, unknown> | undefined) {
  if (!payload) return { image: null as string | null, video: null as string | null, items: [] as AdminPreviewModel['mediaItems'] };
  const image =
    (typeof payload.imageUrl === 'string' && payload.imageUrl) ||
    (typeof payload.thumbUrl === 'string' && payload.thumbUrl) ||
    null;
  const video = typeof payload.videoUrl === 'string' ? payload.videoUrl : null;
  const list = Array.isArray(payload.mediaList) ? payload.mediaList : [];
  const items: NonNullable<AdminPreviewModel['mediaItems']> = [];
  for (const entry of list) {
    const row = asRecord(entry);
    const url = typeof row.url === 'string' ? row.url : '';
    const type = row.type === 'video' || row.type === 'audio' || row.type === 'image' ? row.type : 'image';
    if (url) items.push({ url, type });
  }
  return {
    image: image || items.find((m) => m.type === 'image')?.url || null,
    video: video || items.find((m) => m.type === 'video')?.url || null,
    items,
  };
}

function postPreview(
  post: Post | Reel,
  kind: 'post' | 'reel',
  authorFollowers?: number,
): AdminPreviewModel {
  const media = payloadMedia(post as unknown as Record<string, unknown>);
  return {
    kind,
    title: post.caption?.slice(0, 120) || `${kind} ${post.id}`,
    subtitle: `@${post.user?.username ?? 'user'}`,
    caption: post.caption,
    image: media.image || post.imageUrl || undefined,
    video: media.video || post.videoUrl || undefined,
    avatarUrl: post.user?.avatarUrl,
    badges: [
      ...(post.isReported ? ['Reported'] : []),
      ...(post.isArchived ? ['Archived'] : []),
      ...(kind === 'reel' ? ['Reel'] : ['Post']),
    ],
    reported: Boolean(post.isReported),
    mediaItems: media.items,
    meta: [
      { label: 'Likes', value: String(post.likes ?? 0) },
      { label: 'Comments', value: String(post.comments ?? 0) },
      ...(authorFollowers != null ? [{ label: 'Followers', value: String(authorFollowers) }] : []),
    ],
  };
}

export function buildAdminPreview(input: {
  raw: Record<string, unknown>;
  section: AdminPreviewSection;
  posts?: Post[];
  reels?: Reel[];
  users?: User[];
  getFollowerCount?: (userId: string) => number;
  getFollowingCount?: (userId: string) => number;
  enrichUserMeta?: (userId: string) => Array<{ label: string; value: string }>;
}): AdminPreviewModel {
  const { raw, section, posts = [], reels = [], users = [], getFollowerCount, getFollowingCount, enrichUserMeta } = input;
  const payload = asRecord(raw.payload);
  const media = payloadMedia(Object.keys(payload).length ? payload : raw);

  if (section === 'comments') {
    const targetId = String(raw.target_id ?? raw.targetId ?? raw.postId ?? '');
    const parent =
      posts.find((p) => p.id === targetId) ??
      reels.find((r) => r.id === targetId);
    const parentPreview = parent ? postPreview(parent, reels.some((r) => r.id === targetId) ? 'reel' : 'post') : null;
    return {
      kind: 'comment',
      title: String(raw.body ?? raw.text ?? 'Comment'),
      subtitle: String(raw.target_kind ?? 'post') + (targetId ? ` · ${targetId.slice(0, 10)}` : ''),
      body: String(raw.body ?? raw.text ?? ''),
      avatarUrl: users.find((u) => u.id === raw.author_id)?.avatarUrl,
      image: parentPreview?.image,
      video: parentPreview?.video,
      badges: ['Comment', ...(parentPreview?.reported ? ['On reported content'] : [])],
      meta: parentPreview
        ? [{ label: 'On', value: parentPreview.title.slice(0, 48) }]
        : targetId
          ? [{ label: 'Target', value: targetId }]
          : undefined,
    };
  }

  if (section === 'messages') {
    const text = String(raw.body ?? raw.text ?? raw.content ?? '');
    const msgMedia = Array.isArray(raw.media) ? raw.media : Array.isArray(raw.attachments) ? raw.attachments : [];
    const items: NonNullable<AdminPreviewModel['mediaItems']> = [];
    for (const entry of msgMedia) {
      const row = asRecord(entry);
      const url = typeof row.url === 'string' ? row.url : typeof row.src === 'string' ? row.src : '';
      const type = row.type === 'video' ? 'video' : row.type === 'audio' ? 'audio' : 'image';
      if (url) items.push({ url, type });
    }
    const sender = users.find((u) => u.id === raw.sender_id || u.id === raw.senderId || u.id === raw.from);
    return {
      kind: 'message',
      title: text.slice(0, 120) || 'Chat message',
      subtitle: sender ? `@${sender.username}` : String(raw.sender_id ?? raw.senderId ?? raw.chatId ?? ''),
      body: text,
      avatarUrl: sender?.avatarUrl,
      image: items.find((m) => m.type === 'image')?.url,
      video: items.find((m) => m.type === 'video')?.url,
      badges: ['Chat'],
      mediaItems: items,
      meta: raw.chatId ? [{ label: 'Thread', value: String(raw.chatId).slice(0, 12) }] : undefined,
    };
  }

  if (section === 'live') {
    const hostId = String(raw.user_id ?? raw.userId ?? raw.id ?? '');
    const host = users.find((u) => u.id === hostId);
    const roomId =
      typeof raw.party_room_id === 'string'
        ? raw.party_room_id
        : typeof raw.room_id === 'string'
          ? raw.room_id
          : null;
    const userMeta = enrichUserMeta?.(hostId) ?? [];
    return {
      kind: 'stream',
      title: String(raw.title ?? `${host?.displayName ?? 'Host'} live`),
      subtitle: host ? `@${host.username}` : hostId,
      avatarUrl: host?.avatarUrl,
      image: host?.avatarUrl,
      badges: [String(raw.status ?? 'live') === 'live' ? 'LIVE' : 'Stream'].filter(Boolean),
      meta: [
        ...userMeta,
        { label: 'Started', value: String(raw.started_at ?? '—') },
        { label: 'Status', value: String(raw.status ?? 'unknown') },
        ...(getFollowerCount && hostId ? [{ label: 'Followers', value: String(getFollowerCount(hostId)) }] : []),
        ...(getFollowingCount && hostId ? [{ label: 'Following', value: String(getFollowingCount(hostId)) }] : []),
      ],
      embed: {
        roomId,
        roomMode: String(raw.room_mode ?? 'Solo-Live'),
        hostUserId: hostId,
        streamId: String(raw.id ?? ''),
        posterUrl: host?.avatarUrl ?? null,
      },
    };
  }

  if (section === 'party' || section === 'karaoke') {
    const ownerId = String(raw.owner_id ?? '');
    const owner = users.find((u) => u.id === ownerId);
    const roomId = String(raw.id ?? '');
    const roomExp = roomId ? getRoomExpProgress(roomId) : null;
    const userMeta = enrichUserMeta?.(ownerId) ?? [];
    return {
      kind: 'party',
      title: String(raw.room_name ?? raw.roomName ?? 'Party room'),
      subtitle: owner ? `@${owner.username}` : ownerId,
      caption: String(raw.room_mode ?? raw.roomMode ?? ''),
      image: typeof raw.cover_url === 'string' ? raw.cover_url : typeof raw.coverUrl === 'string' ? raw.coverUrl : owner?.avatarUrl,
      avatarUrl: owner?.avatarUrl,
      badges: [
        String(raw.status ?? 'active'),
        String(raw.room_mode ?? raw.roomMode ?? 'Party'),
        raw.participant_count != null ? `${raw.participant_count} guests` : '',
      ].filter(Boolean),
      meta: [
        ...userMeta,
        { label: 'Room ID', value: roomId.slice(0, 16) },
        { label: 'Privacy', value: String(raw.privacy ?? '—') },
        ...(roomExp ? [{ label: 'Room Lv', value: String(roomExp.level) }] : []),
        ...(getFollowerCount && ownerId ? [{ label: 'Owner followers', value: String(getFollowerCount(ownerId)) }] : []),
      ],
      embed: {
        roomId,
        roomMode: String(raw.room_mode ?? raw.roomMode ?? 'Party'),
        hostUserId: ownerId,
        posterUrl: owner?.avatarUrl ?? null,
      },
    };
  }

  if (section === 'gifts') {
    const meta = asRecord(raw.meta);
    return {
      kind: 'gift',
      title: String(raw.body ?? meta.giftName ?? 'Gift sent'),
      subtitle: String(raw.sender_name ?? raw.sender_id ?? ''),
      body: String(raw.body ?? ''),
      image: typeof meta.imageUrl === 'string' ? meta.imageUrl : typeof meta.iconUrl === 'string' ? meta.iconUrl : null,
      badges: ['Gift', String(raw.kind ?? 'gift')],
      meta: [
        { label: 'Room', value: String(raw.room_id ?? '').slice(0, 16) },
        { label: 'Amount', value: String(meta.amount ?? meta.coins ?? meta.value ?? '—') },
      ],
    };
  }

  if (section === 'dating') {
    const user = users.find((u) => u.id === raw.userId) ?? (raw.user as User | undefined);
    return {
      kind: 'dating',
      title: user?.displayName ?? String(raw.userId ?? 'Profile'),
      subtitle: user ? `@${user.username}` : String(raw.reason ?? ''),
      body: String(raw.reason ?? ''),
      avatarUrl: user?.avatarUrl,
      badges: ['Dating report'],
      reported: true,
    };
  }

  if (section === 'auth' || section === 'user') {
    const user = raw as unknown as User;
    const userId = String(user.id ?? raw.id ?? '');
    const userMeta = enrichUserMeta?.(userId) ?? [];
    return {
      kind: 'user',
      title: user.displayName ?? user.username ?? (userId || 'User'),
      subtitle: `@${user.username ?? 'user'} · ${user.role ?? 'user'}`,
      avatarUrl: user.avatarUrl,
      badges: [
        user.bannedAt ? 'Banned' : user.mutedUntil && Number(user.mutedUntil) > Date.now() ? 'Muted' : 'Active',
        user.status === 'live' ? 'Live' : '',
      ].filter(Boolean),
      meta: [
        ...userMeta,
        ...(getFollowerCount && userId ? [{ label: 'Followers', value: String(getFollowerCount(userId)) }] : []),
        ...(getFollowingCount && userId ? [{ label: 'Following', value: String(getFollowingCount(userId)) }] : []),
      ],
      embed: user.status === 'live'
        ? {
            roomMode: 'Solo-Live',
            hostUserId: userId,
            posterUrl: user.avatarUrl ?? null,
          }
        : undefined,
    };
  }

  if (section === 'wallet') {
    return {
      kind: 'wallet',
      title: raw._kind === 'tx' ? String(raw.tx_type ?? 'Transaction') : 'Wallet balance',
      subtitle: String(raw.user_id ?? raw.from_user ?? raw.to_user ?? ''),
      body: raw._kind === 'tx' ? `${raw.amount} coins` : `${raw.balance} coins`,
      badges: [raw._kind === 'tx' ? 'Transaction' : 'Wallet'],
    };
  }

  if (section === 'moderation') {
    const embedded = raw.post as Post | undefined;
    const local =
      embedded ??
      posts.find((p) => p.id === raw.id) ??
      reels.find((r) => r.id === raw.id);
    if (local) {
      const isReel = reels.some((r) => r.id === local.id) || Boolean(local.videoUrl);
      return postPreview(local, isReel ? 'reel' : 'post', getFollowerCount?.(local.user?.id ?? ''));
    }
  }

  if (section === 'posts' || section === 'reels') {
    const local =
      posts.find((p) => p.id === raw.id) ??
      reels.find((r) => r.id === raw.id);
    if (local) {
      const isReel = reels.some((r) => r.id === local.id) || Boolean(local.videoUrl);
      return postPreview(local, isReel ? 'reel' : 'post', getFollowerCount?.(local.user?.id ?? ''));
    }

    const authorId = String(raw.author_id ?? raw.userId ?? '');
    const author = users.find((u) => u.id === authorId);
    return {
      kind: section === 'reels' ? 'reel' : 'post',
      title: String(payload.caption ?? raw.caption ?? raw.id ?? 'Content'),
      subtitle: author ? `@${author.username}` : authorId,
      caption: typeof payload.caption === 'string' ? payload.caption : typeof raw.caption === 'string' ? raw.caption : undefined,
      image: media.image,
      video: media.video,
      badges: [
        ...(raw.isReported ? ['Reported'] : []),
        ...(raw.is_archived || raw.isArchived ? ['Archived'] : []),
        section === 'reels' ? 'Reel' : 'Post',
      ],
      reported: Boolean(raw.isReported || raw.is_reported),
      mediaItems: media.items,
      meta: [
        { label: 'Likes', value: String(raw.likes ?? payload.likes ?? '—') },
        { label: 'Comments', value: String(raw.comments ?? payload.comments ?? '—') },
        ...(getFollowerCount && authorId ? [{ label: 'Followers', value: String(getFollowerCount(authorId)) }] : []),
      ],
    };
  }

  if (raw.imageUrl || raw.videoUrl || media.image || media.video) {
    const local =
      posts.find((p) => p.id === raw.id) ??
      reels.find((r) => r.id === raw.id);
    if (local) {
      const isReel = reels.some((r) => r.id === local.id) || Boolean(local.videoUrl);
      return postPreview(local, isReel ? 'reel' : 'post', getFollowerCount?.(local.user?.id ?? ''));
    }
  }

  return {
    kind: section,
    title: String(raw.caption ?? raw.body ?? raw.title ?? raw.room_name ?? raw.id ?? 'Record'),
    subtitle: String(raw.author_id ?? raw.sender_id ?? raw.user_id ?? ''),
    image: media.image,
    video: media.video,
    mediaItems: media.items,
  };
}

type AdminPreviewCardProps = {
  preview: AdminPreviewModel;
  compact?: boolean;
  fullViewport?: boolean;
  className?: string;
};

export function AdminPreviewCard({ preview, compact = false, fullViewport = false, className = '' }: AdminPreviewCardProps) {
  const mediaHeight = compact ? 'max-h-[140px]' : 'max-h-[220px] sm:max-h-[320px]';
  const showRoomEmbed =
    preview.embed &&
    (preview.kind === 'stream' || preview.kind === 'party' || (preview.kind === 'user' && preview.embed.hostUserId));
  const roomWatchLayout = Boolean(showRoomEmbed && fullViewport);

  if (roomWatchLayout) {
    return (
      <div className={`rounded-2xl border border-border overflow-hidden bg-black ${className}`}>
        <AdminRoomLiveEmbed
          roomId={preview.embed?.roomId}
          roomMode={preview.embed?.roomMode}
          hostUserId={preview.embed?.hostUserId}
          streamId={preview.embed?.streamId}
          posterUrl={preview.embed?.posterUrl}
          fullViewport
          title={preview.title}
        />
        <div className="px-3 py-2.5 border-t border-border/60 bg-secondary/10 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{preview.title}</div>
              {preview.subtitle ? <div className="text-xs text-muted-foreground truncate">{preview.subtitle}</div> : null}
            </div>
            {preview.badges?.includes('LIVE') ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full shrink-0">
                <Radio className="w-3 h-3" /> Live
              </span>
            ) : null}
          </div>
          {preview.meta && preview.meta.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {preview.meta.map((row) => (
                <span key={`${row.label}-${row.value}`} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">
                  {row.label}: {row.value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-border overflow-hidden bg-secondary/10 ${className}`}>
      {showRoomEmbed ? (
        <AdminRoomLiveEmbed
          roomId={preview.embed?.roomId}
          roomMode={preview.embed?.roomMode}
          hostUserId={preview.embed?.hostUserId}
          streamId={preview.embed?.streamId}
          posterUrl={preview.embed?.posterUrl}
          compact={compact}
          title={preview.title}
        />
      ) : null}

      {!showRoomEmbed && (preview.video || preview.image) && (
        <div className={`relative w-full bg-black/90 ${compact ? 'aspect-[16/10]' : 'aspect-video sm:aspect-[16/10]'}`}>
          {preview.video ? (
            <AppNativeVideo src={preview.video} className={`w-full h-full object-contain ${mediaHeight}`} />
          ) : preview.image ? (
            <img src={preview.image} alt="" className={`w-full h-full object-contain ${mediaHeight}`} onError={handleAvatarError} />
          ) : null}
          {preview.badges?.includes('LIVE') || preview.badges?.includes('live') ? (
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-black uppercase bg-red-600 text-white px-2 py-1 rounded-full">
              <Radio className="w-3 h-3" /> Live
            </span>
          ) : null}
          {preview.reported ? (
            <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-black uppercase bg-destructive text-destructive-foreground px-2 py-1 rounded-full">
              <ShieldAlert className="w-3 h-3" /> Reported
            </span>
          ) : null}
        </div>
      )}

      <div className="p-3 sm:p-4 space-y-2">
        <div className="flex items-start gap-3">
          {preview.avatarUrl && !preview.video && !preview.image ? (
            <img src={safeAvatarUrl(preview.avatarUrl)} alt="" className="w-12 h-12 rounded-full object-cover border border-border shrink-0" onError={handleAvatarError} />
          ) : preview.kind === 'gift' ? (
            <span className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
              <Gift className="w-6 h-6" />
            </span>
          ) : preview.kind === 'party' || preview.kind === 'stream' ? (
            <span className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
              {preview.kind === 'party' ? <Mic2 className="w-6 h-6" /> : <Radio className="w-6 h-6" />}
            </span>
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm line-clamp-2">{preview.title}</div>
            {preview.subtitle ? <div className="text-xs text-muted-foreground truncate mt-0.5">{preview.subtitle}</div> : null}
            {preview.caption && preview.caption !== preview.title ? (
              <p className="text-xs text-foreground/90 mt-2 line-clamp-3 whitespace-pre-wrap">{preview.caption}</p>
            ) : null}
          </div>
        </div>

        {preview.body && preview.kind === 'message' ? (
          <div className="rounded-2xl rounded-tl-md bg-primary/10 border border-primary/15 px-3 py-2 text-sm whitespace-pre-wrap break-words">
            {preview.body}
          </div>
        ) : preview.body && preview.kind === 'comment' ? (
          <div className="rounded-xl bg-background border border-border px-3 py-2 text-sm whitespace-pre-wrap break-words">
            {preview.body}
          </div>
        ) : null}

        {preview.mediaItems && preview.mediaItems.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
            {preview.mediaItems.map((item, idx) => (
              <div key={`${item.url}-${idx}`} className="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-border bg-black/20">
                {item.type === 'video' ? (
                  <AppNativeVideo src={item.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={item.url} alt="" className="w-full h-full object-cover" onError={handleAvatarError} />
                )}
              </div>
            ))}
          </div>
        ) : null}

        {preview.meta && preview.meta.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {preview.meta.map((row) => (
              <span key={`${row.label}-${row.value}`} className="text-[10px] font-bold px-2 py-1 rounded-full bg-background border border-border text-muted-foreground">
                {row.label}: {row.value}
              </span>
            ))}
          </div>
        ) : null}

        {preview.badges && preview.badges.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {preview.badges.filter((b) => b !== 'LIVE' && b !== 'live').map((badge) => (
              <span key={badge} className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AdminPreviewPanel({
  preview,
  raw,
  userInsights,
}: {
  preview: AdminPreviewModel;
  raw?: Record<string, unknown>;
  userInsights?: import('../../lib/adminUserInsights').AdminUserInsights;
}) {
  return (
    <div className="space-y-4">
      {!preview.embed || preview.kind === 'post' || preview.kind === 'reel' ? (
        <AdminPreviewCard preview={preview} />
      ) : (
        <>
          <AdminRoomLiveEmbed
            roomId={preview.embed.roomId}
            roomMode={preview.embed.roomMode}
            hostUserId={preview.embed.hostUserId}
            streamId={preview.embed.streamId}
            posterUrl={preview.embed.posterUrl}
            fullViewport
            title={preview.title}
          />
          <AdminPreviewCard preview={{ ...preview, embed: undefined, image: null, video: null }} compact />
        </>
      )}
      {userInsights ? (
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2 px-1">User progress & social</div>
          <AdminUserProgressCard insights={userInsights} />
        </div>
      ) : null}
      {raw ? (
        <details className="rounded-2xl border border-border bg-secondary/10 p-3 group">
          <summary className="text-[10px] font-black uppercase tracking-wider text-muted-foreground cursor-pointer list-none flex items-center justify-between">
            Raw record JSON
            <span className="text-[10px] normal-case font-bold text-primary group-open:hidden">Expand</span>
          </summary>
          <pre className="text-[11px] sm:text-xs whitespace-pre-wrap break-all font-mono text-foreground/90 max-h-[200px] overflow-y-auto mt-3">
            {JSON.stringify(raw, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
