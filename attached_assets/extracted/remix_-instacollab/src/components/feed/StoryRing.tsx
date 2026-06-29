import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Story } from '../../types';
import { X, Heart, Send, Volume2, VolumeX, Play, Pause, Share, Link, Copy, CheckCircle2, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ShareModal } from './ShareModal';
import { openProfilePreview, handleAvatarError, handleMediaError, fileToBase64 } from '../../lib/utils';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';

interface StoryRingProps {
  story: Story;
  isCurrentUser?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  hideRing?: boolean;
}

export function StoryRing({ story, isCurrentUser, isOpen = false, onClose, hideRing = false }: StoryRingProps) {
  const db = useDB();
  const { showToast } = useToast();
  const [showStory, setShowStory] = useState(isOpen);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setShowStory(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!showStory && onClose && isOpen) {
      onClose();
    }
  }, [showStory, onClose, isOpen]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [messageText, setMessageText] = useState('');
  const [isSent, setIsSent] = useState(false);
  const persistentSegments = db.getUserStorySegments(story.user.id);
  const createdStory = persistentSegments.length > 0;
  const [showHashtagList, setShowHashtagList] = useState(false);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const storyVideoRef = React.useRef<HTMLVideoElement>(null);
  
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [noteEditVal, setNoteEditVal] = useState('');
  
  const userFromDb = db.users.find(u => u.id === story.user.id) || story.user;

  useEffect(() => {
    if (showNoteModal) {
      setNoteEditVal(userFromDb.note || '');
    }
  }, [showNoteModal, userFromDb.note]);

  // Synchronize fullscreen active state in db so that background feed/reels videos pause
  useEffect(() => {
    if (showStory || showCreateStory) {
      db.setFullScreenActive(true);
    } else {
      db.setFullScreenActive(false);
    }
    return () => {
      if (showStory || showCreateStory) {
        db.setFullScreenActive(false);
      }
    };
  }, [showStory, showCreateStory]);
  
  const suggestedHashtags = ['#story', '#vibes', '#daily', '#now', '#mood', '#photography'];
  const suggestedMentions = ['@alex', '@sarah', '@design_guru', '@tech', '@bestie'];
  const [storyCreateStep, setStoryCreateStep] = useState<'select' | 'preview'>('select');
  const [draftMedia, setDraftMedia] = useState<{url: string, isVideo: boolean, caption?: string} | null>(null);
  
  const [likedSegments, setLikedSegments] = useState<Record<number, boolean>>({});
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  
  const segments = persistentSegments.length > 0 
    ? persistentSegments 
    : [
        { url: `https://images.unsplash.com/photo-1621252179027-94459d278660?w=400&fit=crop&sig=${story.id}-1`, isVideo: false },
        { url: `https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&fit=crop&sig=${story.id}-2`, isVideo: false },
        { url: `https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&fit=crop&sig=${story.id}-3`, isVideo: false },
      ];

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    setIsSent(true);
    setMessageText('');
    setIsPaused(false);
    setTimeout(() => setIsSent(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://instacollab.app/s/${story.user.username}?seg=${currentSegmentIndex}`);
    setCopied(true);
    showToast('Copied link to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-progress story
  useEffect(() => {
    if (!showStory || isPaused) return;
    
    // If current segment is a video, let video onTimeUpdate manage progress instead of timer.
    const isVideoSegment = segments[currentSegmentIndex]?.isVideo;
    if (isVideoSegment) return;

    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) return 100;
        return p + 2.5; // Controls the speed (total ~4 seconds per segment)
      });
    }, 100);
    return () => clearInterval(interval);
  }, [showStory, isPaused, currentSegmentIndex, segments]);

  // Handle segment completion
  useEffect(() => {
    if (progress >= 100) {
      if (currentSegmentIndex < segments.length - 1) {
        setCurrentSegmentIndex(c => c + 1);
        setProgress(0);
      } else {
        setShowStory(false);
        setProgress(0);
        setCurrentSegmentIndex(0);
      }
    }
  }, [progress, currentSegmentIndex, segments.length, showStory]);

  // Synchronize playing & pausing of story video
  useEffect(() => {
    if (storyVideoRef.current) {
      if (isPaused) {
        storyVideoRef.current.pause();
      } else {
        storyVideoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused, currentSegmentIndex, showStory]);

  const handleRingClick = () => {
    if (isCurrentUser && !createdStory && story.id === 'current') {
      setShowCreateStory(true);
    } else {
      setShowStory(true);
      setCurrentSegmentIndex(0);
      setProgress(0);
      setIsPaused(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const url = await fileToBase64(file);
        const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|ogg|m4v|avi|wmv)$/i.test(file.name);
        setDraftMedia({ url, isVideo });
        setStoryCreateStep('preview');
      } catch (err) {
        showToast('Error reading file');
      }
    }
  };
  
  const handleShareStory = () => {
    if (draftMedia) {
      db.addStorySegment(story.user.id, draftMedia);
      const updatedSegments = db.getUserStorySegments(story.user.id);
      const newIndex = updatedSegments.length - 1;
      setShowCreateStory(false);
      setShowStory(true);
      setCurrentSegmentIndex(Math.max(0, newIndex));
      setProgress(0);
      setIsPaused(false);
      setStoryCreateStep('select');
      setDraftMedia(null);
    }
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    fileInputRef.current?.click();
  };
  
  const DOUBLE_PRESS_DELAY = 300;
  const lastTapRef = React.useRef<number>(0);

  const handleTap = (direction: 'left' | 'right') => {
    const now = Date.now();
    if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_PRESS_DELAY) {
      // Double tap
      setLikedSegments(prev => ({
        ...prev,
        [currentSegmentIndex]: true
      }));
      lastTapRef.current = 0;
    } else {
      // Single tap - wait to see if it's a double tap
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current === now) {
          if (direction === 'left') {
            if (currentSegmentIndex > 0) {
              setCurrentSegmentIndex(i => i - 1);
              setProgress(0);
            } else {
              setProgress(0);
            }
          } else {
            if (currentSegmentIndex < segments.length - 1) {
              setCurrentSegmentIndex(i => i + 1);
              setProgress(0);
            } else {
              setShowStory(false);
              setProgress(0);
              setCurrentSegmentIndex(0);
            }
          }
        }
      }, DOUBLE_PRESS_DELAY);
    }
  };

  const toggleLike = () => {
    setLikedSegments(prev => ({
      ...prev,
      [currentSegmentIndex]: !prev[currentSegmentIndex]
    }));
  };

  return (
    <>
      {!hideRing && (
        <div 
          className="flex flex-col items-center gap-1 cursor-pointer w-[76px] shrink-0 group"
          onClick={handleRingClick}
        >
          <div className={`relative rounded-full p-[3px] transition-transform group-hover:scale-105 active:scale-95 ${story.hasViewed && !createdStory ? 'bg-secondary' : 'bg-gradient-to-tr from-accent via-primary to-orange-500'}`}>
            <div className="bg-background rounded-full p-[3px]">
              <div className="w-[60px] h-[60px] rounded-full overflow-hidden border border-border">
                <img 
                  src={story.user.avatarUrl || undefined} 
                  alt={story.user.username} 
                  className="w-full h-full object-cover" 
                  onError={handleAvatarError}
                />
              </div>
            </div>
            
            {isCurrentUser && (
              <div 
                onClick={(e) => {
                  if (createdStory) {
                    e.stopPropagation();
                    setShowCreateStory(true);
                  }
                }}
                className="absolute bottom-0 right-0 bg-primary hover:bg-primary/95 text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center border-2 border-background text-[14px] font-bold shadow-sm transition-transform hover:scale-110 active:scale-90"
                title="Add another story segment"
              >
                +
              </div>
            )}

            {/* Note Bubble */}
            {((userFromDb.note && userFromDb.note.trim() !== '') || isCurrentUser) && (() => {
              const hasSharedThought = !!(userFromDb.note && userFromDb.note.trim() !== '');
              
              if (!hasSharedThought && !isCurrentUser) return null;
              
              const noteText = hasSharedThought ? userFromDb.note : '';
              const noteLength = noteText ? noteText.length : 0;
              
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
                    } else if (hasSharedThought) {
                      setShowPreviewModal(true);
                    }
                  }}
                  className="absolute bottom-[85%] left-[70%] mb-[10px] w-[64px] h-[42px] z-30 transition-transform origin-bottom-left hover:scale-105 active:scale-95 cursor-pointer"
                >
                  {hasSharedThought ? (
                    <>
                      {/* Main glass bubble */}
                      <div 
                        className="flex justify-center items-center w-[64px] h-[42px] px-[8px] py-[3px] relative bg-white/70 dark:bg-zinc-800/80 backdrop-blur-md border-[1.5px] border-white/80 dark:border-white/10 shadow-[0_6px_12px_rgba(0,0,0,0.1),inset_0_3px_5px_rgba(255,255,255,0.9),inset_0_-1.5px_4px_rgba(0,0,0,0.05)] dark:shadow-[0_6px_12px_rgba(0,0,0,0.4),inset_0_3px_5px_rgba(255,255,255,0.05),inset_0_-1.5px_4px_rgba(0,0,0,0.2)] text-black dark:text-white animate-in zoom-in-50 duration-200"
                        style={{ 
                          borderRadius: '50%',
                        }}
                      >
                        <div className="absolute top-[2px] left-[5%] w-[90%] h-[35%] bg-gradient-to-b from-white/90 dark:from-white/10 to-transparent rounded-t-full pointer-events-none" />
                        <span className={`relative z-10 px-1 whitespace-normal break-words drop-shadow-md dark:drop-shadow-none text-center w-full leading-[1.05] font-black ${fontSizeClass}`}>
                          {userFromDb.note}
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
                    </>
                  ) : (
                    <>
                      {/* Quiet hollow + bubble for Current User's tray icon to set a thought */}
                      <div 
                        className="flex justify-center items-center w-[64px] h-[42px] px-[8px] py-[3px] relative bg-white/15 dark:bg-zinc-800/20 backdrop-blur-sm border-[1.5px] border-dashed border-black/25 dark:border-white/20 hover:bg-white/30 dark:hover:bg-zinc-800/40 hover:border-black/40 dark:hover:border-white/40 shadow-sm text-black/40 dark:text-white/40 transition-all duration-200"
                        style={{ 
                          borderRadius: '50%',
                        }}
                        title="Add a thought..."
                      >
                        <span className="text-[10px] font-bold select-none">+</span>
                      </div>

                      {/* Quiet Tail 1 */}
                      <div 
                        className="absolute bottom-[1px] left-[6px] w-2.5 h-2.5 pt-0 rounded-full border-[1.5px] border-dashed border-black/25 dark:border-white/20 z-[-1]"
                      />

                      {/* Quiet Tail 2 */}
                      <div 
                        className="absolute bottom-[-2px] left-[1px] w-1.5 h-1.5 rounded-full border-[1px] border-dashed border-black/20 dark:border-white/15 z-[-1]"
                      />
                    </>
                  )}
                </div>
              );
            })()}
          </div>
          <span className="text-[12px] font-medium truncate w-full text-center text-muted-foreground group-hover:text-foreground transition-colors">
            {isCurrentUser ? (createdStory ? 'Your story' : 'Add story') : story.user.username}
          </span>
        </div>
      )}

      <AnimatePresence>
        {showCreateStory && (
          <div id="story-create-modal" className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="relative w-full max-w-md h-full sm:h-[90vh] sm:rounded-3xl overflow-hidden bg-card border border-border shadow-2xl flex flex-col items-center justify-center"
             >
                <button onClick={(e) => { 
                  e.stopPropagation(); 
                  if (storyCreateStep === 'preview') {
                    setStoryCreateStep('select');
                    setDraftMedia(null);
                  } else {
                    setShowCreateStory(false); 
                  }
                }} className="absolute top-4 left-4 z-50 p-2 hover:bg-secondary rounded-full transition-colors text-foreground">
                  <X className="w-6 h-6 border border-border bg-background shadow-sm rounded-full" />
                </button>

                {storyCreateStep === 'select' ? (
                  <>
                    <div className="absolute inset-0 z-0 bg-gradient-to-b from-primary/10 to-transparent"></div>
                    <h2 className="relative z-10 text-foreground font-bold text-2xl mb-8">Add to your story</h2>
                    
                    <div className="relative z-10 flex gap-6">
                      <input type="file" accept="image/*,video/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleFileChange} />
                      <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                      <button onClick={handleCameraClick} className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors">
                           <Maximize2 className="w-6 h-6" />
                        </div>
                        <span className="text-foreground text-sm font-semibold">Camera</span>
                      </button>
                      <button onClick={handleGalleryClick} className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white hover:bg-primary/80 transition-colors">
                          <span className="text-2xl font-bold">+</span>
                        </div>
                        <span className="text-foreground text-sm font-semibold">Gallery</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
                      {draftMedia?.isVideo ? (
                        <video src={draftMedia.url || undefined} className="absolute inset-0 w-full h-full object-contain" autoPlay loop muted playsInline preload="auto" />
                      ) : (
                        <img src={draftMedia?.url || undefined} className="absolute inset-0 w-full h-full object-contain" alt="Draft" />
                      )}
                    </div>
                    <div className="absolute inset-x-0 bottom-24 p-4 z-10 flex justify-center">
                      <div className="w-full max-w-sm relative">
                        {showHashtagList && (
                          <div className="absolute bottom-full left-0 mb-2 w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50">
                            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-white/5">
                              <span className="text-xs font-bold text-white">Select Hashtags</span>
                              <button onClick={() => setShowHashtagList(false)} className="text-xs font-bold text-white hover:underline">Done</button>
                            </div>
                            <div className="p-3 flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar">
                              {suggestedHashtags.map(tag => {
                                const isSelected = (draftMedia?.caption || '').includes(tag);
                                return (
                                  <button 
                                    key={tag} 
                                    onClick={() => {
                                      setDraftMedia(prev => {
                                        if (!prev) return null;
                                        const currentCaption = prev.caption || '';
                                        if (isSelected) {
                                          return { ...prev, caption: currentCaption.replace(new RegExp(tag + '\\s*', 'g'), '').trim() };
                                        } else {
                                          return { ...prev, caption: (currentCaption.trim() + ' ' + tag).trim() + ' ' };
                                        }
                                      });
                                    }} 
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isSelected ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                                  >
                                    {tag}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {showMentionList && (
                          <div className="absolute bottom-full left-0 mb-2 w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col">
                            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-white/5 shrink-0">
                              <span className="text-xs font-bold text-white">Mention Creators</span>
                              <button onClick={() => { setShowMentionList(false); setMentionSearch(''); }} className="text-xs font-bold text-white hover:underline">Done</button>
                            </div>
                            <div className="p-2 border-b border-white/10 shrink-0">
                              <input 
                                type="text"
                                value={mentionSearch}
                                onChange={(e) => setMentionSearch(e.target.value)}
                                placeholder="Search creators..."
                                className="w-full text-xs bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 outline-none font-medium focus:border-white text-white reference:none"
                              />
                            </div>
                            <div className="p-1 flex flex-col gap-1 max-h-44 overflow-y-auto no-scrollbar text-white">
                              {(() => {
                                const dbUsers = db.users;
                                const filteredDbUsers = dbUsers.filter(u => 
                                  u.username.toLowerCase().includes(mentionSearch.toLowerCase()) || 
                                  (u.displayName && u.displayName.toLowerCase().includes(mentionSearch.toLowerCase()))
                                );
                                
                                const hasExactMatch = dbUsers.some(u => u.username.toLowerCase() === mentionSearch.toLowerCase().replace('@', ''));
                                const showCustomAdd = mentionSearch.trim().length > 0 && !hasExactMatch;

                                return (
                                  <>
                                    {filteredDbUsers.map(u => {
                                      const handle = '@' + u.username;
                                      const isSelected = (draftMedia?.caption || '').includes(handle);
                                      return (
                                        <button 
                                          key={u.id}
                                          onClick={() => {
                                            setDraftMedia(prev => {
                                              if (!prev) return null;
                                              const currentCaption = prev.caption || '';
                                              if (isSelected) {
                                                return { ...prev, caption: currentCaption.replace(new RegExp(handle + '\\s*', 'g'), '').trim() };
                                              } else {
                                                return { ...prev, caption: (currentCaption.trim() + ' ' + handle).trim() + ' ' };
                                              }
                                            });
                                          }}
                                          className={`flex items-center gap-2.5 w-full p-2 rounded-lg text-left transition-colors ${isSelected ? 'bg-white/25 hover:bg-white/30' : 'hover:bg-white/5'}`}
                                        >
                                          <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-white/10">
                                            <img src={u.avatarUrl || undefined} alt={u.username} className="w-full h-full object-cover" onError={handleAvatarError} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                                              {u.username}
                                              {u.isVerified && <span className="text-blue-400">✓</span>}
                                            </div>
                                            <div className="text-[10px] text-white/50 truncate">{u.displayName}</div>
                                          </div>
                                          {isSelected && (
                                            <div className="w-4 h-4 rounded-full bg-white text-black flex items-center justify-center text-[10px] font-black">✓</div>
                                          )}
                                        </button>
                                      );
                                    })}
                                    
                                    {showCustomAdd && (
                                      <button 
                                        onClick={() => {
                                          const handle = '@' + mentionSearch.replace('@', '').trim();
                                          setDraftMedia(prev => {
                                            if (!prev) return null;
                                            return { ...prev, caption: ((prev.caption || '').trim() + ' ' + handle).trim() + ' ' };
                                          });
                                          setMentionSearch('');
                                        }}
                                        className="flex items-center gap-2.5 w-full p-2 rounded-lg text-left hover:bg-white/10 border border-dashed border-white/20"
                                      >
                                        <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center text-xs font-bold">@</div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs font-bold text-white">Mention custom user</div>
                                          <div className="text-[10px] text-white/50 truncate">@{mentionSearch.replace('@', '').trim()}</div>
                                        </div>
                                      </button>
                                    )}
                                    
                                    {filteredDbUsers.length === 0 && !showCustomAdd && (
                                      <div className="p-4 text-center text-xs text-white/50 font-semibold">
                                        No creators found. Type to mention.
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                        <div className="w-full flex items-center bg-secondary rounded-full border border-border p-1 pl-4 focus-within:ring-2 focus-within:ring-primary transition-all">
                          <input 
                            type="text" 
                            placeholder="Add a caption..." 
                            value={draftMedia?.caption || ''}
                            onChange={(e) => setDraftMedia(prev => prev ? { ...prev, caption: e.target.value } : null)}
                            className="flex-1 min-w-0 bg-transparent text-white placeholder:text-white/70 outline-none text-center h-10"
                          />
                          <div className="flex items-center gap-1 shrink-0 px-2">
                            <button onClick={() => {
                              setShowHashtagList(!showHashtagList);
                              setShowMentionList(false);
                            }} className={`w-8 h-8 rounded-full text-white font-bold flex items-center justify-center transition-colors ${showHashtagList ? 'bg-white/30' : 'hover:bg-white/20'}`}>#</button>
                            <button onClick={() => {
                              setShowMentionList(!showMentionList);
                              setShowHashtagList(false);
                            }} className={`w-8 h-8 rounded-full text-white font-bold flex items-center justify-center transition-colors ${showMentionList ? 'bg-white/30' : 'hover:bg-white/20'}`}>@</button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-6 right-6 z-10">
                      <button onClick={handleShareStory} className="px-6 py-3 bg-white text-black rounded-full font-bold shadow-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
                        Share <Send className="w-4 h-4 ml-2" />
                      </button>
                    </div>
                  </>
                )}
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStory && (
          <div id="story-modal" className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="relative w-full max-w-md h-full sm:h-[90vh] sm:rounded-3xl overflow-hidden bg-card border border-border flex flex-col shadow-2xl"
             >
                {/* Story Image */}
                <div 
                  className="absolute inset-0 z-0" 
                  onPointerDown={() => setIsPaused(true)}
                  onPointerUp={() => setIsPaused(false)}
                  onPointerLeave={() => setIsPaused(false)}
                >
                  <img src={story.user.avatarUrl || undefined} alt="Story" className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30" onError={handleAvatarError} />
                  {segments[currentSegmentIndex].isVideo ? (
                    <video 
                      ref={storyVideoRef}
                      src={segments[currentSegmentIndex].url || undefined} 
                      className="absolute inset-0 w-full h-full object-contain" 
                      autoPlay 
                      playsInline 
                      muted={db.globalMuted}
                      onVolumeChange={(e) => {
                        db.setGlobalMuted(e.currentTarget.muted);
                      }}
                      onPlay={() => setIsPaused(false)}
                      onPause={() => setIsPaused(true)}
                      controls
                      preload="auto"
                      onTimeUpdate={(e) => {
                        const video = e.currentTarget;
                        if (video.duration) {
                          setProgress((video.currentTime / video.duration) * 100);
                        }
                      }}
                      onEnded={() => {
                        setProgress(100);
                      }}
                      onLoadedMetadata={(e) => {
                        e.currentTarget.playbackRate = playbackSpeed;
                      }}
                      onPointerDown={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const touchY = e.clientY - rect.top;
                        if (touchY > rect.height - 60) {
                          e.stopPropagation();
                        }
                      }}
                      onPointerUp={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const touchY = e.clientY - rect.top;
                        if (touchY > rect.height - 60) {
                          e.stopPropagation();
                        }
                      }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickY = e.clientY - rect.top;
                        if (clickY > rect.height - 60) {
                          e.stopPropagation();
                        }
                      }}
                    />
                  ) : (
                    <img src={segments[currentSegmentIndex].url || undefined} alt="Story content" className="absolute inset-0 w-full h-full object-contain" onError={handleMediaError} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/60 pointer-events-none"></div>
                  
                  {/* Big animated heart on like */}
                  <AnimatePresence>
                    {likedSegments[currentSegmentIndex] && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.5, y: 0 }}
                        animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 1.5], y: -100 }}
                        transition={{ duration: 1 }}
                        className="absolute inset-0 m-auto w-32 h-32 text-red-500 drop-shadow-2xl flex items-center justify-center pointer-events-none"
                      >
                         <Heart className="w-full h-full fill-current" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Caption Display */}
                {segments[currentSegmentIndex]?.caption && (
                  <div className="absolute inset-x-0 bottom-24 p-6 z-10 flex justify-center pointer-events-none">
                    <div className="bg-card px-6 py-3 rounded-full border border-border shadow-lg">
                      <span className="text-foreground font-medium text-center block text-sm">
                        {segments[currentSegmentIndex].caption}
                      </span>
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                <div className="relative z-10 w-full pt-4 px-4 flex gap-1 pb-4">
                  {segments.map((_, idx) => (
                    <div key={idx} className="h-1 bg-foreground/20 rounded-full flex-1 overflow-hidden">
                      <div 
                        className="h-full bg-foreground rounded-full transition-all" 
                        style={{ 
                          width: idx < currentSegmentIndex ? '100%' : idx === currentSegmentIndex ? `${progress}%` : '0%',
                          transitionDuration: idx === currentSegmentIndex ? '100ms' : '0ms',
                          transitionTimingFunction: 'linear'
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Header */}
                <div className="relative z-10 px-4 flex items-center justify-between pointer-events-none">
                   <div 
                     className="flex items-center gap-3 pointer-events-auto cursor-pointer"
                     onClick={(e) => {
                       e.stopPropagation();
                       setShowStory(false);
                       openProfilePreview(story.user);
                     }}
                   >
                     <div className="w-10 h-10 rounded-full overflow-hidden border border-border">
                       <img src={story.user.avatarUrl || undefined} alt="user" className="w-full h-full object-cover" onError={handleAvatarError} />
                     </div>
                     <span className="text-foreground font-bold text-sm drop-shadow-sm">{story.user.username}</span>
                     <span className="text-muted-foreground text-xs font-semibold">
                       {2 + currentSegmentIndex}h
                     </span>
                   </div>
                   
                   <div className="flex items-center gap-1.5 pointer-events-auto">
                     {segments[currentSegmentIndex].isVideo && (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
                              setPlaybackSpeed(nextSpeed);
                              if (storyVideoRef.current) {
                                storyVideoRef.current.playbackRate = nextSpeed;
                              }
                            }}
                            className="px-2 py-1 bg-secondary hover:bg-secondary/80 rounded text-[11px] font-black tracking-wider text-foreground select-none transition-colors mr-1"
                            title="Playback Speed"
                          >
                            {playbackSpeed}x
                          </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); setIsPaused(!isPaused); }} 
                           className="p-2 hover:bg-secondary rounded-full transition-colors text-foreground"
                           title={isPaused ? "Play" : "Pause"}
                         >
                           {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
                         </button>
                         
                         <button 
                           onClick={(e) => { e.stopPropagation(); db.setGlobalMuted(!db.globalMuted); }} 
                           className="p-2 hover:bg-secondary rounded-full transition-colors text-foreground"
                           title={db.globalMuted ? "Unmute" : "Mute"}
                         >
                           {db.globalMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                         </button>

                         <button 
                           onClick={(e) => { 
                             e.stopPropagation(); 
                             if (storyVideoRef.current) {
                               const video = storyVideoRef.current;
                               if (video.requestFullscreen) {
                                 video.requestFullscreen().catch(err => console.error(err));
                               } else if ((video as any).webkitEnterFullscreen) {
                                 (video as any).webkitEnterFullscreen();
                               }
                             }
                           }} 
                           className="p-2 hover:bg-secondary rounded-full transition-colors text-foreground"
                           title="Fullscreen"
                         >
                           <Maximize2 className="w-5 h-5" />
                         </button>
                       </>
                     )}
                     <button 
                       onClick={(e) => { e.stopPropagation(); setShowStory(false); }} 
                       className="p-2 hover:bg-secondary rounded-full transition-colors text-foreground"
                     >
                       <X className="w-6 h-6 border border-border bg-background shadow-sm rounded-full" />
                     </button>
                   </div>
                </div>

                {/* Tap zones for manual navigation */}
                <div className="flex-1 flex w-full relative z-10 mb-16">
                   <div className="flex-1" onClick={() => handleTap('left')}></div>
                   <div className="flex-[2]" onClick={() => handleTap('right')}></div>
                </div>

                {/* Footer */}
                <form onSubmit={sendMessage} className="relative z-10 p-4 pb-safe flex items-center gap-3">
                   <div className="flex-1 border border-border rounded-full px-4 py-3 bg-card relative flex items-center gap-2 shadow-sm">
                     <input 
                       type="text" 
                       value={messageText}
                       onChange={e => setMessageText(e.target.value)}
                       onFocus={() => setIsPaused(true)}
                       onBlur={() => setIsPaused(false)}
                       placeholder={isSent ? "Sent!" : "Send message..."} 
                       className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-[15px] font-medium min-w-0" 
                     />
                     {messageText.trim().length > 0 && (
                       <button type="submit" className="text-primary font-bold text-sm shrink-0 hover:opacity-70 transition-opacity">
                         Send
                       </button>
                     )}
                   </div>
                   <button 
                     type="button" 
                     onClick={toggleLike}
                     className="p-2 hover:bg-secondary rounded-full transition-colors text-foreground"
                   >
                     <Heart className={`w-7 h-7 ${likedSegments[currentSegmentIndex] ? 'fill-red-500 text-red-500 stroke-red-500' : 'stroke-foreground'}`} />
                   </button>
                   <button 
                     type="button"
                     onClick={(e) => {
                       e.stopPropagation();
                       setIsPaused(true);
                       setShowShareModal(true);
                     }}
                     className="p-2 hover:bg-secondary rounded-full transition-colors text-foreground active:scale-95 transition-transform"
                     title="Share story"
                   >
                     <Send className="w-7 h-7 -mt-1 ml-1" />
                   </button>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ShareModal
        isOpen={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setIsPaused(false);
        }}
        shareUrl={`https://instacollab.app/s/${story.user.username}?seg=${currentSegmentIndex}`}
        itemTitle="Share Story"
        shareText={`Shared @${story.user.username}'s story segment`}
      />

      <AnimatePresence>
        {showNoteModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
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
                      showToast('Note deleted');
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
                    showToast('Note updated');
                  }}
                  className="flex-[2] py-3 text-primary-foreground font-bold bg-primary hover:bg-primary/90 rounded-xl transition-colors disabled:opacity-50"
                  disabled={!noteEditVal.trim() && !userFromDb.note}
                >
                  Share Thought
                </button>
              </div>
            </motion.div>
          </div>
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

