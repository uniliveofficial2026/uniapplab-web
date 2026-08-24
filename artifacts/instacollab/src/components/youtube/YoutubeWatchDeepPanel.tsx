import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Loader2, MessageSquare, Play } from 'lucide-react';
import {
  fetchYoutubeChannelPage,
  fetchYoutubeCommentReplies,
  fetchYoutubeComments,
  fetchYoutubeRelated,
  fetchYoutubeVideoDetails,
  type YoutubeChannelPage,
  type YoutubeComment,
  type YoutubeVideoDetails,
  type YoutubeVideoSummary,
} from '../../services/youtube';

type YoutubeWatchDeepPanelProps = {
  video: YoutubeVideoSummary;
  onPlay: (video: YoutubeVideoSummary, queue?: YoutubeVideoSummary[], index?: number) => void;
  onSeek?: (seconds: number) => void;
  onOpenChannel?: (channelId: string, uploads: YoutubeVideoSummary[]) => void;
};

function formatCount(value?: number): string {
  if (value == null || !Number.isFinite(value)) return '';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatStamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function YoutubeWatchDeepPanel({
  video,
  onPlay,
  onSeek,
  onOpenChannel,
}: YoutubeWatchDeepPanelProps) {
  const [details, setDetails] = useState<YoutubeVideoDetails | null>(null);
  const [related, setRelated] = useState<YoutubeVideoSummary[]>([]);
  const [relatedToken, setRelatedToken] = useState<string | null>(null);
  const [comments, setComments] = useState<YoutubeComment[]>([]);
  const [commentsToken, setCommentsToken] = useState<string | null>(null);
  const [channel, setChannel] = useState<YoutubeChannelPage['channel'] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loadingMoreRelated, setLoadingMoreRelated] = useState(false);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoId = video.videoId;

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    setRelated([]);
    setRelatedToken(null);
    setComments([]);
    setCommentsToken(null);
    setChannel(null);
    setExpanded(false);
    setError(null);

    void (async () => {
      try {
        const [nextDetails, nextRelated, nextComments] = await Promise.all([
          fetchYoutubeVideoDetails(videoId).catch(() => null),
          fetchYoutubeRelated(videoId).catch(() => null),
          fetchYoutubeComments(videoId).catch(() => null),
        ]);
        if (cancelled) return;
        if (nextDetails) setDetails(nextDetails);
        if (nextRelated) {
          setRelated(nextRelated.items);
          setRelatedToken(nextRelated.nextPageToken);
        }
        if (nextComments) {
          setComments(nextComments.items);
          setCommentsToken(nextComments.nextPageToken);
        }
        const channelId = nextDetails?.channelId || video.channelId;
        if (channelId) {
          const page = await fetchYoutubeChannelPage(channelId).catch(() => null);
          if (!cancelled && page) setChannel(page.channel);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Details failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [video.channelId, videoId]);

  const loadMoreRelated = useCallback(async () => {
    if (!relatedToken) return;
    setLoadingMoreRelated(true);
    try {
      const response = await fetchYoutubeRelated(videoId, relatedToken);
      setRelated((prev) => [...prev, ...response.items]);
      setRelatedToken(response.nextPageToken);
    } catch {
      /* keep existing related */
    } finally {
      setLoadingMoreRelated(false);
    }
  }, [relatedToken, videoId]);

  const loadMoreComments = useCallback(async () => {
    if (!commentsToken) return;
    setLoadingMoreComments(true);
    try {
      const response = await fetchYoutubeComments(videoId, commentsToken);
      setComments((prev) => [...prev, ...response.items]);
      setCommentsToken(response.nextPageToken);
    } catch {
      /* keep existing comments */
    } finally {
      setLoadingMoreComments(false);
    }
  }, [commentsToken, videoId]);

  const loadReplies = async (comment: YoutubeComment) => {
    try {
      const response = await fetchYoutubeCommentReplies(comment.id);
      setComments((prev) =>
        prev.map((entry) =>
          entry.id === comment.id
            ? { ...entry, replies: [...(entry.replies ?? []), ...response.items] }
            : entry,
        ),
      );
    } catch {
      /* ignore */
    }
  };

  const description = details?.description || '';
  const chapters = details?.chapters ?? [];
  const title = details?.title || video.title;
  const channelTitle = details?.channelTitle || video.channelTitle;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4">
      <div>
        <p className="text-sm font-black text-foreground">{title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            className="font-bold text-foreground hover:underline"
            onClick={() => {
              if (details?.channelId || video.channelId) {
                const id = details?.channelId || video.channelId;
                if (!id) return;
                void fetchYoutubeChannelPage(id).then((page) => {
                  onOpenChannel?.(id, page.items);
                  onPlay(page.items[0], page.items, 0);
                });
              }
            }}
          >
            {channelTitle}
          </button>
          {details?.viewCount != null ? <span>{formatCount(details.viewCount)} views</span> : null}
          {details?.likeCount != null ? <span>{formatCount(details.likeCount)} likes</span> : null}
          {details?.commentCount != null ? (
            <span>{formatCount(details.commentCount)} comments</span>
          ) : null}
          {channel?.subscriberCount ? <span>{formatCount(channel.subscriberCount)} subscribers</span> : null}
        </div>
      </div>

      {error ? <p className="text-xs font-bold text-red-500">{error}</p> : null}

      {chapters.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Chapters</p>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {chapters.map((chapter) => (
              <button
                key={`${chapter.startSeconds}-${chapter.label}`}
                type="button"
                onClick={() => onSeek?.(chapter.startSeconds)}
                className="flex items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-muted"
              >
                <span className="font-mono text-[11px] font-bold text-red-600">
                  {formatStamp(chapter.startSeconds)}
                </span>
                <span className="line-clamp-1">{chapter.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {description ? (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground"
          >
            Description <ChevronDown size={12} className={expanded ? 'rotate-180' : ''} />
          </button>
          <p className={`mt-2 whitespace-pre-wrap text-xs text-muted-foreground ${expanded ? '' : 'line-clamp-3'}`}>
            {description}
          </p>
        </div>
      ) : null}

      {related.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Up next</p>
          <div className="space-y-2">
            {related.map((item, index) => (
              <button
                key={`${item.videoId}-${index}`}
                type="button"
                onClick={() => onPlay(item, related, index)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-background/60 p-2 text-left"
              >
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-black/40">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Play size={14} className="fill-white text-white" />
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs font-bold">{item.title}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.channelTitle}</p>
                </div>
              </button>
            ))}
          </div>
          {relatedToken ? (
            <button
              type="button"
              disabled={loadingMoreRelated}
              onClick={() => void loadMoreRelated()}
              className="w-full rounded-xl border border-border py-2 text-xs font-bold text-muted-foreground disabled:opacity-50"
            >
              {loadingMoreRelated ? 'Loading…' : 'Load more related'}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <MessageSquare size={12} /> Comments
        </p>
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No comments loaded.</p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="space-y-1">
                <p className="text-[11px] font-black">{comment.author}</p>
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">{comment.text}</p>
                {(comment.replies?.length ?? 0) > 0 ? (
                  <div className="ml-3 space-y-1 border-l border-border pl-3">
                    {comment.replies?.map((reply) => (
                      <div key={reply.id}>
                        <p className="text-[10px] font-bold">{reply.author}</p>
                        <p className="text-[11px] text-muted-foreground">{reply.text}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {(comment.replyCount ?? 0) > (comment.replies?.length ?? 0) ? (
                  <button
                    type="button"
                    onClick={() => void loadReplies(comment)}
                    className="text-[10px] font-bold text-red-600"
                  >
                    Load replies
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {commentsToken ? (
          <button
            type="button"
            disabled={loadingMoreComments}
            onClick={() => void loadMoreComments()}
            className="w-full rounded-xl border border-border py-2 text-xs font-bold text-muted-foreground disabled:opacity-50"
          >
            {loadingMoreComments ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Loading…
              </span>
            ) : (
              'Load more comments'
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
