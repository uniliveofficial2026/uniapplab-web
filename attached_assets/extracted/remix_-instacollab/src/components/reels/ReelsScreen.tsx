import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Send, MoreHorizontal, FileVideo, X, Bookmark, Play, VolumeX, Volume2, Maximize2 } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../../lib/ToastContext';

import { ShareModal } from '../feed/ShareModal';
import { Avatar } from '../common/Avatar';
import { formatMentionsAndTags, openProfilePreview, handleAvatarError, handleMediaError, getFontClass, getAlignClass } from '../../lib/utils';

export function ReelsScreen() {
  const db = useDB();
  const USERS = db.users;
  const { showToast } = useToast();

  const REELS = db.reels;

  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current) return;
      const index = Math.round(scrollRef.current.scrollTop / scrollRef.current.clientHeight);
      if (index !== activeReelIndex) {
        setActiveReelIndex(index);
      }
    };
    
    const node = scrollRef.current;
    if (node) {
      node.addEventListener('scroll', handleScroll);
      return () => node.removeEventListener('scroll', handleScroll);
    }
  }, [activeReelIndex]);

  return (
    <div className="w-full h-full flex flex-col items-center bg-background overflow-hidden relative">
      <div 
        ref={scrollRef}
        className={`w-full max-w-[470px] h-full overflow-y-auto no-scrollbar snap-y snap-mandatory border-x border-zinc-800 ${isCommentsOpen ? '!overflow-hidden !snap-none' : ''}`}
      >
          {REELS.map((reel, index) => (
            <ReelItem 
              key={reel.id} 
              reel={reel} 
              isActive={index === activeReelIndex} 
              db={db} 
              USERS={USERS} 
              isCommentsOpen={index === activeReelIndex && isCommentsOpen}
              setIsCommentsOpen={setIsCommentsOpen}
              showToast={showToast}
              onUserClick={(user) => openProfilePreview(user)}
            />
         ))}
      </div>
    </div>
  );
}

