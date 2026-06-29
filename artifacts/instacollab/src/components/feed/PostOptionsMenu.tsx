import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getOptionsMenuItemClass,
  optionsMenuItemPointerHandlers,
  type OptionsMenuTone,
} from '../../lib/optionsMenu';

type PostOptionsMenuProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  hoveredMenuItem: string | null;
  onHoverMenuItem: (id: string | null) => void;
  isOwnPost: boolean;
  isArchived: boolean;
  isFollowing: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onReport: () => void;
  onUnfollow: () => void;
  onFavorite: () => void;
  onCopyLink: () => void;
};

function PostOptionsMenuButton({
  id,
  label,
  tone,
  hoveredMenuItem,
  onHoverMenuItem,
  onSelect,
}: {
  id: string;
  label: string;
  tone: OptionsMenuTone;
  hoveredMenuItem: string | null;
  onHoverMenuItem: (id: string | null) => void;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={getOptionsMenuItemClass(id, tone, hoveredMenuItem)}
      {...optionsMenuItemPointerHandlers(id, onHoverMenuItem)}
      onClick={(e) => {
        e.stopPropagation();
        onHoverMenuItem(null);
        onSelect();
      }}
    >
      {label}
    </button>
  );
}

export function PostOptionsMenu({
  isOpen,
  onOpenChange,
  hoveredMenuItem,
  onHoverMenuItem,
  isOwnPost,
  isArchived,
  isFollowing,
  onArchive,
  onDelete,
  onReport,
  onUnfollow,
  onFavorite,
  onCopyLink,
}: PostOptionsMenuProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onOpenChange(!isOpen);
        }}
        className="p-1.5 hover:bg-secondary rounded-full transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <MoreHorizontal className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
      </button>
      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-[119] cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
              }}
              aria-hidden
            />
            <motion.div
              role="menu"
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.15 }}
              onMouseLeave={() => onHoverMenuItem(null)}
              className="absolute right-0 top-full mt-2 w-48 min-w-[12rem] bg-white/70 dark:bg-black/75 backdrop-blur-xl backdrop-saturate-150 border border-black/10 dark:border-white/15 rounded-xl flex flex-col gap-1 p-1.5 z-50 shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)] overflow-hidden pointer-events-auto"
            >
              {isOwnPost ? (
                <>
                  {!isArchived && (
                    <PostOptionsMenuButton
                      id="archive"
                      label="Archive"
                      tone="default"
                      hoveredMenuItem={hoveredMenuItem}
                      onHoverMenuItem={onHoverMenuItem}
                      onSelect={onArchive}
                    />
                  )}
                  <PostOptionsMenuButton
                    id="delete"
                    label="Delete Post"
                    tone="danger"
                    hoveredMenuItem={hoveredMenuItem}
                    onHoverMenuItem={onHoverMenuItem}
                    onSelect={onDelete}
                  />
                </>
              ) : (
                <PostOptionsMenuButton
                  id="report"
                  label="Report"
                  tone="danger"
                  hoveredMenuItem={hoveredMenuItem}
                  onHoverMenuItem={onHoverMenuItem}
                  onSelect={onReport}
                />
              )}
              {!isOwnPost && isFollowing && (
                <PostOptionsMenuButton
                  id="unfollow"
                  label="Unfollow"
                  tone="danger"
                  hoveredMenuItem={hoveredMenuItem}
                  onHoverMenuItem={onHoverMenuItem}
                  onSelect={onUnfollow}
                />
              )}
              <PostOptionsMenuButton
                id="favorite"
                label="Add to favorites"
                tone="default"
                hoveredMenuItem={hoveredMenuItem}
                onHoverMenuItem={onHoverMenuItem}
                onSelect={onFavorite}
              />
              <PostOptionsMenuButton
                id="copy"
                label="Copy link"
                tone="default"
                hoveredMenuItem={hoveredMenuItem}
                onHoverMenuItem={onHoverMenuItem}
                onSelect={onCopyLink}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
