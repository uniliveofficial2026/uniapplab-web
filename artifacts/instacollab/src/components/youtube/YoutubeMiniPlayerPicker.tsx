import { useEffect, useState } from 'react';
import { Link2, X, Youtube } from 'lucide-react';
import { YoutubeSearchPanel } from '../../smule-rooms/components/YoutubeSearchPanel';
import {
  fetchYoutubePlaylistItems,
  parseYoutubePlaylistId,
  parseYoutubeVideoId,
  recordYoutubeHistory,
  type YoutubeVideoSummary,
} from '../../services/youtube';
import { playYoutubeMiniVideo, patchYoutubeMiniPlayerState } from '../../lib/youtubeMiniPlayer';

type YoutubeMiniPlayerPickerProps = {
  open: boolean;
  onClose: () => void;
};

export function YoutubeMiniPlayerPicker({ open, onClose }: YoutubeMiniPlayerPickerProps) {
  const [urlDraft, setUrlDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUrlDraft('');
    setError(null);
    setLoadingPlaylist(false);
  }, [open]);

  if (!open) return null;

  const selectVideo = (video: YoutubeVideoSummary, options?: { playlistId?: string; queue?: YoutubeVideoSummary[] }) => {
    void recordYoutubeHistory(video);
    playYoutubeMiniVideo(video, {
      playlistId: options?.playlistId ?? null,
      queue: options?.queue,
      queueIndex: 0,
    });
    onClose();
  };

  const applyUrl = async () => {
    const playlistId = parseYoutubePlaylistId(urlDraft);
    const videoId = parseYoutubeVideoId(urlDraft);

    if (playlistId) {
      setLoadingPlaylist(true);
      setError(null);
      try {
        const response = await fetchYoutubePlaylistItems(playlistId);
        if (response.items.length > 0) {
          selectVideo(response.items[0], { playlistId, queue: response.items });
          return;
        }
        if (videoId) {
          selectVideo(
            {
              videoId,
              title: 'YouTube playlist',
              channelTitle: '',
              thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            },
            { playlistId },
          );
          return;
        }
        setError('That playlist has no playable videos.');
        return;
      } catch {
        if (videoId) {
          selectVideo(
            {
              videoId,
              title: 'YouTube playlist',
              channelTitle: '',
              thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            },
            { playlistId },
          );
        } else {
          setError('Could not load that playlist. Check the link and try again.');
        }
      } finally {
        setLoadingPlaylist(false);
      }
      return;
    }

    if (!videoId) {
      setError('Paste a valid YouTube video or playlist link');
      return;
    }
    selectVideo({
      videoId,
      title: 'YouTube video',
      channelTitle: '',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[420] flex items-end sm:items-center justify-center bg-black/55 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(88dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12091f]/95 shadow-2xl backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <Youtube size={18} className="text-red-400" aria-hidden />
            YouTube mini player
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 border-b border-white/10 px-4 py-3">
          <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
            Paste video or playlist link
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Link2
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                aria-hidden
              />
              <input
                value={urlDraft}
                onChange={(event) => {
                  setUrlDraft(event.target.value);
                  setError(null);
                }}
                placeholder="https://youtube.com/watch?v=… or playlist"
                className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-purple-400/50"
              />
            </div>
            <button
              type="button"
              onClick={() => void applyUrl()}
              disabled={loadingPlaylist}
              className="shrink-0 rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white transition hover:bg-red-500 disabled:opacity-60"
            >
              {loadingPlaylist ? '…' : 'Play'}
            </button>
          </div>
          {error ? <p className="text-[11px] font-semibold text-red-300">{error}</p> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <YoutubeSearchPanel
            onSelectVideo={(video) => {
              selectVideo(video);
            }}
            selectLabel="Play"
            onClose={() => patchYoutubeMiniPlayerState({ pickerOpen: false })}
          />
        </div>
      </div>
    </div>
  );
}
