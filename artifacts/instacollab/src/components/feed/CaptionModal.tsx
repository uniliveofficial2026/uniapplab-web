import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Post as PostType } from '../../types';
import { formatMentionsAndTags, USER_CAPTION_PROSE_CLASS } from '../../lib/utils';
import { usePostById } from '../../lib/useDB';

interface CaptionModalProps {
  post: PostType;
  onClose: () => void;
}

export function CaptionModal({ post, onClose }: CaptionModalProps) {
  const livePost = usePostById(post.id, post) ?? post;
  const captionBody = formatMentionsAndTags(livePost.caption, {
    linkClassName: 'caption-link',
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-background/40 backdrop-blur-md p-4 pointer-events-auto animate-in fade-in duration-200"
      data-app-overlay-root
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="caption-modal-title"
        className="caption-modal-panel w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden rounded-2xl bg-background border border-border shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0">
          <h2 id="caption-modal-title" className="font-bold text-base text-foreground">
            Caption
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close caption"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 px-4 py-4 bg-background">
          {livePost.location ? (
            <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-3">
              {livePost.location}
            </p>
          ) : null}
          <div className={`caption-modal-prose ${USER_CAPTION_PROSE_CLASS} text-[16px] leading-relaxed whitespace-pre-wrap`}>
            {captionBody ?? (
              <span className="text-foreground/60">No caption.</span>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
