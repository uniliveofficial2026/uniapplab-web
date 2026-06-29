import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Post as PostType } from '../../types';
import { formatMentionsAndTags } from '../../lib/utils';

interface CaptionModalProps {
  post: PostType;
  onClose: () => void;
}

export function CaptionModal({ post, onClose }: CaptionModalProps) {
  return createPortal(
    <div 
      className="fixed inset-0 z-[2500] flex items-center justify-center bg-background pointer-events-auto p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-card border border-border shadow-2xl rounded-2xl p-6 relative flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 p-2 hover:bg-secondary rounded-full z-10 border border-border bg-background shadow-sm"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="font-bold text-lg mb-4 shrink-0">Caption</div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="text-foreground/90 text-[16px] leading-relaxed whitespace-pre-wrap py-2">
            {formatMentionsAndTags(post.caption)}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