function ReelItem({ reel, isActive, db, USERS, isCommentsOpen, setIsCommentsOpen, showToast, onUserClick }: { reel: any, isActive: boolean, db: any, USERS: any[], isCommentsOpen: boolean, setIsCommentsOpen: (open: boolean) => void, showToast: (msg: string) => void, onUserClick: (user: any) => void }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isLiked = reel?.isLiked || false;
  const isSaved = reel?.isSaved || false;
  const isFollowing = reel?.user?.isFollowing || false;

  // Handle playing & pausing the active reel based on isActive, isPlaying, and db.isFullScreenActive
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const shouldBePlaying = isActive && isPlaying && !db.isFullScreenActive;
    
    if (shouldBePlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!shouldBePlaying && !video.paused) {
      video.pause();
    }
  }, [isActive, isPlaying, db.isFullScreenActive]);

  const handleFollowToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reel?.user?.id) {
      db.updateUser(reel.user.id, (u: any) => ({ ...u, isFollowing: !u.isFollowing }));
    }
  };
  
  const [showShareModal, setShowShareModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  
  const localComments = db?.reelComments?.[reel?.id] || [];

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    db.addReelComment(reel.id, {username: db.currentUser.username, text: commentText, avatarUrl: db.currentUser.avatarUrl});
    setCommentText('');
  };

  const handleReelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
  };
  
  return (
    <div className={`w-full h-full relative snap-start snap-always overflow-hidden group ${reel.color}`}>
        {/* Backdrop (Color or Video) */}
        {reel.videoUrl ? (
          <div className="absolute inset-0 w-full h-full cursor-pointer z-0" onClick={handleReelClick}>
            <video 
              ref={videoRef}
              src={reel.videoUrl || undefined} 
              preload="auto" 
              autoPlay={isActive} 
              loop 
              playsInline 
              muted={db.globalMuted} 
              onVolumeChange={(e) => {
                db.setGlobalMuted(e.currentTarget.muted);
              }}
              style={{ filter: `${reel.filter === 'grayscale' ? 'grayscale(100%)' : reel.filter === 'sepia' ? 'sepia(100%)' : reel.filter === 'blur' ? 'blur(4px)' : reel.filter === 'noir' ? 'grayscale(100%) contrast(140%) brightness(90%)' : reel.filter === 'vintage' ? 'sepia(80%) hue-rotate(-10deg) saturate(120%)' : reel.filter === 'sunset' ? 'saturate(150%) hue-rotate(15deg) sepia(20%)' : reel.filter === 'cold' ? 'hue-rotate(180deg) saturate(110%) contrast(110%)' : reel.filter === 'chrome' ? 'contrast(150%) saturate(140%)' : 'none'} brightness(${reel.brightness ?? 100}%) contrast(${reel.contrast ?? 100}%)` }} 
              className="absolute inset-0 w-full h-full object-cover z-10" 
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickY = e.clientY - rect.top;
                if (clickY > rect.height - 60) {
                  e.stopPropagation();
                }
              }}
            />
            {/* Play/Pause overlay indicator */}
            {!isPlaying && (
              <div className="absolute top-0 left-0 right-0 bottom-[60px] flex items-center justify-center bg-black/20 cursor-pointer z-10" onClick={(e) => { e.stopPropagation(); handleReelClick(e); }}>
                <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center shadow-lg transition-transform scale-100 animate-in zoom-in-75 duration-100">
                  <Play className="w-8 h-8 text-white fill-white ml-1" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className={`w-32 h-32 rounded-full border-4 border-white/5 flex items-center justify-center transition-transform duration-1000 ${isActive ? 'scale-150 opacity-100' : 'scale-50 opacity-0'}`}>
               <FileVideo className="w-16 h-16 text-white/10" />
             </div>
          </div>
        )}

        {/* Gradient overlays */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/40 to-transparent pointer-events-none"></div>
        <div className="absolute bottom-0 inset-x-0 h-64 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none"></div>

        {/* Content */}
        {reel.textOverlay?.trim() && (
          <div 
            style={{ 
              color: reel.textOverlayColor || '#ffffff', 
              fontSize: `${reel.textOverlaySize || 22}px`,
              top: `${reel.textOverlayPos ?? 50}%`,
              textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)'
            }} 
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center font-black tracking-tight pointer-events-none z-20 select-none px-4 py-1.5 rounded bg-black/40 backdrop-blur-[2px] border border-white/10"
          >
            {reel.textOverlay}
          </div>
        )}
        <div className="absolute bottom-0 left-0 w-full p-4 pr-16 z-10 pointer-events-none">
          <div className="flex items-center gap-3 mb-3 pointer-events-auto">
             <Avatar user={reel?.user} size="sm" className="w-10 h-10" />
             <span className="text-white font-bold text-[15px] cursor-pointer hover:underline shadow-black drop-shadow-md" onClick={(e) => { e.stopPropagation(); if (reel?.user) openProfilePreview(reel.user); }}>{reel?.user?.username || 'Unknown User'}</span>
             {reel?.user?.id !== db?.currentUser?.id && (
               <button 
                 onClick={handleFollowToggle}
                 className={`border-2 text-white rounded-lg px-4 py-1 text-[13px] font-bold transition-colors backdrop-blur-sm ${isFollowing ? 'border-transparent bg-white/20' : 'border-white/80 hover:bg-white hover:text-black'}`}>
                 {isFollowing ? 'Following' : 'Follow'}
               </button>
             )}
          </div>
          <p 
            className={`${getFontClass(reel.font)} ${getAlignClass(reel.alignment)} ${reel.size || 'text-[14px]'} ${reel.color || 'text-white'} leading-tight shadow-black drop-shadow-md mb-3 pointer-events-auto`}
          >
            {formatMentionsAndTags(reel.caption)}
          </p>
          <div className="flex items-center gap-2 text-white/90 text-xs font-bold px-3 py-1.5 bg-black/30 rounded-full w-max backdrop-blur-md pointer-events-auto">
             <MusicIcon className="w-3 h-3 animate-pulse" />
             <span className="marquee-text overflow-hidden max-w-[150px] whitespace-nowrap">{reel.audioUrl}</span>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="absolute bottom-4 right-2 flex flex-col items-center gap-5 text-white z-20 pb-safe">
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                db.updateReel(reel.id, (r: any) => ({ ...r, isLiked: !r.isLiked, likes: r.isLiked ? (r.likes || 0) - 1 : (r.likes || 0) + 1 })); 
              }}
              className="flex flex-col items-center gap-1 hover:opacity-80 transition-transform active:scale-90"
            >
                <div className="p-2.5 bg-black/20 rounded-full backdrop-blur-sm">
                  <Heart 
                    fill={reel.isLiked ? 'currentColor' : 'none'}
                    className={`w-7 h-7 ${reel.isLiked ? 'text-red-500 stroke-red-500' : 'stroke-white stroke-[2px] text-transparent'}`} 
                  />
                </div>
                <span className="text-[12px] font-bold drop-shadow-md">{(reel?.likes || 0).toLocaleString()}</span>
            </button>
            <button 
              onClick={() => setIsCommentsOpen(true)}
              className="flex flex-col items-center gap-1 hover:opacity-80 transition-transform active:scale-90"
            >
                <div className="p-2.5 bg-black/20 rounded-full backdrop-blur-sm">
                  <MessageCircle className="w-7 h-7 stroke-[2px] stroke-white" />
                </div>
                <span className="text-[12px] font-bold drop-shadow-md">{(reel?.comments || 0).toLocaleString()}</span>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowShareModal(true); }}
              className="flex flex-col items-center gap-1 hover:opacity-80 transition-transform active:scale-90"
            >
                <div className="p-2.5 bg-black/20 rounded-full backdrop-blur-sm">
                  <Send className="w-7 h-7 stroke-[2px] stroke-white -ml-1 mt-1" />
                </div>
                <span className="text-[12px] font-bold drop-shadow-md">{(reel?.shares || 0).toLocaleString()}</span>
            </button>
            <button 
                onClick={(e) => {
                  e.stopPropagation();
                  db.updateReel(reel.id, (r: any) => ({ ...r, isSaved: !r.isSaved }));
                }}
                className="flex flex-col items-center gap-1 hover:opacity-80 transition-transform active:scale-90"
            >
                <div className="p-2.5 bg-black/20 rounded-full backdrop-blur-sm">
                  <Bookmark 
                    fill={reel.isSaved ? 'currentColor' : 'none'}
                    className={`w-6 h-6 stroke-[2px] ${reel.isSaved ? 'text-white' : 'stroke-white text-transparent'}`} 
                  />
                </div>
            </button>
            <button 
                onClick={(e) => {
                  e.stopPropagation();
                  db.setGlobalMuted(!db.globalMuted);
                }}
                className="flex flex-col items-center gap-1 hover:opacity-80 transition-transform active:scale-90"
                title={db.globalMuted ? "Unmute" : "Mute"}
            >
                <div className="p-2.5 bg-black/20 rounded-full backdrop-blur-sm">
                  {db.globalMuted ? (
                    <VolumeX className="w-6 h-6 stroke-[2px] stroke-white" />
                  ) : (
                    <Volume2 className="w-6 h-6 stroke-[2px] stroke-white" />
                  )}
                </div>
            </button>
            <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (videoRef.current) {
                    const video = videoRef.current;
                    if (video.requestFullscreen) {
                      video.requestFullscreen().catch(err => console.error(err));
                    } else if ((video as any).webkitEnterFullscreen) {
                      (video as any).webkitEnterFullscreen();
                    }
                  }
                }}
                className="flex flex-col items-center gap-1 hover:opacity-80 transition-transform active:scale-90"
                title="Fullscreen"
            >
                <div className="p-2.5 bg-black/20 rounded-full backdrop-blur-sm">
                  <Maximize2 className="w-6 h-6 stroke-[2px] stroke-white" />
                </div>
            </button>
            <div className="relative">
              <button 
                  onClick={(e) => { e.stopPropagation(); setShowOptionsModal(!showOptionsModal); }}
                  className="flex flex-col items-center gap-1 hover:opacity-80 transition-transform active:scale-90 mt-2 relative z-10"
              >
                  <MoreHorizontal className="w-6 h-6 stroke-white" />
              </button>
              
              <AnimatePresence>
                {showOptionsModal && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowOptionsModal(false); }}></div>
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, x: 10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95, x: 10 }}
                      className="absolute right-full bottom-0 mb-0 mr-4 w-48 bg-background/80 backdrop-blur-xl border border-border rounded-xl flex flex-col z-50 shadow-2xl overflow-hidden"
                    >
                      {reel.user?.id === db.currentUser?.id ? (
                        <button onClick={(e) => { e.stopPropagation(); setShowOptionsModal(false); db.deleteReel(reel.id); showToast('Reel deleted'); }} className="w-full text-left px-4 py-3 text-red-500 font-medium text-sm hover:bg-secondary transition-colors cursor-pointer border-b border-border">Delete Reel</button>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setShowOptionsModal(false); showToast('Reel reported'); }} className="w-full text-left px-4 py-3 text-red-500 font-medium text-sm hover:bg-secondary transition-colors cursor-pointer border-b border-border">Report</button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setShowOptionsModal(false); db.updateReel(reel.id, (r: any) => ({ ...r, isSaved: true })); showToast('Added to favorites'); }} className="w-full text-left px-4 py-3 text-foreground font-medium text-sm hover:bg-secondary transition-colors border-b border-border">Add to favorites</button>
                      <button onClick={(e) => { e.stopPropagation(); setShowOptionsModal(false); navigator.clipboard.writeText(`https://instacollab.app/r/${reel.id}`); showToast('Link copied'); }} className="w-full text-left px-4 py-3 text-foreground font-medium text-sm hover:bg-secondary transition-colors">Copy link</button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white mt-4 flex items-center justify-center bg-zinc-900 group cursor-pointer relative animate-[spin_3s_linear_infinite]">
                <img src={reel?.user?.avatarUrl || undefined} alt="audio" className={`w-full h-full object-cover`} onError={handleAvatarError} />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
            </div>
        </div>

        {/* Comments Drawer */}
        <AnimatePresence>
        {isCommentsOpen && (
           <>
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsCommentsOpen(false)}
               className="fixed inset-0 bg-background/70 backdrop-blur-md z-[90] md:mx-auto md:max-w-[470px]"
             />
             <motion.div 
               id="reels-comments-drawer"
               initial={{ y: '100%' }}
               animate={{ y: 0 }}
               exit={{ y: '100%' }}
               transition={{ type: "spring", damping: 25, stiffness: 200 }}
               className="fixed inset-x-0 bottom-0 h-[65vh] md:max-h-[500px] bg-card rounded-t-3xl z-[100] flex flex-col border-t border-border shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pb-safe md:mx-auto md:max-w-[470px] w-full"
             >
             <div className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0">
               <div className="w-8"></div>
               <h3 className="font-bold text-base">{reel.comments} Comments</h3>
               <button onClick={() => setIsCommentsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
               </button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {localComments.map((comment, i) => (
                    <div key={'local-'+i} className="flex gap-3">
                       <img 
                         src={comment.avatarUrl || undefined} onError={handleAvatarError} 
                         className="w-9 h-9 rounded-full object-cover shrink-0 border border-border cursor-pointer hover:opacity-80 transition-opacity" 
                         onClick={() => {
                           const matchedUser = USERS.find(u => u.username === comment.username) || {
                             id: 'local_comment_user',
                             username: comment.username,
                             displayName: comment.username,
                             avatarUrl: comment.avatarUrl
                           };
                           openProfilePreview(matchedUser);
                         }}
                       />
                       <div>
                         <div className="flex items-center gap-2">
                            <span 
                              className="font-bold text-sm cursor-pointer hover:underline"
                              onClick={() => {
                                const matchedUser = USERS.find(u => u.username === comment.username) || {
                                  id: 'local_comment_user',
                                  username: comment.username,
                                  displayName: comment.username,
                                  avatarUrl: comment.avatarUrl
                                };
                                openProfilePreview(matchedUser);
                              }}
                            >
                              {comment.username}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">just now</span>
                         </div>
                         <p className="text-sm mt-0.5 leading-snug">{comment.text}</p>
                         <div className="mt-1 flex items-center gap-4 text-xs font-bold text-muted-foreground">
                            <button onClick={() => { setCommentText(`@${comment.username} `); document.querySelector<HTMLInputElement>('input[placeholder="Add a comment..."]')?.focus(); }} className="hover:text-foreground">Reply</button>
                         </div>
                       </div>
                       <button className="ml-auto flex items-start p-1"><Heart className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    </div>
                 ))}
                 {USERS.length > 0 && [1, 2, 3, 4, 5].map((i) => (
                    <div key={'fake-comment-'+i} className="flex gap-3">
                       <img 
                         src={USERS[i % USERS.length]?.avatarUrl || undefined} onError={handleAvatarError} 
                         className="w-9 h-9 rounded-full object-cover shrink-0 border border-border cursor-pointer hover:opacity-80 transition-opacity" 
                         onClick={() => openProfilePreview(USERS[i % USERS.length])}
                       />
                       <div>
                         <div className="flex items-center gap-2">
                            <span 
                              className="font-bold text-sm cursor-pointer hover:underline"
                              onClick={() => openProfilePreview(USERS[i % USERS.length])}
                            >
                              {USERS[i % USERS.length]?.username}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">{i}h</span>
                         </div>
                         <p className="text-sm mt-0.5 leading-snug">This is an amazing reel! Keep up the great work 🔥</p>
                         <div className="mt-1 flex items-center gap-4 text-xs font-bold text-muted-foreground">
                            <button onClick={() => { setCommentText(`@${USERS[i % USERS.length]?.username} `); document.querySelector<HTMLInputElement>('input[placeholder="Add a comment..."]')?.focus(); }} className="hover:text-foreground">Reply</button>
                         </div>
                       </div>
                       <button className="ml-auto flex items-start p-1"><Heart className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    </div>
                 ))}
             </div>
             <form onSubmit={handleCommentSubmit} className="p-4 border-t border-border shrink-0 bg-card flex gap-3 items-center">
                 <img src={db?.currentUser?.avatarUrl || undefined} className="w-9 h-9 rounded-full object-cover shrink-0 border border-border" onError={handleAvatarError} />
                 <div className="flex-1 bg-secondary rounded-full flex items-center px-4 py-2 border border-border focus-within:border-primary/50 transition-colors">
                    <input 
                      type="text" 
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="Add a comment..." 
                      className="w-full bg-transparent border-none outline-none text-sm font-medium" 
                    />
                 </div>
                 <button type="submit" className="text-primary font-bold text-sm bg-primary/10 px-4 py-2 rounded-full hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50" disabled={!commentText.trim()}>Post</button>
             </form>
           </motion.div>
           </>
        )}
        </AnimatePresence>

        <ShareModal 
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          shareUrl={`https://instacollab.app/r/${reel.id}`}
          itemTitle="Share Reel"
          shareText="Shared a reel"
        />
    </div>
  );
}

function MusicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
  );
}
