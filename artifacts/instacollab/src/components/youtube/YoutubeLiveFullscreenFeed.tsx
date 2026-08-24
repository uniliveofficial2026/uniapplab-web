import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import YouTube, { type YouTubeEvent } from 'react-youtube';
import {
  AlignLeft,
  Ban,
  Captions,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CircleUserRound,
  Crown,
  Flag,
  Gift,
  Heart,
  LineChart,
  MessageCircle,
  MoreVertical,
  SendHorizontal,
  Settings2,
  Share2,
  SlidersHorizontal,
  Smile,
  ThumbsUp,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useAppPortalRoot } from '../../lib/appPortalRoot';
import {
  applyYoutubePlayerVolume,
  stabilizeYoutubePlayerVolume,
  youtubeIframePlayerVars,
} from '../../lib/youtubePlayerVolume';
import {
  buildYoutubeWatchUrl,
  fetchYoutubeLiveChat,
  fetchYoutubeLiveDetails,
  sendYoutubeLiveChat,
  type YoutubeLiveChatMessage,
  type YoutubeLiveDetails,
  type YoutubeVideoSummary,
} from '../../services/youtube';

type YoutubeLiveFullscreenFeedProps = {
  videos: YoutubeVideoSummary[];
  index: number;
  onIndexChange: (nextIndex: number) => void;
  onClose: () => void;
  onNeedMore?: () => void;
  loadingMore?: boolean;
};

type ChatFilterMode = 'top' | 'all';

/** YouTube vertical live (mobile app) chrome — matched to official Live screenshots. */
const YT = {
  font: 'Roboto, "YouTube Noto", Arial, Helvetica, sans-serif',
  hostPill: '#f9d649',
  hostText: '#0f0f0f',
  crown: '#8b5cf6',
  heart: '#ff0033',
  live: '#ff0000',
  sheet: '#212121',
  sheetRaised: '#2a2a2a',
  muted: '#aaaaaa',
} as const;

function formatCount(count?: number): string {
  if (count == null || !Number.isFinite(count) || count < 0) return '0';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function toHandle(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '@viewer';
  if (trimmed.startsWith('@')) return trimmed;
  return `@${trimmed.replace(/\s+/g, '')}`;
}

function avatarLetter(name: string): string {
  const handle = toHandle(name).replace(/^@/, '');
  return (handle[0] || 'Y').toUpperCase();
}

async function shareLiveWatch(url: string, title: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, url, text: title });
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

function OverlayChatRow({
  message,
  giftRank,
}: {
  message: YoutubeLiveChatMessage;
  giftRank?: number;
}) {
  const handle = toHandle(message.author.displayName);
  const isHost = message.author.isOwner;
  const isGift = message.kind === 'superChat' || message.kind === 'superSticker';

  return (
    <div className="flex items-start gap-2 pr-2">
      {message.author.profileImageUrl ? (
        <img
          src={message.author.profileImageUrl}
          alt=""
          className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: isHost ? '#eab308' : '#3f3f46' }}
        >
          {avatarLetter(message.author.displayName)}
        </span>
      )}
      <p
        className="min-w-0 flex-1 text-[13px] leading-[1.35] text-white"
        style={{
          fontFamily: YT.font,
          textShadow: '0 1px 2px rgba(0,0,0,0.65)',
        }}
      >
        {isHost ? (
          <span
            className="mr-1 inline-block rounded-full px-1.5 py-[1px] text-[12px] font-bold"
            style={{ background: YT.hostPill, color: YT.hostText }}
          >
            {handle}
          </span>
        ) : (
          <span className="mr-1 font-semibold text-white/95">{handle}</span>
        )}
        {giftRank != null && giftRank <= 3 ? (
          <span
            className="mr-1 inline-flex items-center gap-0.5 rounded-full px-1 py-[1px] text-[10px] font-bold text-white"
            style={{ background: YT.crown }}
          >
            <Crown size={9} fill="currentColor" />#{giftRank}
          </span>
        ) : null}
        {isGift && message.amountDisplayString ? (
          <span className="mr-1 rounded bg-amber-500/90 px-1 text-[11px] font-bold text-black">
            {message.amountDisplayString}
          </span>
        ) : null}
        <span className="font-normal text-white">
          {message.message || message.stickerAlt || (isGift ? 'Super Chat' : '')}
        </span>
      </p>
    </div>
  );
}

type LiveMoreMenuProps = {
  open: boolean;
  onClose: () => void;
  video: YoutubeVideoSummary;
  details: YoutubeLiveDetails | null;
  likeCount?: number;
  liked: boolean;
  liveChatOn: boolean;
  chatFilter: ChatFilterMode;
  qualityLevels: string[];
  currentQuality: string | null;
  onToggleLiked: () => void;
  onToggleLiveChat: () => void;
  onChatFilterChange: (mode: ChatFilterMode) => void;
  onDontRecommend: () => void;
  onSetQuality: (quality: string) => void;
};

type MorePanel =
  | 'root'
  | 'description'
  | 'channel'
  | 'quality'
  | 'stats'
  | 'filter'
  | 'report'
  | 'help';

const REPORT_REASONS = [
  'Spam or misleading',
  'Hate speech',
  'Harassment or bullying',
  'Sexual content',
  'Violent or dangerous content',
  'Other',
] as const;

