import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';
import {
  createBackdropCloseHandler,
  useFullscreenOpenGuard,
  useMediaOverlayAcquire,
} from '../../lib/mediaOverlayLock';
import type { MessageMediaAttachment } from './messages/types';
import {
  canViewChatFileInApp,
  downloadChatFile,
  formatChatFileSize,
  getChatFileKindLabel,
  getChatFileKind,
} from './messages/chatFileUtils';
import { ChatFileInAppViewer } from './ChatFileInAppViewer';

type ChatFilePreviewPortalProps = {
  media: MessageMediaAttachment;
  onClose: () => void;
  onDownloadFailed?: () => void;
};

export function ChatFilePreviewPortal({
  media,
  onClose,
  onDownloadFailed,
}: ChatFilePreviewPortalProps) {
  const { shouldIgnoreClose } = useFullscreenOpenGuard(true);
  useMediaOverlayAcquire(true);
  const onBackdropClose = createBackdropCloseHandler(onClose, shouldIgnoreClose);

  const name = media.name || 'File';
  const sizeLabel = formatChatFileSize(media.size);
  const kindLabel = getChatFileKindLabel(getChatFileKind(media));
  const canView = canViewChatFileInApp(media);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDownload = () => {
    if (!downloadChatFile(media)) onDownloadFailed?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[410] flex flex-col bg-black/95 pointer-events-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={`View ${name}`}
      onPointerUp={onBackdropClose}
    >
      <header
        className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0 safe-area-top"
        onPointerUp={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{name}</p>
          <p className="text-white/60 text-xs tabular-nums">
            {kindLabel}
            {sizeLabel ? ` · ${sizeLabel}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors shrink-0"
        >
          <Download className="w-4 h-4" />
          Save
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full text-white hover:bg-white/10 transition-colors shrink-0"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
      </header>

      <div
        className="flex-1 min-h-0 overflow-hidden p-3 sm:p-4"
        onPointerUp={(e) => e.stopPropagation()}
      >
        {canView ? (
          <ChatFileInAppViewer media={media} />
        ) : (
          <div className="flex items-center justify-center h-full text-white/70 text-sm">
            No file data to display.
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
