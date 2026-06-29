import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, ArchiveRestore, Heart, MessageCircle, Play, X } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { handleMediaError } from '../../lib/utils';
import { postUserId } from '../../lib/safe';
import { resolveProfileGridPost } from '../../lib/profilePostGrid';
import { resolvePost } from '../../lib/entityResolve';
import { PostModal } from '../feed/PostModal';
import { snapshotPostPlayback } from '../../lib/postPlayback';

export function PostArchiveModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const db = useDB();
  const { showToast } = useToast();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const archivedPosts = useMemo(() => {
    return (db.posts ?? [])
      .filter((p) => postUserId(p) === userId && p.isArchived)
      .map((raw) => ({
        live: resolvePost(db.posts, raw, db.users),
        grid: resolveProfileGridPost(raw, db),
      }))
      .sort(
        (a, b) =>
          new Date(b.live.createdAt || 0).getTime() - new Date(a.live.createdAt || 0).getTime()
      );
  }, [db.posts, db.users, db.postComments, userId]);

  const handleUnarchive = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = db.togglePostArchive(postId);
    if (next) return;
    showToast('Post restored to profile');
    if (selectedPostId === postId) setSelectedPostId(null);
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[245] flex items-end sm:items-center justify-center bg-white/25 dark:bg-black/45 backdrop-blur-md sm:p-4"
        data-app-overlay-root
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[min(90dvh,720px)] overflow-hidden bg-white/72 dark:bg-zinc-950/72 backdrop-blur-2xl backdrop-saturate-150 border border-black/8 dark:border-white/12 shadow-[0_20px_60px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/6 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-xl shrink-0">
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-bold text-base">Post archive</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="px-4 py-3 text-sm text-muted-foreground text-center shrink-0 bg-white/20 dark:bg-white/[0.03]">
            Only you can see archived posts. They are hidden from your profile and feed.
          </p>

          <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 min-h-0">
            {archivedPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-full border-2 border-muted flex items-center justify-center mb-6 text-muted-foreground">
                  <Archive className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black mb-2 opacity-80">No archived posts</h3>
                <p className="text-muted-foreground font-medium max-w-sm leading-relaxed text-sm">
                  Archive posts from the ⋯ menu on your posts. They will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 md:gap-3">
                {archivedPosts.map(({ live, grid }) => (
                  <div
                    key={grid.id}
                    className="aspect-square bg-secondary group cursor-pointer relative rounded-xl overflow-hidden shadow-sm"
                    onClick={() => {
                      snapshotPostPlayback(grid.id, 'modal');
                      setSelectedPostId(grid.id);
                    }}
                  >
                    <img
                      src={grid.thumbUrl || undefined}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                      alt=""
                      onError={handleMediaError}
                    />
                    {grid.isVideo && (
                      <div className="absolute top-2 right-2 pointer-events-none">
                        <Play className="w-4 h-4 text-white drop-shadow-md fill-white" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2 backdrop-blur-[2px]">
                      <div className="flex items-center gap-3 text-white text-xs font-bold">
                        <span className="flex items-center gap-1">
                          <Heart className="w-4 h-4 fill-white" /> {grid.likes.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-4 h-4 fill-white" /> {grid.comments.toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleUnarchive(live.id, e)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 dark:bg-zinc-900/90 text-foreground text-xs font-bold border border-white/20 shadow-sm hover:scale-[1.02] active:scale-95 transition-transform"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5" />
                        Unarchive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedPostId && (
        <PostModal
          postId={selectedPostId}
          onClose={() => setSelectedPostId(null)}
        />
      )}
    </>,
    document.body
  );
}
