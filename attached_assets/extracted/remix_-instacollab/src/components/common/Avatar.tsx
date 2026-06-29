import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../../types';
import { handleAvatarError } from '../../lib/utils';
import { useDB } from '../../lib/useDB';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../../lib/ToastContext';

interface AvatarProps {
  user: User;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  hideNote?: boolean;
}

export function Avatar({ user, size = 'md', className = '', onClick, hideNote = false }: AvatarProps) {
  const db = useDB();
  const { showToast } = useToast();
  const sizeClasses = {
    sm: 'w-9 h-9',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const hasRing = user.status && user.status !== 'none';
  const isLive = user.status === 'live';
  const isStory = user.status === 'story';
  
  const userFromDb = db.users?.find(u => u.id === user.id) || user;
  const isCurrentUser = db.currentUser?.id === user.id;

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [noteEditVal, setNoteEditVal] = useState('');

  useEffect(() => {
    if (showNoteModal) {
      setNoteEditVal(userFromDb.note || '');
    }
  }, [showNoteModal, userFromDb.note]);

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
      window.dispatchEvent(new CustomEvent('open-story', { detail: { userId: user.id } }));
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
        className={`relative ${sizeClasses[size]} ${className} shrink-0 cursor-pointer`}
        onClick={handleClick}
      >
        {hasRing && (
          <div className={`absolute -inset-[3px] rounded-full bg-gradient-to-tr ${ringColor} ${isLive ? 'animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'shadow-[0_0_8px_rgba(255,165,0,0.4)]'}`} />
        )}
        <div className="absolute inset-0 bg-background rounded-full border border-border p-[2px]">
          <img
            src={user.avatarUrl || undefined}
            alt={user.username}
            className="w-full h-full rounded-full object-cover relative z-10"
            onError={handleAvatarError}
          />
        </div>
        {isLive && (
          <div className="absolute -bottom-2 inset-x-0 flex justify-center z-20">
            <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">LIVE</span>
          </div>
        )}

        {/* Thought Bubble Note */}
        {!hideNote && userFromDb.note && userFromDb.note.trim() !== '' && size !== 'sm' && (() => {
          const noteText = userFromDb.note;
          const noteLength = noteText.length;
          
          const fontSizeClass = noteLength > 45 
            ? 'text-[7.5px] tracking-tight line-clamp-3' 
            : noteLength > 30 
              ? 'text-[8px] tracking-tight line-clamp-3' 
              : noteLength > 15 
                ? 'text-[8.5px] line-clamp-2' 
                : 'text-[9px] line-clamp-2';

          return (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (isCurrentUser) {
                  setShowNoteModal(true);
                } else {
                  setShowPreviewModal(true);
                }
              }}
              className="absolute bottom-[85%] left-[70%] mb-[10px] w-[64px] h-[42px] z-30 transition-transform origin-bottom-left hover:scale-105 active:scale-95 cursor-pointer"
            >
              {/* Main glass bubble */}
              <div 
                className="flex justify-center items-center w-[64px] h-[42px] px-[8px] py-[3px] relative bg-white/70 dark:bg-zinc-800/80 backdrop-blur-md border-[1.5px] border-white/80 dark:border-white/10 shadow-[0_6px_12px_rgba(0,0,0,0.1),inset_0_3px_5px_rgba(255,255,255,0.9),inset_0_-1.5px_4px_rgba(0,0,0,0.05)] dark:shadow-[0_6px_12px_rgba(0,0,0,0.4),inset_0_3px_5px_rgba(255,255,255,0.05),inset_0_-1.5px_4px_rgba(0,0,0,0.2)] text-black dark:text-white animate-in zoom-in-50 duration-200"
                style={{ 
                  borderRadius: '50%',
                }}
              >
                <div className="absolute top-[2px] left-[5%] w-[90%] h-[35%] bg-gradient-to-b from-white/90 dark:from-white/10 to-transparent rounded-t-full pointer-events-none" />
                <span className={`relative z-10 px-1 whitespace-normal break-words drop-shadow-md dark:drop-shadow-none text-center w-full leading-[1.05] font-black ${fontSizeClass}`}>
                  {noteText}
                </span>
              </div>

              {/* Tail 1 */}
              <div 
                className="absolute bottom-[1px] left-[6px] w-2.5 h-2.5 pt-0 rounded-full bg-white/70 dark:bg-zinc-800/80 backdrop-blur-md border-[1.5px] border-white/80 dark:border-white/10 shadow-[0_4px_8px_rgba(0,0,0,0.08),inset_0_2px_3px_rgba(255,255,255,0.9)] dark:shadow-[0_4px_8px_rgba(0,0,0,0.4),inset_0_2px_3px_rgba(255,255,255,0.05)] z-[-1]"
              >
                <div className="absolute top-[1px] left-[1px] w-[70%] h-[40%] bg-gradient-to-b from-white/90 dark:from-white/10 to-transparent rounded-full pointer-events-none" />
              </div>

              {/* Tail 2 */}
              <div 
                className="absolute bottom-[-2px] left-[1px] w-1.5 h-1.5 rounded-full bg-white/60 dark:bg-zinc-800/60 backdrop-blur-sm border-[1px] border-white/80 dark:border-white/10 z-[-1]"
              />
            </div>
          );
        })()}
      </div>

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
                      maxLength={60}
                      value={noteEditVal}
                      onChange={e => setNoteEditVal(e.target.value)}
                      placeholder="Share a thought..."
                      className="w-full h-[65px] bg-transparent border-none text-center flex items-center justify-center text-[13px] font-black tracking-tight outline-none placeholder:text-black/40 dark:placeholder:text-white/40 overflow-hidden z-10 drop-shadow-md dark:drop-shadow-none leading-tight px-6 py-2 text-black dark:text-white resize-none"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          db.updateUser(userFromDb.id, u => ({ ...u, note: noteEditVal.trim() }));
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
                    <img src={userFromDb.avatarUrl} className="w-full h-full rounded-full object-cover" />
                  </div>
                </div>
              </div>
              
              <div className="p-4 flex gap-2">
                {userFromDb.note && (
                  <button 
                    onClick={() => {
                      db.updateUser(userFromDb.id, u => ({ ...u, note: '' }));
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
                    db.updateUser(userFromDb.id, u => ({ ...u, note: noteEditVal.trim() }));
                    setShowNoteModal(false);
                    if (showToast) showToast('Note updated');
                  }}
                  className="flex-[2] py-3 text-primary-foreground font-bold bg-primary hover:bg-primary/90 rounded-xl transition-colors disabled:opacity-50 shadow-md"
                  disabled={!noteEditVal.trim() && !userFromDb.note}
                >
                  Share Thought
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

        {showPreviewModal && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card w-full max-w-[320px] rounded-[24px] border border-border shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <span className="font-bold text-lg">{userFromDb.username}'s Thought</span>
                <button onClick={() => setShowPreviewModal(false)} className="p-1 hover:bg-secondary rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 pb-6 flex flex-col items-center">
                {/* Centered Thought Bubble */}
                <div className="relative w-[185px] h-[115px] mb-8 select-none flex items-center justify-center">
                  {/* Main glass bubble */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center p-6 bg-white/70 dark:bg-zinc-800/80 backdrop-blur-xl border-[1.5px] border-white/80 dark:border-white/10 text-black dark:text-white shadow-[0_16px_32px_rgba(0,0,0,0.15),inset_0_6px_12px_rgba(255,255,255,0.9),inset_0_-4px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.4),inset_0_6px_12px_rgba(255,255,255,0.05),inset_0_-4px_10px_rgba(0,0,0,0.3)] w-full h-full"
                    style={{ 
                      borderRadius: '50%',
                    }}
                  >
                    <div className="absolute top-[2px] left-[5%] w-[90%] h-[35%] bg-gradient-to-b from-white/90 dark:from-white/10 to-transparent rounded-t-full pointer-events-none" />
                    
                    <span className="text-[13px] font-black tracking-tight text-center text-black dark:text-white leading-tight px-4 max-h-[75px] overflow-y-auto break-words select-text">
                      {userFromDb.note}
                    </span>
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
                    <img src={userFromDb.avatarUrl} className="w-full h-full rounded-full object-cover" />
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-border">
                <button 
                  onClick={() => setShowPreviewModal(false)}
                  className="w-full py-3 text-foreground font-bold bg-secondary hover:bg-secondary/80 rounded-xl transition-colors shadow-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>
    </>
  );
}