/** Official YouTube Live ⋮ bottom sheet — all actions stay in-app, fed by YouTube APIs/player. */
function LiveMoreMenu({
  open,
  onClose,
  video,
  details,
  likeCount,
  liked,
  liveChatOn,
  chatFilter,
  qualityLevels,
  currentQuality,
  onToggleLiked,
  onToggleLiveChat,
  onChatFilterChange,
  onDontRecommend,
  onSetQuality,
}: LiveMoreMenuProps) {
  const [panel, setPanel] = useState<MorePanel>('root');
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportDone, setReportDone] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [following, setFollowing] = useState(false);
  const watchUrl = details?.watchUrl || buildYoutubeWatchUrl(video.videoId);
  const title = details?.title || video.title;
  const channelTitle = details?.channelTitle || video.channelTitle;
  const channelHandle = toHandle(details?.customUrl || channelTitle);
  const description = (details?.description || '').trim();
  const channelDescription = (details?.channelDescription || '').trim();
  const displayLikes = Math.max(0, (likeCount ?? 0) + (liked ? 1 : 0));

  useEffect(() => {
    if (open) {
      setPanel('root');
      setReportReason(null);
      setReportDone(false);
      setShareCopied(false);
    }
  }, [open]);

  if (!open) return null;

  const back = (
    <button type="button" onClick={() => setPanel('root')} className="p-1 text-white" aria-label="Back">
      <ChevronLeft size={22} />
    </button>
  );

  return (
    <div className="absolute inset-0 z-[60] flex flex-col justify-end" style={{ fontFamily: YT.font }}>
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Dismiss menu"
        onClick={onClose}
      />
      <div
        className="relative max-h-[78dvh] overflow-y-auto rounded-t-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl"
        style={{ background: YT.sheet }}
        role="dialog"
        aria-modal="true"
        aria-label="Live options"
      >
        <div className="flex justify-center pb-1 pt-2.5">
          <span className="h-1 w-9 rounded-full bg-white/25" />
        </div>

        {panel === 'root' ? (
          <>
            <div className="grid grid-cols-3 gap-2 px-3 pb-2 pt-1">
              <button
                type="button"
                onClick={() => onToggleLiked()}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-3.5 text-white"
                style={{ background: YT.sheetRaised }}
              >
                <ThumbsUp size={22} strokeWidth={1.75} fill={liked ? 'currentColor' : 'none'} />
                <span className="text-[12px] font-medium">{formatCount(displayLikes)}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    const ok = await shareLiveWatch(watchUrl, title);
                    if (ok) {
                      setShareCopied(true);
                      window.setTimeout(() => setShareCopied(false), 1600);
                    }
                  })();
                }}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-3.5 text-white"
                style={{ background: YT.sheetRaised }}
              >
                <Share2 size={22} strokeWidth={1.75} />
                <span className="text-[12px] font-medium">{shareCopied ? 'Copied' : 'Share'}</span>
              </button>
              <button
                type="button"
                onClick={() => setPanel('report')}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-3.5 text-white"
                style={{ background: YT.sheetRaised }}
              >
                <Flag size={22} strokeWidth={1.75} />
                <span className="text-[12px] font-medium">Report</span>
              </button>
            </div>

            <div className="px-1 pb-2">
              <button
                type="button"
                onClick={() => setPanel('description')}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-white"
              >
                <AlignLeft size={22} strokeWidth={1.75} />
                <span className="text-[15px]">Description</span>
              </button>
              <button
                type="button"
                onClick={() => setPanel('channel')}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-white"
              >
                <CircleUserRound size={22} strokeWidth={1.75} />
                <span className="text-[15px]">View channel</span>
              </button>
              <div className="flex w-full items-center gap-4 px-4 py-3.5 text-white/45">
                <Captions size={22} strokeWidth={1.75} />
                <span className="flex-1 text-[15px] text-white">Captions</span>
                <span className="text-[13px]" style={{ color: YT.muted }}>
                  Unavailable
                </span>
                <ChevronRight size={18} style={{ color: YT.muted }} />
              </div>
              <button
                type="button"
                onClick={() => setPanel('quality')}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-white"
              >
                <Settings2 size={22} strokeWidth={1.75} />
                <span className="flex-1 text-[15px]">Quality</span>
                <span className="text-[13px]" style={{ color: YT.muted }}>
                  {currentQuality || 'Auto'}
                </span>
                <ChevronRight size={18} style={{ color: YT.muted }} />
              </button>
              <button
                type="button"
                onClick={() => setPanel('stats')}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-white"
              >
                <LineChart size={22} strokeWidth={1.75} />
                <span className="text-[15px]">Stats for nerds</span>
              </button>
              <div className="flex w-full items-center gap-4 px-4 py-3.5 text-white">
                <MessageCircle size={22} strokeWidth={1.75} />
                <span className="flex-1 text-[15px]">Live chat</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={liveChatOn}
                  onClick={onToggleLiveChat}
                  className={`relative h-6 w-10 rounded-full transition-colors ${
                    liveChatOn ? 'bg-white' : 'bg-white/25'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full transition-transform ${
                      liveChatOn ? 'left-4 bg-black' : 'left-0.5 bg-white'
                    }`}
                  />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPanel('filter')}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-white"
              >
                <SlidersHorizontal size={22} strokeWidth={1.75} />
                <span className="flex-1 text-[15px]">Chat filter</span>
                <span className="text-[13px]" style={{ color: YT.muted }}>
                  {chatFilter === 'top' ? 'Top messages' : 'All messages'}
                </span>
                <ChevronRight size={18} style={{ color: YT.muted }} />
              </button>
              <button
                type="button"
                onClick={() => {
                  onDontRecommend();
                  onClose();
                }}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-white"
              >
                <Ban size={22} strokeWidth={1.75} />
                <span className="text-[15px]">Don&apos;t recommend this channel</span>
              </button>
              <button
                type="button"
                onClick={() => setPanel('help')}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-white"
              >
                <CircleHelp size={22} strokeWidth={1.75} />
                <span className="text-[15px]">Help &amp; feedback</span>
              </button>
            </div>
          </>
        ) : null}

        {panel === 'description' ? (
          <div className="px-4 pb-4">
            <div className="mb-3 flex items-center gap-2">
              {back}
              <p className="text-[16px] font-medium text-white">Description</p>
            </div>
            <p className="text-[15px] font-semibold text-white">{title}</p>
            <p className="mt-1 text-[13px]" style={{ color: YT.muted }}>
              {channelTitle}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-white/85">
              {description || 'No description from YouTube for this live stream.'}
            </p>
          </div>
        ) : null}

        {panel === 'channel' ? (
          <div className="px-4 pb-4">
            <div className="mb-3 flex items-center gap-2">
              {back}
              <p className="text-[16px] font-medium text-white">Channel</p>
            </div>
            <div className="flex items-center gap-3">
              {details?.channelThumbnailUrl ? (
                <img
                  src={details.channelThumbnailUrl}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-700 text-lg font-bold text-white">
                  {avatarLetter(channelHandle)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold text-white">{channelHandle}</p>
                <p className="text-[13px]" style={{ color: YT.muted }}>
                  {formatCount(details?.subscriberCount)} subscribers
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFollowing((prev) => !prev)}
                className="shrink-0 rounded-full px-4 py-2 text-[13px] font-medium"
                style={{
                  background: following ? YT.sheetRaised : YT.live,
                  color: '#fff',
                }}
              >
                {following ? 'Following' : 'Subscribe'}
              </button>
            </div>
            <p className="mt-4 line-clamp-8 whitespace-pre-wrap text-[13px] leading-relaxed text-white/80">
              {channelDescription || 'Channel details synced from YouTube.'}
            </p>
          </div>
        ) : null}

        {panel === 'quality' ? (
          <div className="px-2 pb-4">
            <div className="mb-2 flex items-center gap-2 px-2">
              {back}
              <p className="text-[16px] font-medium text-white">Quality</p>
            </div>
            <p className="px-4 pb-2 text-[12px]" style={{ color: YT.muted }}>
              Controls the in-app YouTube player stream (same feed as youtube.com).
            </p>
            {(['auto', ...qualityLevels.filter((q) => q !== 'auto')] as string[]).map((level) => {
              const label = level === 'auto' ? 'Auto' : level;
              const selected =
                (level === 'auto' && (!currentQuality || currentQuality === 'auto' || currentQuality === 'unknown')) ||
                currentQuality === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => {
                    onSetQuality(level);
                    setPanel('root');
                  }}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left text-white"
                >
                  <span className="text-[15px]">{label}</span>
                  {selected ? <span className="text-[13px] font-medium text-[#3ea6ff]">Selected</span> : null}
                </button>
              );
            })}
            {qualityLevels.length === 0 ? (
              <p className="px-4 py-3 text-[13px]" style={{ color: YT.muted }}>
                Quality list loads after the live player connects…
              </p>
            ) : null}
          </div>
        ) : null}

        {panel === 'stats' ? (
          <div className="px-4 pb-4">
            <div className="mb-3 flex items-center gap-2">
              {back}
              <p className="text-[16px] font-medium text-white">Stats for nerds</p>
            </div>
            <dl className="space-y-2 font-mono text-[12px] text-white/85">
              <div className="flex justify-between gap-3">
                <dt style={{ color: YT.muted }}>Video ID</dt>
                <dd>{video.videoId}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt style={{ color: YT.muted }}>Live</dt>
                <dd>{details?.isLive ? 'yes' : 'unknown'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt style={{ color: YT.muted }}>Viewers</dt>
                <dd>{formatCount(details?.concurrentViewers ?? video.concurrentViewers)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt style={{ color: YT.muted }}>Likes</dt>
                <dd>{formatCount(displayLikes)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt style={{ color: YT.muted }}>Quality</dt>
                <dd>{currentQuality || 'auto'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt style={{ color: YT.muted }}>Chat ID</dt>
                <dd className="max-w-[60%] truncate">{details?.activeLiveChatId || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt style={{ color: YT.muted }}>Player</dt>
                <dd>YouTube IFrame API</dd>
              </div>
            </dl>
          </div>
        ) : null}

        {panel === 'filter' ? (
          <div className="px-2 pb-4">
            <div className="mb-2 flex items-center gap-2 px-2">
              {back}
              <p className="text-[16px] font-medium text-white">Chat filter</p>
            </div>
            {(
              [
                { id: 'top' as const, label: 'Top messages' },
                { id: 'all' as const, label: 'All messages' },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChatFilterChange(option.id);
                  setPanel('root');
                }}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left text-white"
              >
                <span className="text-[15px]">{option.label}</span>
                {chatFilter === option.id ? (
                  <span className="text-[13px] font-medium text-[#3ea6ff]">Selected</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {panel === 'report' ? (
          <div className="px-4 pb-4">
            <div className="mb-3 flex items-center gap-2">
              {back}
              <p className="text-[16px] font-medium text-white">Report</p>
            </div>
            {reportDone ? (
              <p className="text-[14px] text-white/85">
                Thanks. This channel won&apos;t be recommended in your Live feed.
              </p>
            ) : (
              <>
                <p className="mb-3 text-[13px]" style={{ color: YT.muted }}>
                  Report stays in-app and removes this channel from your Live recommendations.
                </p>
                <div className="space-y-1">
                  {REPORT_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setReportReason(reason)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-white"
                      style={{ background: reportReason === reason ? YT.sheetRaised : 'transparent' }}
                    >
                      <span className="text-[14px]">{reason}</span>
                      {reportReason === reason ? (
                        <span className="text-[12px] text-[#3ea6ff]">Selected</span>
                      ) : null}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!reportReason}
                  onClick={() => {
                    setReportDone(true);
                    window.setTimeout(() => {
                      onDontRecommend();
                      onClose();
                    }, 700);
                  }}
                  className="mt-4 w-full rounded-full py-3 text-[14px] font-medium text-white disabled:opacity-40"
                  style={{ background: YT.live }}
                >
                  Submit report
                </button>
              </>
            )}
          </div>
        ) : null}

        {panel === 'help' ? (
          <div className="px-4 pb-4">
            <div className="mb-3 flex items-center gap-2">
              {back}
              <p className="text-[16px] font-medium text-white">Help &amp; feedback</p>
            </div>
            <div className="space-y-4 text-[13px] leading-relaxed text-white/85">
              <p>
                This Live view streams the official YouTube player and syncs chat / Top fans from
                YouTube&apos;s live chat API in real time — without leaving the app.
              </p>
              <p style={{ color: YT.muted }}>
                Like, quality, chat filters, and channel details work here. Super Chat / gifts XP
                appear when YouTube delivers those events on the live chat feed.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function avatarColor(name: string): string {
  const colors = ['#7c3aed', '#a16207', '#ea580c', '#0d9488', '#2563eb', '#db2777', '#4b5563'];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length] ?? '#4b5563';
}

/** YouTube vertical-live Top fans XP ≈ amountMicros / 10_000 (e.g. $0.75 → 75 XP). */
function messageToXp(message: YoutubeLiveChatMessage): number {
  if (message.amountMicros != null && message.amountMicros > 0) {
    return Math.max(1, Math.round(message.amountMicros / 10_000));
  }
  if (message.kind === 'superChat' || message.kind === 'superSticker') {
    const tier = message.tier ?? 1;
    return Math.max(10, tier * 25);
  }
  if (message.kind === 'membership') return 10;
  return 0;
}

type TopFanEntry = {
  key: string;
  displayName: string;
  handle: string;
  profileImageUrl: string | null;
  xp: number;
  rank: number;
};

function buildTopFans(messages: YoutubeLiveChatMessage[]): TopFanEntry[] {
  const byKey = new Map<
    string,
    { displayName: string; profileImageUrl: string | null; xp: number }
  >();
  for (const message of messages) {
    const xp = messageToXp(message);
    if (xp <= 0) continue;
    const key = message.author.channelId || message.author.displayName;
    const prev = byKey.get(key);
    if (prev) {
      prev.xp += xp;
      if (!prev.profileImageUrl && message.author.profileImageUrl) {
        prev.profileImageUrl = message.author.profileImageUrl;
      }
    } else {
      byKey.set(key, {
        displayName: message.author.displayName,
        profileImageUrl: message.author.profileImageUrl,
        xp,
      });
    }
  }
  return Array.from(byKey.entries())
    .map(([key, value]) => ({
      key,
      displayName: value.displayName,
      handle: toHandle(value.displayName),
      profileImageUrl: value.profileImageUrl,
      xp: value.xp,
      rank: 0,
    }))
    .sort((a, b) => b.xp - a.xp || a.handle.localeCompare(b.handle))
    .slice(0, 50)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

type TopFansSheetProps = {
  open: boolean;
  onClose: () => void;
  fans: TopFanEntry[];
};

/** Official YouTube Live “Top fans” sheet — matched to vertical Live crown screenshot. */
function TopFansSheet({ open, onClose, fans }: TopFansSheetProps) {
  const [panel, setPanel] = useState<'list' | 'info'>('list');

  useEffect(() => {
    if (open) setPanel('list');
  }, [open]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[60] flex flex-col justify-end" style={{ fontFamily: YT.font }}>
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Dismiss top fans"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[68dvh] flex-col overflow-hidden rounded-t-2xl shadow-2xl"
        style={{ background: '#0f0f0f' }}
        role="dialog"
        aria-modal="true"
        aria-label={panel === 'info' ? 'Live leaderboard' : 'Top fans'}
      >
        <div className="flex justify-center pb-1 pt-2.5">
          <span className="h-1 w-9 rounded-full bg-white/25" />
        </div>

        {panel === 'list' ? (
          <>
            <div className="flex items-center justify-between border-b border-white/10 px-4 pb-3">
              <p className="text-[18px] font-bold text-white">Top fans</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPanel('info')}
                  className="rounded-full p-1.5 text-white"
                  aria-label="Help"
                >
                  <CircleHelp size={20} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-white"
                  aria-label="Close"
                >
                  <X size={20} strokeWidth={1.75} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
              {fans.length === 0 ? (
                <div className="px-2 py-10 text-center">
                  <p className="text-[14px] text-white/80">No top fans yet</p>
                  <p className="mt-2 text-[12px]" style={{ color: YT.muted }}>
                    Super Chats and gifts sync here live from official YouTube Live chat — no
                    redirect.
                  </p>
                </div>
              ) : (
                fans.map((fan) => (
                  <div key={fan.key} className="flex items-center gap-3 px-1 py-3">
                    <span className="w-5 shrink-0 text-center text-[14px] font-medium text-white">
                      {fan.rank}
                    </span>
                    {fan.profileImageUrl ? (
                      <img
                        src={fan.profileImageUrl}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                        style={{ background: avatarColor(fan.handle) }}
                      >
                        {avatarLetter(fan.handle)}
                      </span>
                    )}
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-[14px] font-medium text-white">{fan.handle}</span>
                      {fan.rank <= 3 ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                          style={{ background: YT.crown }}
                        >
                          <Crown size={10} fill="currentColor" />#{fan.rank}
                        </span>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[13px]" style={{ color: YT.muted }}>
                      {fan.xp} XP
                    </span>
                  </div>
                ))
              )}
            </div>

            <div
              className="flex items-center gap-3 border-t border-white/10 px-4 py-3"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <span className="w-5 shrink-0 text-center text-[14px] font-medium text-white">
                {fans.length > 0 ? fans.length : '—'}
              </span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[13px] font-bold text-white">
                Y
              </span>
              <p className="min-w-0 flex-1 text-[12px] leading-snug" style={{ color: YT.muted }}>
                Nice! Keep showing support to move up the leaderboard.
              </p>
              <span className="shrink-0 text-[13px] font-medium" style={{ color: YT.muted }}>
                0 XP
              </span>
            </div>
          </>
        ) : (
          <>
            {/* Live leaderboard info — matched to YouTube Help (?) screenshot */}
            <div className="flex items-center justify-between border-b border-white/10 px-2 pb-3">
              <button
                type="button"
                onClick={() => setPanel('list')}
                className="rounded-full p-1.5 text-white"
                aria-label="Back"
              >
                <ChevronLeft size={22} strokeWidth={2} />
              </button>
              <p className="text-[16px] font-bold text-white">Live leaderboard</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-white"
                aria-label="Close"
              >
                <X size={20} strokeWidth={1.75} />
              </button>
            </div>

            <div
              className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              <section>
                <h3 className="text-[15px] font-bold text-white">Top fans</h3>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: YT.muted }}>
                  Stand out in the community by earning experience points (XP) as you engage in the
                  live stream. The top 3 fans get a special chat badge for that session. Points reset
                  every stream, so everyone has a fresh chance to lead!
                </p>
              </section>

              <section>
                <h3 className="text-[15px] font-bold text-white">How to earn XP</h3>
                <ul className="mt-3 space-y-3.5">
                  <li className="flex items-start gap-3 text-white">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/40">
                      <span className="text-[11px] font-bold">10</span>
                    </span>
                    <span className="text-[14px] pt-0.5">Watch for 10 minutes</span>
                  </li>
                  <li className="flex items-start gap-3 text-white">
                    <MessageCircle size={22} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                    <span>
                      <span className="block text-[14px]">Live chat</span>
                      <span className="text-[12px]" style={{ color: YT.muted }}>
                        Up to 3 live chats per hour
                      </span>
                    </span>
                  </li>
                  <li className="flex items-start gap-3 text-white">
                    <span className="relative mt-0.5 shrink-0">
                      <MessageCircle size={22} strokeWidth={1.75} />
                      <span className="absolute -right-0.5 -top-0.5 text-[9px] font-black text-[#f9d649]">
                        ★
                      </span>
                    </span>
                    <span className="text-[14px] pt-0.5">Super Chat</span>
                  </li>
                  <li className="flex items-start gap-3 text-white">
                    <Gift size={22} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                    <span className="text-[14px] pt-0.5">Gifts</span>
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-[15px] font-bold text-white">Manage participation</h3>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: YT.muted }}>
                  Leaderboard XP here is calculated from Super Chats and gifts synced from official
                  YouTube Live chat for this stream. Participation resets each live session.
                </p>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type LiveChatComposeSheetProps = {
  open: boolean;
  onClose: () => void;
  messages: YoutubeLiveChatMessage[];
  giftRanks: Map<string, number>;
  liveChatId: string | null;
  onSent: (message: YoutubeLiveChatMessage) => void;
};

/** In-app live chat compose — reads/sends via YouTube Data API, never opens youtube.com. */
function LiveChatComposeSheet({
  open,
  onClose,
  messages,
  giftRanks,
  liveChatId,
  onSent,
}: LiveChatComposeSheetProps) {
  const { googleAccessToken, linkGoogleAccount, user } = useAuth();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft('');
    setStatus(null);
  }, [open]);

  useEffect(() => {
    const node = listRef.current;
    if (!node || !open) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, open]);

  if (!open) return null;

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (!liveChatId) {
      setStatus('Live chat is not available for this stream yet.');
      return;
    }
    if (!googleAccessToken) {
      setStatus('Connect Google with YouTube permission to send chat in-app.');
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      const result = await sendYoutubeLiveChat({
        liveChatId,
        messageText: text,
        accessToken: googleAccessToken,
      });
      onSent({
        id: result.id,
        kind: 'chat',
        type: 'textMessageEvent',
        publishedAt: new Date().toISOString(),
        message: result.message || text,
        amountDisplayString: null,
        amountMicros: null,
        currency: null,
        tier: null,
        stickerAlt: null,
        memberLevelName: null,
        author: {
          channelId: null,
          displayName: user?.displayName || 'You',
          profileImageUrl: user?.photoURL || null,
          isVerified: false,
          isOwner: false,
          isModerator: false,
          isMember: false,
        },
      });
      setDraft('');
      setStatus('Sent to YouTube Live chat');
      window.setTimeout(() => setStatus(null), 1600);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not send chat';
      setStatus(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[70] flex flex-col justify-end" style={{ fontFamily: YT.font }}>
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Dismiss chat"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[72dvh] flex-col overflow-hidden rounded-t-2xl shadow-2xl"
        style={{ background: '#0f0f0f' }}
        role="dialog"
        aria-modal="true"
        aria-label="Live chat"
      >
        <div className="flex justify-center pb-1 pt-2.5">
          <span className="h-1 w-9 rounded-full bg-white/25" />
        </div>
        <div className="flex items-center justify-between border-b border-white/10 px-4 pb-3">
          <p className="text-[18px] font-bold text-white">Live chat</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white"
            aria-label="Close"
          >
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {messages.length === 0 ? (
            <p className="px-2 py-8 text-center text-[13px]" style={{ color: YT.muted }}>
              Chat syncs live from YouTube. Messages appear here as viewers chat.
            </p>
          ) : (
            messages.map((message) => {
              const key = message.author.channelId || message.author.displayName;
              return (
                <OverlayChatRow key={message.id} message={message} giftRank={giftRanks.get(key)} />
              );
            })
          )}
        </div>

        <div
          className="border-t border-white/10 px-3 pt-2"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          {status ? (
            <p className="mb-2 text-[12px]" style={{ color: YT.muted }}>
              {status}
            </p>
          ) : null}
          {!googleAccessToken ? (
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  setStatus('Opening Google…');
                  const result = await linkGoogleAccount();
                  setStatus(
                    result.ok
                      ? 'Google connected. You can send chat when YouTube access is granted.'
                      : result.reason || 'Could not connect Google.',
                  );
                })();
              }}
              className="mb-2 w-full rounded-full bg-white/10 py-2.5 text-[13px] font-medium text-white"
            >
              Enable YouTube chat send
            </button>
          ) : null}
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              maxLength={200}
              placeholder="Say something…"
              className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-black/40 px-4 text-[15px] text-white outline-none placeholder:text-white/45"
            />
            <button
              type="button"
              disabled={sending || !draft.trim()}
              onClick={() => void send()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
              style={{ background: YT.live }}
              aria-label="Send"
            >
              <SendHorizontal size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerticalLiveSlide({
  video,
  active,
  onClose,
  onOpenRelated,
  onDontRecommend,
}: {
  video: YoutubeVideoSummary;
  active: boolean;
  onClose: () => void;
  onOpenRelated: () => void;
  onDontRecommend: () => void;
}) {
  const [details, setDetails] = useState<YoutubeLiveDetails | null>(null);
  const [messages, setMessages] = useState<YoutubeLiveChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(video.activeLiveChatId ?? null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [topFansOpen, setTopFansOpen] = useState(false);
  const [liveChatOn, setLiveChatOn] = useState(true);
  const [chatFilter, setChatFilter] = useState<ChatFilterMode>('top');
  const [liked, setLiked] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<string[]>([]);
  const [currentQuality, setCurrentQuality] = useState<string | null>('auto');
  const [chatComposeOpen, setChatComposeOpen] = useState(false);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const playerRef = useRef<{
    getAvailableQualityLevels?: () => string[];
    getPlaybackQuality?: () => string;
    setPlaybackQuality?: (quality: string) => void;
    playVideo?: () => void;
    mute?: () => void;
    unMute?: () => void;
  } | null>(null);
  const pageTokenRef = useRef<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const chatListRef = useRef<HTMLDivElement | null>(null);

  const channelHandle = toHandle(details?.customUrl || details?.channelTitle || video.channelTitle);
  const viewers = details?.concurrentViewers ?? video.concurrentViewers;
  const likes = details?.likeCount;
  const avatar = details?.channelThumbnailUrl || null;

  const topFans = buildTopFans(messages);
  const giftRanks = (() => {
    const ranks = new Map<string, number>();
    for (const fan of topFans) {
      if (fan.rank <= 3) ranks.set(fan.key, fan.rank);
    }
    return ranks;
  })();

  const visibleMessages = (() => {
    const list = messages.slice(-40);
    if (chatFilter === 'all') return list;
    const filtered = list.filter(
      (entry) =>
        entry.kind === 'superChat' ||
        entry.kind === 'superSticker' ||
        entry.kind === 'membership' ||
        entry.author.isOwner ||
        entry.author.isModerator ||
        entry.author.isMember,
    );
    return filtered.length > 0 ? filtered : list.slice(-12);
  })();

  useEffect(() => {
    setDetails(null);
    setMessages([]);
    setChatId(video.activeLiveChatId ?? null);
    setMenuOpen(false);
    setTopFansOpen(false);
    setChatComposeOpen(false);
    setGuidelinesOpen(false);
    pageTokenRef.current = null;
    seenIdsRef.current = new Set();
  }, [video.videoId, video.activeLiveChatId]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchYoutubeLiveDetails(video.videoId);
        if (cancelled) return;
        setDetails(next);
        if (next.activeLiveChatId) setChatId(next.activeLiveChatId);
      } catch {
        /* stream still plays from official embed */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, video.videoId]);

  useEffect(() => {
    if (!active || !chatId || !liveChatOn) return;
    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      try {
        const response = await fetchYoutubeLiveChat(chatId, pageTokenRef.current ?? undefined);
        if (cancelled) return;
        if (response.offlineAt) return;
        pageTokenRef.current = response.nextPageToken;
        const fresh = response.messages.filter((entry) => {
          if (seenIdsRef.current.has(entry.id)) return false;
          seenIdsRef.current.add(entry.id);
          return true;
        });
        if (fresh.length > 0) {
          setMessages((prev) => [...prev, ...fresh].slice(-80));
        }
        const wait = Math.min(10_000, Math.max(2_000, response.pollingIntervalMillis || 5_000));
        timer = window.setTimeout(() => {
          void poll();
        }, wait);
      } catch {
        if (cancelled) return;
        timer = window.setTimeout(() => {
          void poll();
        }, 8_000);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [active, chatId, liveChatOn]);

  useEffect(() => {
    const node = chatListRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [visibleMessages]);

  const openOfficialChat = () => {
    setLiveChatOn(true);
    setChatComposeOpen(true);
  };

  const applyQuality = (quality: string) => {
    const player = playerRef.current;
    try {
      if (quality === 'auto') {
        player?.setPlaybackQuality?.('default');
        setCurrentQuality('auto');
      } else {
        player?.setPlaybackQuality?.(quality);
        setCurrentQuality(quality);
      }
    } catch {
      setCurrentQuality(quality);
    }
  };

  return (
    <article
      className="relative h-[100dvh] w-full shrink-0 snap-start snap-always overflow-hidden bg-black"
      style={{ fontFamily: YT.font }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-black">
        {active ? (
          <div className="pointer-events-auto absolute left-1/2 top-1/2 h-[100dvh] w-[177.78dvh] max-w-none -translate-x-1/2 -translate-y-1/2 md:h-[56.25dvw] md:w-[100dvw]">
            <YouTube
              key={`yt-vertical-live-${video.videoId}`}
              videoId={video.videoId}
              className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full"
              opts={{
                width: '100%',
                height: '100%',
                host: 'https://www.youtube.com',
                playerVars: youtubeIframePlayerVars({
                  autoplay: 1,
                  mute: 1,
                  controls: 0,
                  fs: 0,
                  modestbranding: 1,
                  rel: 0,
                  playsinline: 1,
                  iv_load_policy: 3,
                  disablekb: 1,
                }),
              }}
              onReady={(event: YouTubeEvent) => {
                const target = event.target as typeof playerRef.current;
                playerRef.current = target;
                applyYoutubePlayerVolume(event.target);
                try {
                  event.target.mute?.();
                  event.target.playVideo?.();
                } catch {
                  /* muted autoplay */
                }
                try {
                  const levels = target?.getAvailableQualityLevels?.() ?? [];
                  if (levels.length) setQualityLevels(levels);
                  const q = target?.getPlaybackQuality?.();
                  if (q) setCurrentQuality(q);
                } catch {
                  /* quality APIs optional */
                }
              }}
              onStateChange={(event: YouTubeEvent) => {
                stabilizeYoutubePlayerVolume(event.target);
                try {
                  const target = event.target as typeof playerRef.current;
                  const levels = target?.getAvailableQualityLevels?.() ?? [];
                  if (levels.length) setQualityLevels(levels);
                  const q = target?.getPlaybackQuality?.();
                  if (q) setCurrentQuality(q);
                } catch {
                  /* ignore */
                }
              }}
              onError={() => {
                try {
                  playerRef.current?.mute?.();
                  playerRef.current?.playVideo?.();
                } catch {
                  /* keep overlay */
                }
              }}
              title={details?.title || video.title}
            />
          </div>
        ) : video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
      </div>

      <div
        className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3"
        style={{ paddingTop: 'max(0.65rem, env(safe-area-inset-top))' }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button type="button" onClick={onClose} className="shrink-0 p-1 text-white" aria-label="Back">
            <ChevronLeft size={28} strokeWidth={2.25} />
          </button>
          {avatar ? (
            <img src={avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-sm font-bold text-white">
              {avatarLetter(channelHandle)}
            </span>
          )}
          <div className="min-w-0">
            <p
              className="truncate text-[14px] font-semibold text-white"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.55)' }}
            >
              {channelHandle}
            </p>
            <div className="mt-0.5 flex items-center gap-2 text-[12px] text-white/95">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: YT.live }} />
                <Users size={12} strokeWidth={2.25} />
                {formatCount(viewers)}
              </span>
              <span className="inline-flex items-center gap-1">
                <ThumbsUp size={12} strokeWidth={2.25} />
                {formatCount(likes)}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="shrink-0 p-1.5 text-white"
          aria-label="More options"
        >
          <MoreVertical size={22} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setTopFansOpen(true)}
        className="absolute left-3 z-30 flex h-8 w-8 items-center justify-center rounded-full border border-white/70 text-white"
        style={{ top: 'calc(env(safe-area-inset-top) + 3.6rem)' }}
        aria-label="Top fans"
      >
        <Crown size={16} />
      </button>

      <button
        type="button"
        onClick={onOpenRelated}
        className="absolute right-0 z-30 flex h-16 w-5 items-center justify-center rounded-l-md bg-black/45 text-white"
        style={{ top: '42%' }}
        aria-label="More lives"
      >
        <ChevronLeft size={14} />
      </button>

      {liveChatOn ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col"
          style={{ paddingBottom: 'calc(4.25rem + env(safe-area-inset-bottom))' }}
        >
          <div
            ref={chatListRef}
            className="pointer-events-auto max-h-[38dvh] space-y-2 overflow-y-auto px-3 no-scrollbar"
          >
            {visibleMessages.map((message) => {
              const key = message.author.channelId || message.author.displayName;
              return (
                <OverlayChatRow
                  key={message.id}
                  message={message}
                  giftRank={giftRanks.get(key)}
                />
              );
            })}
          </div>
          <div className="pointer-events-auto mx-3 mt-2 rounded-md bg-black/35 px-2.5 py-2 backdrop-blur-[2px]">
            <p className="text-[11px] leading-snug text-white/90">
              Welcome to live chat! Remember to guard your privacy and abide by our community
              guidelines.{' '}
              <button
                type="button"
                onClick={() => setGuidelinesOpen(true)}
                className="font-medium text-[#3ea6ff]"
              >
                Learn more
              </button>
            </p>
          </div>
        </div>
      ) : null}

      {liveChatOn ? (
        <div
          className="absolute inset-x-0 bottom-0 z-40 flex items-center gap-2 px-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={openOfficialChat}
            className="flex h-11 min-w-0 flex-1 items-center justify-between rounded-full border border-white/15 bg-black/40 px-4 text-left backdrop-blur-md"
          >
            <span className="text-[15px] text-white/70">Chat...</span>
            <Smile size={20} className="text-white/80" />
          </button>
          <button
            type="button"
            onClick={() => setLiked((prev) => !prev)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ color: YT.heart }}
            aria-label="Like"
          >
            <Heart size={28} fill={liked ? 'currentColor' : 'none'} />
          </button>
        </div>
      ) : null}

      <LiveMoreMenu
        open={menuOpen && active}
        onClose={() => setMenuOpen(false)}
        video={video}
        details={details}
        likeCount={likes}
        liked={liked}
        liveChatOn={liveChatOn}
        chatFilter={chatFilter}
        qualityLevels={qualityLevels}
        currentQuality={currentQuality}
        onToggleLiked={() => setLiked((prev) => !prev)}
        onToggleLiveChat={() => setLiveChatOn((prev) => !prev)}
        onChatFilterChange={setChatFilter}
        onDontRecommend={onDontRecommend}
        onSetQuality={applyQuality}
      />

      <TopFansSheet
        open={topFansOpen && active}
        onClose={() => setTopFansOpen(false)}
        fans={topFans}
      />

      <LiveChatComposeSheet
        open={chatComposeOpen && active}
        onClose={() => setChatComposeOpen(false)}
        messages={visibleMessages}
        giftRanks={giftRanks}
        liveChatId={chatId}
        onSent={(message) => {
          if (seenIdsRef.current.has(message.id)) return;
          seenIdsRef.current.add(message.id);
          setMessages((prev) => [...prev, message].slice(-80));
        }}
      />

      {guidelinesOpen ? (
        <div className="absolute inset-0 z-[70] flex flex-col justify-end" style={{ fontFamily: YT.font }}>
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Dismiss guidelines"
            onClick={() => setGuidelinesOpen(false)}
          />
          <div
            className="relative max-h-[60dvh] overflow-y-auto rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
            style={{ background: YT.sheet }}
            role="dialog"
            aria-modal="true"
            aria-label="Community guidelines"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[16px] font-medium text-white">Community guidelines</p>
              <button
                type="button"
                onClick={() => setGuidelinesOpen(false)}
                className="rounded-full p-1.5 text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-[13px] leading-relaxed text-white/85">
              Be respectful in live chat. Do not share private info, spam, harass others, or post
              harmful content. Hosts and YouTube moderators may remove messages that break these
              rules. Chat and Super Chats you see here are synced from official YouTube Live.
            </p>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function YoutubeLiveFullscreenFeed({
  videos,
  index,
  onIndexChange,
  onClose,
  onNeedMore,
  loadingMore = false,
}: YoutubeLiveFullscreenFeedProps) {
  const portalRoot = useAppPortalRoot();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const lockScrollSyncRef = useRef(false);
  const wheelLockRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);
  const [relatedOpen, setRelatedOpen] = useState(false);

  const safeIndex = Math.max(0, Math.min(index, Math.max(0, videos.length - 1)));
  const current = videos[safeIndex] ?? null;

  useEffect(() => {
    if (!portalRoot) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [portalRoot]);

  useEffect(() => {
    setRelatedOpen(false);
  }, [safeIndex]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    lockScrollSyncRef.current = true;
    node.scrollTo({ top: safeIndex * node.clientHeight, behavior: 'auto' });
    window.setTimeout(() => {
      lockScrollSyncRef.current = false;
    }, 80);
  }, [safeIndex, videos.length]);

  useEffect(() => {
    if (safeIndex >= videos.length - 3) onNeedMore?.();
  }, [safeIndex, videos.length, onNeedMore]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= videos.length || next === safeIndex) return;
      onIndexChange(next);
    },
    [onIndexChange, safeIndex, videos.length],
  );

  const onScroll = () => {
    if (lockScrollSyncRef.current) return;
    const node = scrollerRef.current;
    if (!node || node.clientHeight <= 0) return;
    const next = Math.round(node.scrollTop / node.clientHeight);
    if (next !== safeIndex && next >= 0 && next < videos.length) onIndexChange(next);
  };

  const onWheel = (event: React.WheelEvent) => {
    if (relatedOpen) return;
    if (Math.abs(event.deltaY) < 40) return;
    if (wheelLockRef.current) return;
    wheelLockRef.current = true;
    goTo(event.deltaY > 0 ? safeIndex + 1 : safeIndex - 1);
    window.setTimeout(() => {
      wheelLockRef.current = false;
    }, 450);
  };

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (relatedOpen) return;
    const startY = touchStartYRef.current;
    touchStartYRef.current = null;
    if (startY == null) return;
    const endY = event.changedTouches[0]?.clientY;
    if (endY == null) return;
    const delta = startY - endY;
    if (Math.abs(delta) < 72) return;
    goTo(delta > 0 ? safeIndex + 1 : safeIndex - 1);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (relatedOpen) {
          setRelatedOpen(false);
          return;
        }
        onClose();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault();
        goTo(safeIndex + 1);
      } else if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault();
        goTo(safeIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, onClose, relatedOpen, safeIndex]);

  if (!portalRoot || !current) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[3600] h-[100dvh] w-[100dvw] overflow-hidden bg-black"
      data-youtube-vertical-live="true"
      role="dialog"
      aria-modal="true"
      aria-label="YouTube Live"
    >
      <div
        ref={scrollerRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain no-scrollbar"
        onScroll={onScroll}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {videos.map((video, slideIndex) => (
          <VerticalLiveSlide
            key={video.videoId}
            video={video}
            active={slideIndex === safeIndex}
            onClose={onClose}
            onOpenRelated={() => setRelatedOpen(true)}
            onDontRecommend={() => {
              if (safeIndex < videos.length - 1) goTo(safeIndex + 1);
              else onClose();
            }}
          />
        ))}
      </div>

      {relatedOpen ? (
        <div className="absolute inset-y-0 right-0 z-50 flex w-[min(78vw,320px)] flex-col border-l border-white/10 bg-[#0f0f0f]/95 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between px-3 py-3">
            <p className="text-[14px] font-semibold text-white">Live now</p>
            <button
              type="button"
              onClick={() => setRelatedOpen(false)}
              className="rounded-full p-1 text-white"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-4">
            {videos.map((video, slideIndex) => (
              <button
                key={`related-${video.videoId}`}
                type="button"
                onClick={() => {
                  goTo(slideIndex);
                  setRelatedOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-xl p-2 text-left ${
                  slideIndex === safeIndex ? 'bg-white/10' : 'bg-transparent'
                }`}
              >
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                  <span className="absolute left-1 top-1 rounded-[2px] bg-[#ff0000] px-1 text-[9px] font-bold uppercase text-white">
                    Live
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[12px] font-semibold text-white">{video.title}</p>
                  <p className="truncate text-[11px] text-white/60">{video.channelTitle}</p>
                </div>
                {slideIndex === safeIndex ? (
                  <ChevronRight size={16} className="shrink-0 text-white/50" />
                ) : null}
              </button>
            ))}
            {loadingMore ? (
              <p className="px-2 py-3 text-center text-[12px] text-white/50">Loading more lives…</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>,
    portalRoot,
  );
}

export const YoutubeLiveWatchRoom = YoutubeLiveFullscreenFeed;
