import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  addVideoToYoutubePlaylist,
  createYoutubePlaylist,
  type YoutubePlaylist,
} from '../../lib/youtubePlaylists';
import type { YoutubeVideoSummary } from '../../services/youtube';

type AddToPlaylistSheetProps = {
  video: YoutubeVideoSummary;
  playlists: YoutubePlaylist[];
  onClose: () => void;
  onCreated?: (id: string) => void;
  zIndexClass?: string;
};

export function AddToPlaylistSheet({
  video,
  playlists,
  onClose,
  onCreated,
  zIndexClass = 'z-[80]',
}: AddToPlaylistSheetProps) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-end justify-center sm:items-center sm:p-4`}
      data-app-overlay-root
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-playlist-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close add to playlist"
        onClick={onClose}
      />

      <div
        className="relative z-10 mb-[var(--app-shell-bottom-offset)] flex w-full max-w-md max-h-[min(85dvh,calc(100dvh-var(--app-shell-top-offset)-var(--app-shell-bottom-offset)-0.5rem))] flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl sm:mb-0 sm:max-h-[min(88dvh,640px)] sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <p id="add-to-playlist-title" className="text-sm font-black">
              Add to playlist
            </p>
            <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">
              {video.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3">
          {playlists.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No playlists yet.</p>
          ) : (
            playlists.map((playlist) => {
              const already = playlist.items.some((item) => item.videoId === video.videoId);
              return (
                <button
                  key={playlist.id}
                  type="button"
                  disabled={busy || already}
                  onClick={() => {
                    setBusy(true);
                    void addVideoToYoutubePlaylist(playlist.id, video).finally(() => {
                      setBusy(false);
                      onClose();
                    });
                  }}
                  className="flex w-full min-w-0 items-center justify-between gap-2 rounded-2xl border border-border px-3 py-2.5 text-left text-sm font-bold disabled:opacity-50"
                >
                  <span className="min-w-0 truncate">{playlist.title}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {already ? 'Added' : `${playlist.items.length}`}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <form
          className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3 pb-[max(0.75rem,var(--app-safe-bottom))] sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            setBusy(true);
            void createYoutubePlaylist(title)
              .then(async (created) => {
                await addVideoToYoutubePlaylist(created.id, video);
                onCreated?.(created.id);
                onClose();
              })
              .finally(() => setBusy(false));
          }}
        >
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Create new playlist"
            className="min-w-0 w-full rounded-2xl border border-border bg-card px-3 py-2.5 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="shrink-0 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50 sm:min-w-[5.5rem]"
          >
            Create
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
