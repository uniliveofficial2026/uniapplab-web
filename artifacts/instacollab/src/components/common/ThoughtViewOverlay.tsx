import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { User } from '../../types';
import { handleAvatarError, formatContentDateTime, contentTimestampIso } from '../../lib/utils';
import { useDB, useUserById } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';

import { THOUGHT_NOTE_MAX_LENGTH, patchUserThoughtNote } from '../../lib/thoughtNote';
import {
  formatProfileHandle,
  getProfileDisplayName,
  shouldShowProfileHandle,
} from '../../lib/profileDisplay';

interface ThoughtViewOverlayProps {
  user: User;
  thought: string;
  onClose: () => void;
}

export function ThoughtViewOverlay({ user, thought, onClose }: ThoughtViewOverlayProps) {
  const db = useDB();
  const { showToast } = useToast();
  const liveUser = useUserById(user.id, user);
  const isOwner = db.currentUser?.id === liveUser.id;
  const liveThought = (liveUser.note ?? '').trim();
  const readOnlyThought = liveThought || thought.trim();

  const [draft, setDraft] = useState(() => liveUser.note ?? thought);
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (isEditingRef.current) return;
    setDraft(liveUser.note ?? thought);
  }, [liveUser.note, liveUser.id, thought]);

  const displayName = getProfileDisplayName(liveUser);
  const title = isOwner ? 'Your Thought' : `${displayName}'s Thought`;

  const persistNote = (next: string) => {
    db.updateUser(liveUser.id, (u) => ({ ...u, ...patchUserThoughtNote(next) }));
  };

  const handleDraftChange = (value: string) => {
    const next = value.slice(0, THOUGHT_NOTE_MAX_LENGTH);
    isEditingRef.current = true;
    setDraft(next);
    if (isOwner) {
      persistNote(next);
    }
  };

  const handleDelete = () => {
    persistNote('');
    setDraft('');
    showToast('Thought deleted');
    onClose();
  };

  const handleDone = () => {
    if (isOwner) {
      persistNote(draft.trim());
    }
    isEditingRef.current = false;
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-background/50 backdrop-blur-md p-4 pointer-events-auto"
      data-app-overlay-root
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="thought-view-title"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="w-full max-w-[340px] flex flex-col overflow-hidden rounded-[24px] bg-card border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 id="thought-view-title" className="font-bold text-base text-foreground truncate pr-2">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Close thought"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center px-6 pt-8 pb-6 overflow-y-auto no-scrollbar">
          <div className="relative w-[min(100%,280px)] min-h-[120px] mb-8 select-none flex items-center justify-center">
            <div
              className="relative flex items-center justify-center min-h-[120px] w-full px-6 py-5 bg-white/70 dark:bg-zinc-800/80 backdrop-blur-xl border-[1.5px] border-white/80 dark:border-white/10 text-black dark:text-white shadow-[0_16px_32px_rgba(0,0,0,0.15),inset_0_6px_12px_rgba(255,255,255,0.9),inset_0_-4px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.4),inset_0_6px_12px_rgba(255,255,255,0.05),inset_0_-4px_10px_rgba(0,0,0,0.3)]"
              style={{ borderRadius: '50%' }}
            >
              <div className="absolute top-[2px] left-[5%] w-[90%] h-[35%] bg-gradient-to-b from-white/90 dark:from-white/10 to-transparent rounded-t-full pointer-events-none" />
              {isOwner ? (
                <textarea
                  autoFocus
                  maxLength={THOUGHT_NOTE_MAX_LENGTH}
                  value={draft}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  onFocus={() => {
                    isEditingRef.current = true;
                  }}
                  onBlur={() => {
                    isEditingRef.current = false;
                    persistNote(draft.trim());
                    setDraft((prev) => prev.trim());
                  }}
                  placeholder="Share a thought..."
                  aria-label="Edit your thought"
                  className="relative z-10 w-full min-h-[72px] max-h-[220px] bg-transparent border-none text-center text-[17px] font-black tracking-tight outline-none placeholder:text-black/40 dark:placeholder:text-white/40 overflow-y-auto leading-snug px-2 py-1 text-black dark:text-white resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleDone();
                    }
                  }}
                />
              ) : (
                <p className="relative z-10 text-[17px] font-black tracking-tight text-center text-black dark:text-white leading-snug break-words whitespace-pre-wrap select-text">
                  {readOnlyThought}
                </p>
              )}
            </div>

            <div className="absolute -bottom-3 left-[calc(50%-8px)] w-4 h-4 rounded-full bg-white/70 dark:bg-zinc-800/80 backdrop-blur-md border-[1.5px] border-white/80 dark:border-white/10 shadow-[0_8px_16px_rgba(0,0,0,0.1),inset_0_3px_6px_rgba(255,255,255,0.9)] dark:shadow-[0_8px_16px_rgba(0,0,0,0.4),inset_0_3px_6px_rgba(255,255,255,0.05)] z-[-1]">
              <div className="absolute top-[1px] left-[2px] w-[70%] h-[40%] bg-gradient-to-b from-white/90 dark:from-white/10 to-transparent rounded-full pointer-events-none" />
            </div>
            <div className="absolute -bottom-6 left-[calc(50%-5px)] w-2.5 h-2.5 rounded-full bg-white/60 dark:bg-zinc-800/60 backdrop-blur-sm border-[1px] border-white/80 dark:border-white/10 z-[-1]" />
          </div>

          <div className="relative w-20 h-20 rounded-full p-[2px] bg-gradient-to-tr from-accent via-primary to-orange-500 shadow-lg shrink-0">
            <div className="bg-background w-full h-full rounded-full p-[2px]">
              <img
                src={liveUser.avatarUrl || undefined}
                alt={displayName}
                className="w-full h-full rounded-full object-cover"
                onError={handleAvatarError}
              />
            </div>
          </div>
          <span className="mt-3 text-sm font-semibold text-foreground">{displayName}</span>
          {shouldShowProfileHandle(liveUser) ? (
            <span className="mt-0.5 text-xs font-medium text-muted-foreground">
              {formatProfileHandle(liveUser)}
            </span>
          ) : null}
          {liveUser.noteUpdatedAt ? (
            <time
              dateTime={contentTimestampIso(liveUser.noteUpdatedAt)}
              className="mt-1 text-[11px] text-muted-foreground font-medium"
            >
              {formatContentDateTime(liveUser.noteUpdatedAt)}
            </time>
          ) : null}
          {isOwner ? (
            <span className="mt-1 text-[11px] text-muted-foreground font-medium">
              {draft.length}/{THOUGHT_NOTE_MAX_LENGTH}
            </span>
          ) : null}
        </div>

        <div className="px-4 pb-4 shrink-0 flex gap-2">
          {isOwner && (draft.trim() || liveThought) ? (
            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 py-3 text-red-500 font-bold bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors"
            >
              Delete
            </button>
          ) : null}
          <button
            type="button"
            onClick={isOwner ? handleDone : onClose}
            className={`py-3 text-foreground font-bold bg-secondary hover:bg-secondary/80 rounded-xl transition-colors ${
              isOwner && (draft.trim() || liveThought) ? 'flex-[2]' : 'w-full'
            }`}
          >
            {isOwner ? 'Done' : 'Close'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
