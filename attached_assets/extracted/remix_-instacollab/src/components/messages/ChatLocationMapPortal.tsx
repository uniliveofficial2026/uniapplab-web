import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, MapPin, X } from 'lucide-react';
import {
  createBackdropCloseHandler,
  useFullscreenOpenGuard,
  useMediaOverlayAcquire,
} from '../../lib/mediaOverlayLock';
import type { ChatMessageLocation } from '../../types';
import {
  buildGoogleMapsUrl,
  buildOsmEmbedUrl,
  formatCoordinates,
  getLocationPreviewLabel,
} from './messages/chatLocationUtils';

type ChatLocationMapPortalProps = {
  location: ChatMessageLocation;
  onClose: () => void;
};

export function ChatLocationMapPortal({ location, onClose }: ChatLocationMapPortalProps) {
  const { shouldIgnoreClose } = useFullscreenOpenGuard(true);
  useMediaOverlayAcquire(true);
  const onBackdropClose = createBackdropCloseHandler(onClose, shouldIgnoreClose);

  const title = getLocationPreviewLabel(location);
  const coords = formatCoordinates(location);
  const embedUrl = buildOsmEmbedUrl(location);
  const externalUrl = buildGoogleMapsUrl(location);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[410] flex flex-col bg-black/95 pointer-events-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={`Map: ${title}`}
      onPointerUp={onBackdropClose}
    >
      <header
        className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0"
        onPointerUp={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-300 flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{title}</p>
          <p className="text-white/60 text-xs tabular-nums">{coords}</p>
        </div>
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors shrink-0"
        >
          <ExternalLink className="w-4 h-4" />
          Maps
        </a>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full text-white hover:bg-white/10 transition-colors shrink-0"
          aria-label="Close map"
        >
          <X className="w-6 h-6" />
        </button>
      </header>

      <div
        className="flex-1 min-h-0 p-3 sm:p-4"
        onPointerUp={(e) => e.stopPropagation()}
      >
        <iframe
          title={`Map: ${title}`}
          src={embedUrl}
          className="w-full h-full min-h-[50vh] rounded-xl border border-white/10 bg-zinc-900"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>,
    document.body
  );
}
