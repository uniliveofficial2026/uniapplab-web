import { createPortal } from 'react-dom';
import { PlaySquare, X } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { formatMentionsAndTags } from '../../lib/utils';
import { resolveReel } from '../../lib/entityResolve';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';

export function ProfileReelModal({ reelId, onClose }: { reelId: string; onClose: () => void }) {
  const db = useDB();
  const raw = db.reels.find((r) => r.id === reelId);
  const reel = raw ? resolveReel(db.reels, raw, db.users) : null;
  if (!reel) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm max-h-[85vh] flex flex-col rounded-2xl overflow-hidden bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="relative aspect-[9/16] w-full bg-zinc-900">
          {reel.videoUrl ? (
            <video
              src={reel.videoUrl}
              className="w-full h-full object-cover"
              controls
              autoPlay
              playsInline
              muted={db.globalMuted}
              onVolumeChange={(e) => db.setGlobalMuted(e.currentTarget.muted)}
              {...nativeVideoControlGuardProps()}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <PlaySquare className="w-12 h-12" />
            </div>
          )}
        </div>
        {reel.caption && (
          <p className="p-4 text-sm post-caption-text text-foreground leading-snug line-clamp-4">
            {formatMentionsAndTags(reel.caption)}
          </p>
        )}
        <button
          type="button"
          className="mx-4 mb-4 py-2 text-sm font-bold text-primary hover:underline"
          onClick={() => {
            onClose();
            window.dispatchEvent(
              new CustomEvent('navigate', { detail: { tab: 'reels', reelId: reel.id } })
            );
          }}
        >
          Open in Reels
        </button>
      </div>
    </div>,
    document.body
  );
}
