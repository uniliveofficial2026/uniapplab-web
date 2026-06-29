import React from 'react';
import { Download, FileText } from 'lucide-react';
import type { MessageMediaAttachment } from './messages/types';
import {
  canViewChatFileInApp,
  formatChatFileSize,
  getChatFileKind,
  getChatFileKindLabel,
} from './messages/chatFileUtils';

type MessageFileCardProps = {
  media: MessageMediaAttachment;
  isAuthor: boolean;
  /** Text-only stub from before file media was implemented */
  legacyNameOnly?: boolean;
  onPreview?: (media: MessageMediaAttachment) => void;
  onDownload?: (media: MessageMediaAttachment) => void;
};

export function MessageFileCard({
  media,
  isAuthor,
  legacyNameOnly = false,
  onPreview,
  onDownload,
}: MessageFileCardProps) {
  const name = media.name || 'File';
  const sizeLabel = formatChatFileSize(media.size);
  const hasPayload = !legacyNameOnly && !!media.url;
  const canViewInApp = hasPayload && canViewChatFileInApp(media);
  const kindLabel = getChatFileKindLabel(getChatFileKind(media));

  const shellClass = isAuthor
    ? 'bg-primary-foreground/12 border-primary-foreground/25 text-primary-foreground'
    : 'bg-zinc-100/90 border-zinc-200/80 text-foreground dark:bg-zinc-800/90 dark:border-zinc-700/80';

  const iconWrapClass = isAuthor
    ? 'bg-primary-foreground/20 text-primary-foreground'
    : 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300';

  const metaClass = isAuthor ? 'text-primary-foreground/70' : 'text-muted-foreground';

  const openInApp = () => {
    if (canViewInApp && onPreview) onPreview(media);
  };

  return (
    <div
      data-message-interactive="true"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={`w-full min-w-[220px] max-w-[min(100%,320px)] rounded-2xl border overflow-hidden ${shellClass}`}
    >
      <button
        type="button"
        disabled={!canViewInApp}
        onClick={openInApp}
        className={`flex items-center gap-3 w-full px-3 py-2.5 text-left transition-opacity ${canViewInApp ? 'hover:opacity-90 cursor-pointer' : 'cursor-default opacity-90'}`}
      >
        <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${iconWrapClass}`}>
          <FileText className="w-5 h-5" aria-hidden />
          <span className="text-[8px] font-bold uppercase tracking-wide mt-0.5 leading-none">{kindLabel}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold truncate leading-tight">{name}</p>
          <p className={`text-[11px] mt-0.5 tabular-nums ${metaClass}`}>
            {sizeLabel || (legacyNameOnly ? 'Sent before in-app view' : kindLabel)}
          </p>
          {canViewInApp ? (
            <p className={`text-[10px] mt-1 font-semibold ${isAuthor ? 'text-primary-foreground/85' : 'text-primary'}`}>
              Tap to view in app
            </p>
          ) : null}
        </div>
      </button>

      {canViewInApp ? (
        <div
          className={`flex border-t ${isAuthor ? 'border-primary-foreground/20' : 'border-zinc-200/80 dark:border-zinc-700/80'}`}
        >
          <button
            type="button"
            onClick={openInApp}
            className={`flex-1 py-2.5 text-[12px] font-bold transition-colors ${isAuthor ? 'hover:bg-primary-foreground/10 text-primary-foreground' : 'hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60'}`}
          >
            View in app
          </button>
          {onDownload ? (
            <button
              type="button"
              onClick={() => onDownload(media)}
              className={`flex-1 py-2.5 text-[12px] font-bold inline-flex items-center justify-center gap-1 transition-colors border-l ${isAuthor ? 'border-primary-foreground/20 hover:bg-primary-foreground/10 text-primary-foreground' : 'border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60'}`}
            >
              <Download className="w-3.5 h-3.5" />
              Save
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
