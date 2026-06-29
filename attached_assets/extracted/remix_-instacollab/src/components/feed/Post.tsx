import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '../common/Avatar';
import { ShareModal } from './ShareModal';
import { Post as PostType } from '../../types';
import { MoreHorizontal, Heart, MessageCircle, Send, Bookmark, Link as LinkIcon, X, VolumeX, Volume2, Maximize2, ChevronLeft, ChevronRight, Music, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../../lib/ToastContext';
import { useDB } from '../../lib/useDB';
import { formatTimeAgo, formatMentionsAndTags, openProfilePreview, handleAvatarError, handleMediaError, getFontClass, getAlignClass, truncateText } from '../../lib/utils';
import { CaptionModal } from './CaptionModal';
import { RepostModal } from './RepostModal';

import { UserProfilePreview } from '../profile/UserProfilePreview';

interface PostProps {
  post: PostType;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onViewComments?: (id: string) => void;
  hideVideoControls?: boolean;
}

export function Post({ post, onLike, onSave, onViewComments, hideVideoControls }: PostProps) {
  const [commentText, setCommentText] = useState('');
  const [localComments, setLocalComments] = useState<{username: string, text: string}[]>([]);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentMediaIdx, setCurrentMediaIdx] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { showToast } = useToast();
  const db = useDB();

  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe || isRightSwipe) {
      if (post.mediaList && post.mediaList.length > 1) {
        if (isLeftSwipe) {
          setCurrentMediaIdx((prev) => (prev === post.mediaList!.length - 1 ? 0 : prev + 1));
        } else {
          setCurrentMediaIdx((prev) => (prev === 0 ? post.mediaList!.length - 1 : prev - 1));
        }
      }
    }
  };

  const [fsTouchStart, setFsTouchStart] = useState<number | null>(null);
  const [fsTouchEnd, setFsTouchEnd] = useState<number | null>(null);
  const [showFullCaptionModal, setShowFullCaptionModal] = useState(false);

  const handleFsTouchStart = (e: React.TouchEvent) => {
    setFsTouchEnd(null);
    setFsTouchStart(e.targetTouches[0].clientX);
  };

  const handleFsTouchMove = (e: React.TouchEvent) => {
    setFsTouchEnd(e.targetTouches[0].clientX);
  };

  const handleFsTouchEnd = () => {
    if (!fsTouchStart || !fsTouchEnd) return;
    const distance = fsTouchStart - fsTouchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe || isRightSwipe) {
      const mediaList = post.mediaList || [];
      const listLength = mediaList.length > 0 
        ? mediaList.length 
        : (post.videoUrl || post.imageUrl ? 1 : 0);
      if (listLength > 1) {
        if (isLeftSwipe) {
          setCurrentMediaIdx((prev) => (prev === listLength - 1 ? 0 : prev + 1));
        } else {
          setCurrentMediaIdx((prev) => (prev === 0 ? listLength - 1 : prev - 1));
        }
      }
    }
  };

  // Handle setting full screen active in DB to pause other background videos
  useEffect(() => {
    if (isFullScreen) {
      db.setFullScreenActive(true);
    } else {
      db.setFullScreenActive(false);
    }
    return () => {
      if (isFullScreen) {
        db.setFullScreenActive(false);
      }
    };
  }, [isFullScreen]);

  // Handle auto-playing when video is visible & pausing when not / full screen is active
  useEffect(() => {
    if (!post.videoUrl || isFullScreen) return;
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !db.isFullScreenActive) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.6 });

    observer.observe(video);
    return () => {
      observer.unobserve(video);
    };
  }, [post.videoUrl, isFullScreen, db.isFullScreenActive]);

  const isFollowing = post.user?.isFollowing || false;

  const handleFollowToggle = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (post.user?.id) {
       db.updateUser(post.user.id, (u: any) => ({ ...u, isFollowing: !u.isFollowing }));
       showToast(isFollowing ? 'Unfollowed user' : 'Following user');
    }
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    db.addPostComment(post.id, {
      username: db.currentUser.username,
      text: commentText,
      avatarUrl: db.currentUser.avatarUrl
    });
    setCommentText('');
  };

  const handleOpenFullscreen = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const inlineVideo = videoRef.current;
    if (inlineVideo) {
      inlineVideo.pause();
    }
    setIsFullScreen(true);
  };

  const handleCloseFullscreen = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    const inlineVideo = videoRef.current;
    const fsVideo = document.getElementById(`fullscreen-video-${post.id}`) as HTMLVideoElement | null;
    if (inlineVideo && fsVideo) {
      inlineVideo.currentTime = fsVideo.currentTime;
      if (!fsVideo.paused) {
        inlineVideo.play().catch(() => {});
      } else {
        inlineVideo.pause();
      }
    }
    setIsFullScreen(false);
  };

  const handleFullscreenVideoMount = (el: HTMLVideoElement | null) => {
    if (el) {
      const inlineVideo = videoRef.current;
      if (inlineVideo) {
        el.currentTime = inlineVideo.currentTime;
        if (!inlineVideo.paused) {
          el.play().catch(() => {});
        }
      }
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    
    // Check if it's a text post
    const isTextPost = (!post.mediaList || post.mediaList.length === 0) && !post.videoUrl && !post.imageUrl;
    
    if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_PRESS_DELAY) {
      if (!post.isLiked && onLike) {
        onLike(post.id);
      }
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 1000);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current === now) {
          handleOpenFullscreen();
        }
      }, DOUBLE_PRESS_DELAY);
    }
  };

  const handleCopyLink = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-[470px] bg-card rounded-[32px] p-2 flex flex-col mb-8 border border-border shadow-sm"
      style={isFullScreen && post.videoUrl ? { transform: 'none', filter: 'none', zIndex: 9999, position: 'relative' } : {}}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 cursor-pointer">
        <div className="flex items-center gap-3 group" onClick={() => post.user && openProfilePreview(post.user)}>
          <Avatar user={post.user || db.currentUser} size="md" />
          <div className="flex flex-col">
            <span className="text-[15px] font-bold leading-tight group-hover:text-primary transition-colors flex items-center gap-1">
              {post.user?.username || 'Unknown'}
              {post.user?.isVerified && <span className="bg-primary/20 text-primary text-[10px] px-1 rounded-sm">✓</span>}
            </span>
            <span className="text-[13px] text-muted-foreground font-medium leading-tight">Location • {formatTimeAgo(post.createdAt || Date.now().toString())}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          {post.user?.id !== db.currentUser?.id && (
            <button 
              onClick={handleFollowToggle} 
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors border ${isFollowing ? 'bg-background text-foreground border-border hover:bg-secondary' : 'bg-primary text-primary-foreground border-transparent hover:bg-primary/90'}`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
          <div className="relative">
            <button 
              type="button" 
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setShowOptionsModal(!showOptionsModal);
              }} 
              className="p-1 hover:bg-secondary rounded-full transition-colors cursor-pointer flex items-center justify-center"
            >
              <MoreHorizontal className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
            <AnimatePresence>
              {showOptionsModal && (
                <>
                  <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowOptionsModal(false); }}></div>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-background/80 backdrop-blur-xl border border-border rounded-xl flex flex-col z-50 shadow-2xl overflow-hidden"
                  >
                    {post.user?.id === db.currentUser?.id ? (
                      <button onClick={(e) => { e.stopPropagation(); setShowOptionsModal(false); db.deletePost(post.id); showToast('Post deleted'); }} className="w-full text-left px-4 py-3 text-red-500 font-medium text-sm hover:bg-secondary transition-colors cursor-pointer border-b border-border">Delete Post</button>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setShowOptionsModal(false); db.updatePost(post.id, (p: any) => ({ ...p, isReported: true })); showToast('Post reported'); }} className="w-full text-left px-4 py-3 text-red-500 font-medium text-sm hover:bg-secondary transition-colors cursor-pointer border-b border-border">Report</button>
                    )}
                    {post.user?.id !== db.currentUser?.id && isFollowing && (
                      <button onClick={(e) => { e.stopPropagation(); setShowOptionsModal(false); handleFollowToggle(); }} className="w-full text-left px-4 py-3 text-red-500 font-medium text-sm hover:bg-secondary transition-colors border-b border-border">Unfollow</button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setShowOptionsModal(false); db.updatePost(post.id, (p: any) => ({ ...p, isSaved: true })); showToast('Added to favorites'); }} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-secondary transition-colors border-b border-border text-foreground">Add to favorites</button>
                    <button onClick={(e) => { e.stopPropagation(); setShowOptionsModal(false); navigator.clipboard.writeText(`https://instacollab.app/p/${post.id}`); showToast('Link copied'); }} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-secondary transition-colors text-foreground">Copy link</button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>      {/* Image/Video with Double Tap and single tap */}
      <div 
        className="w-full rounded-[24px] bg-secondary border border-border aspect-square flex items-center justify-center relative cursor-pointer overflow-hidden mt-2"
        onClick={handleDoubleTap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {post.repost ? (
          <div className="absolute inset-1.5 bg-card flex flex-col pointer-events-auto cursor-default overflow-hidden border border-border/80 rounded-[18px] shadow-sm">
            {/* Repost Header */}
            <div className="flex items-start gap-3 p-3 bg-card border-b border-border/50 shrink-0">
              <div onClick={() => post.repost?.user && openProfilePreview(post.repost.user)} className="cursor-pointer shrink-0">
                <Avatar user={post.repost.user || db.currentUser} size="sm" />
              </div>
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-1.5 text-[13px] leading-tight">
                  <span className="font-bold cursor-pointer hover:underline" onClick={() => post.repost?.user && openProfilePreview(post.repost.user)}>
                    {post.repost.user?.displayName || post.repost.user?.username || 'Unknown'}
                  </span>
                  {post.repost.user?.isVerified && <span className="bg-primary/20 text-primary text-[10px] px-1 rounded-sm">✓</span>}
                  <span className="text-muted-foreground">• Follow</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-medium leading-tight mt-0.5">
                  {formatTimeAgo(post.repost.createdAt || Date.now().toString())}
                </span>
                
                {post.repost.caption && (
                  <div className="text-[13px] font-medium text-foreground leading-relaxed mt-2 line-clamp-2">
                   {post.repost.caption}
                  </div>
                )}
              </div>
            </div>

            <div className="w-full flex-1 relative bg-secondary overflow-hidden group">
               {post.repost.imageUrl && (
                 <img 
                   src={post.repost.imageUrl} 
                   alt="Repost content" 
                   className="w-full h-full object-cover z-10 pointer-events-none" 
                   loading="lazy" 
                   onError={handleMediaError}
                 />
               )}
               {post.repost.textOverlay?.trim() && (
                 <div 
                   style={{ 
                     color: post.repost.textOverlayColor || '#ffffff', 
                     fontSize: `${post.repost.textOverlaySize || 20}px`,
                     top: `${post.repost.textOverlayPos ?? 50}%`,
                     textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)',
                     whiteSpace: 'pre-line'
                   }} 
                   className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center font-black tracking-tight pointer-events-none z-20 select-none px-4 py-1.5 rounded bg-black/40 backdrop-blur-[2px] border border-white/10 w-[90%]"
                 >
                   {post.repost.textOverlay}
                 </div>
               )}
            </div>
          </div>
        ) : (() => {
          const isTextPost = (!post.mediaList || post.mediaList.length === 0) && !post.videoUrl && !post.imageUrl;
          
          if (isTextPost) {
            const truncated = truncateText(post.caption, 180);
            return (
              <div className={`w-full h-full flex flex-col items-center justify-center p-8 ${post.bg || 'bg-gradient-to-br from-indigo-500 to-purple-600'} rounded-xl relative`}>
                 <div className="w-full flex-1 overflow-y-auto no-scrollbar flex flex-col items-center justify-center py-4">
                   <p className={`${getFontClass(post.font)} ${getAlignClass(post.alignment)} ${post.size || (post.caption.length > 50 ? 'text-2xl' : 'text-5xl')} ${post.color || 'text-white'} font-black break-words w-full`}>
                     {truncated.text}
                   </p>
                 </div>
                 {truncated.showMore && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); setShowFullCaptionModal(true); }}
                     className="mt-4 px-6 py-2 bg-background border border-border rounded-full text-foreground text-sm font-bold shadow-lg hover:bg-secondary transition-all active:scale-95 shrink-0"
                   >
                     more view...
                   </button>
                 )}
              </div>
            );
          }

          const filter = post.filter || 'none';
          const brightness = post.brightness ?? 100;
          const contrast = post.contrast ?? 100;
          const style: React.CSSProperties = {
            filter: `${filter === 'grayscale' ? 'grayscale(100%)' : filter === 'sepia' ? 'sepia(100%)' : filter === 'blur' ? 'blur(4px)' : filter === 'noir' ? 'grayscale(100%) contrast(140%) brightness(90%)' : filter === 'vintage' ? 'sepia(80%) hover-rotate(-10deg) saturate(120%)' : filter === 'sunset' ? 'saturate(150%) hue-rotate(15deg) sepia(20%)' : filter === 'cold' ? 'hue-rotate(180deg) saturate(110%) contrast(110%)' : filter === 'chrome' ? 'contrast(150%) saturate(140%)' : 'none'} brightness(${brightness}%) contrast(${contrast}%)`
          };

          const mediaList = post.mediaList || [];
          const currentMedia = mediaList.length > 0 
            ? mediaList[currentMediaIdx] 
            : { url: post.videoUrl || post.imageUrl || '', type: post.videoUrl ? 'video' : 'image', name: '' };

          if (currentMedia.type === 'video') {
            return (
              <div className="relative w-full h-full">
                <video 
                  ref={videoRef}
                  src={currentMedia.url || undefined} 
                  autoPlay 
                  loop 
                  playsInline 
                  muted={db.globalMuted}
                  onVolumeChange={(e) => {
                    db.setGlobalMuted(e.currentTarget.muted);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleOpenFullscreen();
                  }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickY = e.clientY - rect.top;
                    if (clickY > rect.height - 60) {
                      e.stopPropagation();
                    } else {
                      e.stopPropagation();
                      if (videoRef.current) {
                        if (videoRef.current.paused) {
                          videoRef.current.play().catch(() => {});
                        } else {
                          videoRef.current.pause();
                        }
                      }
                    }
                  }}
                  controls
                  preload="auto"
                  style={style}
                  className="w-full h-full object-cover z-10 bg-black/30"
                />
                {!hideVideoControls && (
                  <div className="absolute bottom-4 right-4 z-20 flex gap-2">
                    <button 
                      onClick={handleOpenFullscreen}
                      className="p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all shadow-md active:scale-95"
                      title="Fullscreen"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        db.setGlobalMuted(!db.globalMuted);
                      }}
                      className="p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all shadow-md active:scale-95"
                      title={db.globalMuted ? "Unmute" : "Mute"}
                    >
                      {db.globalMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            );
          } else if (currentMedia.type === 'audio') {
            return (
              <div className="flex flex-col items-center justify-center p-6 bg-card border border-border shadow-md rounded-2xl w-full max-w-[280px] aspect-square relative z-10" onClick={(e) => e.stopPropagation()}>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3 relative overflow-hidden animate-pulse">
                  <Music className="w-8 h-8 animate-bounce" />
                  <div className="absolute inset-0 border-2 border-dashed border-primary/20 rounded-full animate-spin [animation-duration:10s]"></div>
                </div>
                <p className="font-bold text-xs text-center mb-1 max-w-[240px] truncate">{currentMedia.name || 'Audio Track'}</p>
                <p className="text-[10px] text-muted-foreground mb-3 font-mono">Audio Track</p>
                <audio src={currentMedia.url || undefined} controls className="w-full scale-90 accent-primary focus:outline-none" />
              </div>
            );
          } else {
            return (
              <img 
                src={currentMedia.url || undefined} 
                alt="Post content" 
                style={style}
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500 z-10 pointer-events-none" 
                loading="lazy" 
                onError={handleMediaError}
              />
            );
          }
        })()}

        {/* Carousel Navigation Arrows if multiple items */}
        {post.mediaList && post.mediaList.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentMediaIdx((prev) => (prev === 0 ? post.mediaList!.length - 1 : prev - 1));
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 hidden lg:flex items-center justify-center text-white transition-all z-30 shadow-md active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentMediaIdx((prev) => (prev === post.mediaList!.length - 1 ? 0 : prev + 1));
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 hidden lg:flex items-center justify-center text-white transition-all z-30 shadow-md active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Pagination Indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-30 bg-black/30 backdrop-blur-[2px] px-2.5 py-1 rounded-full">
              {post.mediaList.map((_, i) => (
                <div
                  key={`dot-${i}`}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentMediaIdx ? 'bg-white scale-110' : 'bg-white/40'}`}
                />
              ))}
            </div>
          </>
        )}
        
        {post.textOverlay?.trim() && (
          <div 
            style={{ 
              color: post.textOverlayColor || '#ffffff', 
              fontSize: `${post.textOverlaySize || 20}px`,
              top: `${post.textOverlayPos ?? 50}%`,
              textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)'
            }} 
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center font-black tracking-tight pointer-events-none z-20 select-none px-4 py-1.5 rounded bg-black/40 backdrop-blur-[2px] border border-white/10"
          >
            {post.textOverlay}
          </div>
        )}
        
        {/* Like Animation Overlay */}
        <AnimatePresence>
          {showHeartAnimation && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            >
              <Heart className="w-32 h-32 fill-current text-red-500 stroke-red-500 drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-5">
          <button 
            onClick={() => onLike && onLike(post.id)}
            className="flex items-center gap-1.5 hover:opacity-70 transition-transform active:scale-90 group"
          >
            <Heart 
              fill={post.isLiked ? 'currentColor' : 'none'}
              className={`w-[26px] h-[26px] transition-colors ${post.isLiked ? 'text-red-500' : 'text-foreground group-hover:text-red-500'}`} 
            />
            <span className="font-bold text-[15px]">{(post?.likes || 0).toLocaleString()}</span>
          </button>
          <button 
            onClick={() => onViewComments && onViewComments(post.id)}
            className="flex items-center gap-1.5 hover:opacity-70 transition-transform active:scale-90 group"
          >
            <MessageCircle className="w-[26px] h-[26px] stroke-foreground group-hover:stroke-primary transition-colors" />
            <span className="font-bold text-[15px]">{(post?.comments || 0) + (db?.postComments?.[post.id]?.length || 0)}</span>
          </button>
          <button 
            onClick={() => setShowRepostModal(true)}
            className="flex items-center gap-1.5 hover:opacity-70 transition-transform active:scale-90 group"
          >
            <Repeat className="w-[26px] h-[26px] stroke-foreground group-hover:stroke-primary transition-colors" />
            <span className="font-bold text-[15px]">{post?.reposts || 0}</span>
          </button>
          <button 
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 hover:opacity-70 transition-transform active:scale-90 group"
          >
            <Send className="w-[26px] h-[26px] stroke-foreground group-hover:stroke-primary transition-colors -mt-1 ml-1" />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onSave && onSave(post.id)}
            className="hover:opacity-70 transition-transform active:scale-90 group"
          >
            <Bookmark 
              fill={post.isSaved ? 'currentColor' : 'none'}
              className="w-[26px] h-[26px] transition-colors text-foreground" 
            />
          </button>
        </div>
      </div>

      <div className="px-4 mb-3">
        <p className={`text-[14px] leading-relaxed break-words ${getFontClass(post.font)} ${getAlignClass(post.alignment)} ${post.color || 'text-foreground'}`}>
           <span className="font-bold mr-2 hover:underline cursor-pointer" onClick={() => post.user && openProfilePreview(post.user)}>
             {post.user?.username || 'Unknown'}
           </span>
           {truncateText(post.caption, 180).text}
           {truncateText(post.caption, 180).showMore && (
             <button onClick={() => setShowFullCaptionModal(true)} className="text-muted-foreground ml-1 hover:underline font-bold">view more</button>
           )}
        </p>
      </div>
      
      {showFullCaptionModal && <CaptionModal post={post} onClose={() => setShowFullCaptionModal(false)} />}

      {/* Local Comments */}
      {(db?.postComments?.[post.id] || []).map((comment: any, idx: number) => {
        const commentUser = db.users.find(u => u.username === comment.username) || {
          id: comment.userId || 'unknown',
          username: comment.username,
          displayName: comment.username,
          avatarUrl: comment.avatarUrl
        };
        return (
          <div key={comment.id || idx} className="px-4 mt-1 text-[14px] leading-relaxed flex items-start gap-2">
             <img 
               src={comment.avatarUrl || undefined} 
               alt="avatar" 
               className="w-5 h-5 rounded-full object-cover border border-border shrink-0 mt-0.5 cursor-pointer hover:opacity-80 transition-opacity" 
               onClick={() => openProfilePreview(commentUser)}
               onError={handleAvatarError}
             />
             <div>
               <span 
                 className="font-bold mr-2 hover:underline cursor-pointer"
                 onClick={() => openProfilePreview(commentUser)}
               >
                 {comment.username}
               </span>
               <span className="text-foreground/90">{comment.text}</span>
             </div>
          </div>
        );
      })}

      {/* Comments link */}
      {((post?.comments || 0) > 0 || (db?.postComments?.[post.id]?.length > 2)) && (
        <div 
          onClick={() => onViewComments && onViewComments(post.id)}
          className="px-4 mt-1 text-[14px] text-muted-foreground cursor-pointer font-medium hover:underline w-max"
        >
          View all {(post?.comments || 0) + (db?.postComments?.[post.id]?.length || 0)} comments
        </div>
      )}
      
      {/* Add comment */}
      <form onSubmit={handleCommentSubmit} className="px-4 mt-3 flex items-center pb-2">
        <div className="mr-3">
          <Avatar user={db.currentUser} size="sm" />
        </div>
        <input 
          type="text" 
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 bg-transparent border-none outline-none text-[14px] font-medium text-foreground placeholder:text-muted-foreground"
        />
        {commentText.trim() && (
          <button type="submit" className="text-primary font-bold text-[14px] ml-2 hover:text-primary/80 transition-colors">Post</button>
        )}
      </form>
      
      <div className="px-4 mt-1 mb-3 text-[11px] text-muted-foreground uppercase tracking-widest font-bold">
        {formatTimeAgo(post.createdAt)}
      </div>

      {/* Share Modal */}
      <ShareModal 
        isOpen={showShareModal} 
        onClose={() => setShowShareModal(false)} 
        shareUrl={`https://instacollab.app/p/${post.id}`}
        itemTitle="Share to Messages"
        shareText="Shared a post"
      />

      {showRepostModal && (
        <RepostModal post={post} onClose={() => setShowRepostModal(false)} />
      )}

      {/* Remove unused Profile Preview */}

      {isFullScreen && createPortal(
        <div 
          id="media-full-screen-modal" 
          className="fixed inset-0 z-[250] flex items-center justify-center bg-background pointer-events-auto animate-in fade-in duration-200 select-none"
          onWheel={(e) => e.stopPropagation()}
          onClick={handleCloseFullscreen}
          onTouchStart={handleFsTouchStart}
          onTouchMove={handleFsTouchMove}
          onTouchEnd={handleFsTouchEnd}
        >
          <button 
            onClick={handleCloseFullscreen} 
            className="absolute top-4 right-4 z-[260] text-foreground p-2.5 bg-background border border-border hover:bg-secondary rounded-full transition-all active:scale-95 shadow-md"
            title="Close Full Screen"
          >
            <X className="w-8 h-8" />
          </button>

          {/* Carousel arrows inside Fullscreen view - HIDDEN on mobile/tablet, shown on desktop (lg) */}
          {(post.mediaList || []).length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentMediaIdx((prev) => (prev === 0 ? post.mediaList!.length - 1 : prev - 1));
                }}
                className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/75 hidden lg:flex items-center justify-center text-white transition-all z-50 shadow-md active:scale-95"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentMediaIdx((prev) => (prev === post.mediaList!.length - 1 ? 0 : prev + 1));
                }}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/75 hidden lg:flex items-center justify-center text-white transition-all z-50 shadow-md active:scale-95"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div className="w-full h-full flex items-center justify-center p-4 overflow-hidden">
            {(() => {
              const isTextPost = (!post.mediaList || post.mediaList.length === 0) && !post.videoUrl && !post.imageUrl;
              if (isTextPost) {
                return (
                  <div className={`w-full max-w-2xl h-full max-h-[80vh] flex flex-col items-center justify-center p-12 ${post.bg && !post.bg.includes('bg-secondary') ? post.bg : 'bg-card'} rounded-3xl relative shadow-2xl border border-border/50`}>
                    <div className="w-full flex-1 overflow-y-auto no-scrollbar flex flex-col items-center justify-center py-6">
                      <p className={`${getFontClass(post.font)} ${getAlignClass(post.alignment)} ${post.size || (post.caption.length > 50 ? 'text-3xl' : 'text-6xl')} ${(post.bg && !post.bg.includes('bg-secondary')) ? (post.color || 'text-white') : 'text-foreground'} font-black break-words w-full`}>
                        {post.caption}
                      </p>
                    </div>
                  </div>
                );
              }

              const mediaList = post.mediaList || [];
              const currentMedia = mediaList.length > 0 
                ? mediaList[currentMediaIdx] 
                : { url: post.videoUrl || post.imageUrl || '', type: post.videoUrl ? 'video' : 'image', name: '' };

              if (currentMedia.type === 'video') {
                return (
                  <video 
                    id={`fullscreen-video-${post.id}`}
                    key={`fs-vid-${currentMediaIdx}`}
                    ref={handleFullscreenVideoMount}
                    src={currentMedia.url || undefined} 
                    autoPlay 
                    loop 
                    playsInline 
                    muted={db.globalMuted}
                    onVolumeChange={(e) => {
                      db.setGlobalMuted(e.currentTarget.muted);
                    }}
                    controls
                    className="max-w-full max-h-full object-contain z-10"
                    onClick={(e) => e.stopPropagation()}
                  />
                );
              } else if (currentMedia.type === 'audio') {
                return (
                  <div className="flex flex-col items-center justify-center p-8 bg-card border border-border shadow-2xl rounded-2xl w-full max-w-[320px] aspect-square relative z-10" onClick={(e) => e.stopPropagation()}>
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 relative overflow-hidden animate-pulse">
                      <Music className="w-10 h-10 animate-bounce" />
                      <div className="absolute inset-0 border-2 border-dashed border-primary/20 rounded-full animate-spin [animation-duration:10s]"></div>
                    </div>
                    <p className="font-bold text-sm text-center mb-1 max-w-[280px] truncate">{currentMedia.name || 'Audio Track'}</p>
                    <p className="text-xs text-muted-foreground mb-4 font-mono">Audio Track</p>
                    <audio src={currentMedia.url || undefined} controls className="w-full scale-95 accent-primary focus:outline-none" />
                  </div>
                );
              } else {
                return (
                  <img 
                    key={`fs-img-${currentMediaIdx}`}
                    src={currentMedia.url || undefined} 
                    alt="Post content" 
                    className="max-w-full max-h-full object-contain z-10" 
                    onError={handleMediaError}
                  />
                );
              }
            })()}
          </div>

          {/* Dots Indicator in Fullscreen view if multiple items */}
          {post.mediaList && post.mediaList.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-50 bg-black/30 backdrop-blur-[2px] px-3 py-1.5 rounded-full">
              {post.mediaList.map((_, i) => (
                <div
                  key={`fs-dot-${i}`}
                  className={`w-2 h-2 rounded-full transition-all ${i === currentMediaIdx ? 'bg-white scale-110' : 'bg-white/40'}`}
                />
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </motion.div>
  );
}
