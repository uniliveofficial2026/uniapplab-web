import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../../types';
import { handleAvatarError, resolveAvatarSrc } from '../../lib/utils';
import { resolveUser } from '../../lib/safe';
import { useDB, useUserById } from '../../lib/useDB';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../../lib/ToastContext';
import { THOUGHT_NOTE_MAX_LENGTH, patchUserThoughtNote } from '../../lib/thoughtNote';
import { thoughtAnimationKey } from '../../lib/thoughtNoteEpoch';
import { useThoughtReplayNonce } from '../../hooks/useThoughtReplayNonce';
import { ThoughtViewOverlay } from './ThoughtViewOverlay';
import { AvatarThoughtBubble, InlineAvatarThoughtBubble } from './AvatarThoughtBubble';

interface AvatarProps {
  user: User;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  hideNote?: boolean;
  containGlow?: boolean;
  /**
   * inline — bubble moves with avatar (feed posts, suggested carousel).
   * portal — fixed layer for overflow-hidden shells; one bubble per user via registry.
   */
  thoughtBubbleMode?: 'portal' | 'inline';
}

export function Avatar({
  user,
  size = 'md',
  className = '',
  onClick,
  hideNote = false,
  thoughtBubbleMode = 'inline',
}: AvatarProps) {
  const db = useDB();
  const { showToast } = useToast();
  const avatarRootRef = useRef<HTMLDivElement>(null);
  const sizeClasses = {
    sm: 'w-9 h-9',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const resolvedUser = useUserById(user.id, resolveUser(db.users, user));
  const thoughtReplayNonce = useThoughtReplayNonce(resolvedUser.id);
  const isLive = resolvedUser.status === 'live';
  const isStory = resolvedUser.status === 'story';
  const isCurrentUser = db.currentUser?.id === resolvedUser.id;
  const hasRing = resolvedUser.status && resolvedUser.status !== 'none';
  const thoughtNote = resolvedUser.note?.trim() ?? '';
  const thoughtEpoch = resolvedUser.noteUpdatedAt ?? 0;
  const thoughtBubbleKey = thoughtAnimationKey(
    resolvedUser.id,
    thoughtNote,
    thoughtEpoch,
    thoughtReplayNonce,
  );
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [noteEditVal, setNoteEditVal] = useState('');

  useEffect(() => {
    if (showNoteModal) {
      setNoteEditVal(resolvedUser.note || '');
    }
  }, [showNoteModal, resolvedUser.note]);

  const ringColor = isLive 
    ? 'from-red-500 via-pink-500 to-red-500' 
    : 'from-accent via-primary to-orange-500';

  const handleClick = (e: React.MouseEvent) => {
    if (isLive) {
      e.stopPropagation();
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'live' } }));
      return;
    }
    
    if (isStory) {
      e.stopPropagation();
      e.preventDefault();
      if (db.getFeedStorySegments(resolvedUser.id).length === 0) {
        if (onClick) onClick(e);
        return;
      }
      window.dispatchEvent(new CustomEvent('open-story', { detail: { userId: resolvedUser.id } }));
      return;
    }

    if (onClick) {
      onClick(e);
      return;
    }
  };

  return (
    <>
      <div 
        ref={avatarRootRef}
        className={`relative overflow-visible ${sizeClasses[size]} ${className} shrink-0 cursor-pointer`}
        onClick={handleClick}
      >
        {hasRing && (
          <div className={`absolute -inset-[3px] rounded-full bg-gradient-to-tr ${ringColor} ${isLive ? 'animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'shadow-[0_0_8px_rgba(255,165,0,0.4)]'}`} />
        )}
        <div className="absolute inset-0 bg-background rounded-full border border-border p-[2px]">
          <img
            src={resolveAvatarSrc(resolvedUser.avatarUrl)}
            alt={resolvedUser.username}
            className="w-full h-full rounded-full object-cover relative z-10"
            onError={handleAvatarError}
          />
        </div>
        {isLive && (
          <div className="absolute -bottom-2 inset-x-0 flex justify-center z-20">
            <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">LIVE</span>
          </div>
        )}

        {!hideNote && thoughtNote && size !== 'sm' && thoughtBubbleMode === 'inline' ? (
          <InlineAvatarThoughtBubble
            key={thoughtBubbleKey}
            noteText={thoughtNote}
            animationEpoch={thoughtEpoch}
            onOpen={() => setShowPreviewModal(true)}
          />
        ) : null}
      </div>

      {!hideNote && thoughtNote && size !== 'sm' && thoughtBubbleMode === 'portal' ? (
        <AvatarThoughtBubble
          key={thoughtBubbleKey}
          anchorRef={avatarRootRef}
          noteText={thoughtNote}
          animationEpoch={thoughtEpoch}
          userId={resolvedUser.id}
          onOpen={() => setShowPreviewModal(true)}
        />
      ) : null}

      <AnimatePresence>
        {showNoteModal && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card w-full max-w-[320px] rounded-[24px] border border-border shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <span className="font-bold text-lg">Thinking</span>
                <button onClick={() => setShowNoteModal(false)} className="p-1 hover:bg-secondary rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 pb-4 flex flex-col items-center">
                {/* Centered Thought Bubble */}
                <div className="relative w-[185px] h-[115px] mb-8 select-none flex items-center justify-center">
                  {/* Main glass bubble */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center p-4 bg-white/70 dark:bg-zinc-800/80 backdrop-blur-xl border-[1.5px] border-white/80 dark:border-white/10 text-black dark:text-white shadow-[0_16px_32px_rgba(0,0,0,0.15),inset_0_6px_12px_rgba(255,255,255,0.9),inset_0_-4px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.4),inset_0_6px_12px_rgba(255,255,255,0.05),inset_0_-4px_10px_rgba(0,0,0,0.3)] w-full h-full"
                    style={{ 
                      borderRadius: '50%',
                    }}
                  >
                    <div className="absolute top-[2px] left-[5%] w-[90%] h-[35%] bg-gradient-to-b from-white/90 dark:from-white/10 to-transparent rounded-t-full pointer-events-none" />
                    
                    <textarea
                      autoFocus
                      maxLength={THOUGHT_NOTE_MAX_LENGTH}
                      value={noteEditVal}
                      onChange={e => setNoteEditVal(e.target.value)}
                      placeholder="Share a thought..."
                      className="w-full h-[65px] bg-transparent border-none text-center flex items-center justify-center text-[13px] font-black tracking-tight outline-none placeholder:text-black/40 dark:placeholder:text-white/40 overflow-hidden z-10 drop-shadow-md dark:drop-shadow-none leading-tight px-6 py-2 text-black dark:text-white resize-none"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          db.updateUser(resolvedUser.id, u => ({ ...u, ...patchUserThoughtNote(noteEditVal.trim()) }));
                          setShowNoteModal(false);
                          if (showToast) showToast('Note updated');
                        }
                      }}
                    />
                  </div>

                  {/* Tail 1 */}
                  <div 
                    className="absolute -bottom-3 left-[calc(50%-8px)] w-4 h-4 rounded-full bg-white/70 dark:bg-zinc-800/80 backdrop-blur-md border-[1.5px] border-white/80 dark:border-white/10 shadow-[0_8px_16px_rgba(0,0,0,0.1),inset_0_3px_6px_rgba(255,255,255,0.9)] dark:shadow-[0_8px_16px_rgba(0,0,0,0.4),inset_0_3px_6px_rgba(255,255,255,0.05)] z-[-1]"
                  >
                    <div className="absolute top-[1px] left-[2px] w-[70%] h-[40%] bg-gradient-to-b from-white/90 dark:from-white/10 to-transparent rounded-full pointer-events-none" />
                  </div>

                  {/* Tail 2 */}
                  <div 
                    className="absolute -bottom-6 left-[calc(50%-5px)] w-2.5 h-2.5 rounded-full bg-white/60 dark:bg-zinc-800/60 backdrop-blur-sm border-[1px] border-white/80 dark:border-white/10 z-[-1]"
                  />
                </div>

                {/* Centered Avatar at the bottom of the bubble */}
                <div className="relative w-20 h-20 rounded-full p-[2px] bg-gradient-to-tr from-accent via-primary to-orange-500 shadow-lg">
                  <div className="bg-background w-full h-full rounded-full p-[2px]">
                    <img
                      src={resolveAvatarSrc(resolvedUser.avatarUrl)}
                      className="w-full h-full rounded-full object-cover"
                      alt={resolvedUser.username}
                      onError={handleAvatarError}
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-4 flex gap-2">
                {resolvedUser.note && (
                  <button 
                    onClick={() => {
                      db.updateUser(resolvedUser.id, u => ({ ...u, ...patchUserThoughtNote('') }));
                      setShowNoteModal(false);
                      if (showToast) showToast('Note deleted');
                    }}
                    className="flex-1 py-3 text-red-500 font-bold bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors"
                  >
                    Delete
                  </button>
                )}
                <button 
                  onClick={() => {
                    db.updateUser(resolvedUser.id, u => ({ ...u, ...patchUserThoughtNote(noteEditVal.trim()) }));
                    setShowNoteModal(false);
                    if (showToast) showToast('Note updated');
                  }}
                  className="flex-[2] py-3 text-primary-foreground font-bold bg-primary hover:bg-primary/90 rounded-xl transition-colors disabled:opacity-50 shadow-md"
                  disabled={!noteEditVal.trim() && !resolvedUser.note}
                >
                  Share Thought
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

        {showPreviewModal && thoughtNote ? (
          <ThoughtViewOverlay
            user={resolvedUser}
            thought={thoughtNote}
            onClose={() => setShowPreviewModal(false)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

