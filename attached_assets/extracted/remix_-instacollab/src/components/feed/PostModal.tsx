import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Share,
  Link,
  CheckCircle2,
  Copy,
  Image,
  Smile,
  X,
  Plus,
  Mic,
  ChevronLeft,
  ChevronRight,
  Music,
  ArrowLeft,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { useDB } from "../../lib/useDB";
import { formatTimeAgo, formatMentionsAndTags, openProfilePreview, handleAvatarError, handleMediaError, fileToBase64, getFontClass, getAlignClass, truncateText } from "../../lib/utils";
import { CaptionModal } from './CaptionModal';
import { RepostModal } from './RepostModal';
import { Avatar } from '../common/Avatar';

export function PostModal({
  postId,
  onClose,
}: {
  postId: string;
  onClose: () => void;
}) {
  const db = useDB();
  const selectedPost = db.posts.find((p) => p.id === postId);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    username: string;
  } | null>(null);
  const [commentMedia, setCommentMedia] = useState<
    { url: string; isVideo: boolean }[]
  >([]);

  const [showShareModal, setShowShareModal] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);

  const [fullscreenMedia, setFullscreenMedia] = useState<{
    items: Array<{ 
      url: string; 
      isVideo?: boolean; 
      isAudio?: boolean; 
      name?: string;
      isText?: boolean;
      caption?: string;
      bg?: string;
      font?: string;
      alignment?: string;
      size?: string;
      color?: string;
    }>;
    mediaIndex: number;
  } | null>(null);

  const [currentMediaIdx, setCurrentMediaIdx] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
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
      const mediaList = selectedPost.mediaList || [];
      const listLength = mediaList.length > 0 
        ? mediaList.length 
        : (selectedPost.videoUrl || selectedPost.imageUrl ? 1 : 0);
      if (listLength > 1) {
        if (isLeftSwipe) {
          setCurrentMediaIdx((prev) => (prev === listLength - 1 ? 0 : prev + 1));
        } else {
          setCurrentMediaIdx((prev) => (prev === 0 ? listLength - 1 : prev - 1));
        }
      }
    }
  };

  // Full screen swipe handlers
  const [fsTouchStart, setFsTouchStart] = useState<number | null>(null);
  const [fsTouchEnd, setFsTouchEnd] = useState<number | null>(null);

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
      if (fullscreenMedia && fullscreenMedia.items.length > 1) {
        if (isLeftSwipe) {
          setFullscreenMedia((prev) => 
            prev ? { ...prev, mediaIndex: (prev.mediaIndex === prev.items.length - 1 ? 0 : prev.mediaIndex + 1) } : null
          );
        } else {
          setFullscreenMedia((prev) => 
            prev ? { ...prev, mediaIndex: (prev.mediaIndex === 0 ? prev.items.length - 1 : prev.mediaIndex - 1) } : null
          );
        }
      }
    }
  };

  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const lastTapRef = useRef<number>(0);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    
    // Lock body scrolling when PostModal is mounted
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.body.style.overflow = originalStyle;
    };
  }, []);

  if (!selectedPost) return null;

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_PRESS_DELAY) {
      if (!selectedPost.isLiked) {
        db.updatePost(selectedPost.id, (p) => ({
          ...p,
          isLiked: true,
          likes: (p.likes || 0) + 1,
        }));
      }
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 1000);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current === now) {
          const isTextPost = (!selectedPost.mediaList || selectedPost.mediaList.length === 0) && !selectedPost.videoUrl && !selectedPost.imageUrl;
          
          if (isTextPost) {
            setFullscreenMedia({
              items: [{ 
                url: '', 
                isText: true,
                caption: selectedPost.caption,
                bg: selectedPost.bg,
                font: selectedPost.font,
                alignment: selectedPost.alignment,
                size: selectedPost.size,
                color: selectedPost.color
              }],
              mediaIndex: 0,
            });
            return;
          }

          const mediaList = selectedPost.mediaList || [];
          if (mediaList.length > 0) {
            setFullscreenMedia({
              items: mediaList.map(m => ({ url: m.url, isVideo: m.type === 'video', isAudio: m.type === 'audio', name: m.name })),
              mediaIndex: currentMediaIdx,
            });
          } else {
            setFullscreenMedia({
              items: [{
                url: selectedPost.videoUrl || selectedPost.imageUrl || '',
                isVideo: !!selectedPost.videoUrl,
              }],
              mediaIndex: 0,
            });
          }
        }
      }, DOUBLE_PRESS_DELAY);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(
      `https://instacollab.app/p/${selectedPost.id}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() && commentMedia.length === 0) return;

    const commentData = {
      username: db.currentUser.username,
      text: commentText,
      avatarUrl: db.currentUser.avatarUrl,
      media: commentMedia.length > 0 ? commentMedia : undefined,
    };

    if (replyingTo) {
      db.addPostCommentReply(
        selectedPost.id,
        replyingTo.commentId,
        commentData,
      );
    } else {
      db.addPostComment(selectedPost.id, commentData);
    }

    setCommentText("");
    setCommentMedia([]);
    setReplyingTo(null);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      try {
        const files = Array.from(e.target.files);
        const newMedia = await Promise.all(
          files.map(async (file) => {
            const base64 = await fileToBase64(file);
            return {
              url: base64,
              isVideo: file.type.startsWith("video/") || /\.(mp4|mov|webm|ogg|m4v|avi|wmv)$/i.test(file.name),
            };
          })
        );
        setCommentMedia((prev) => [...prev, ...newMedia]);
      } catch (err) {
        console.error("Error processing comment media", err);
      }
    }
  };

  const CommentItem = ({
    comment,
    depth = 0,
  }: {
    comment: any;
    depth?: number;
  }) => {
    const isLiked = db.currentUser?.id && comment.likedBy?.includes(db.currentUser.id);
    const [showReplies, setShowReplies] = useState(false);

    // Reduce padding/margins at deeper levels to prevent overflow on mobile screens
    const avatarClass =
      depth > 0 ? "w-6 h-6 md:w-8 md:h-8" : "w-8 h-8 md:w-10 md:h-10";

    return (
      <div className="flex gap-2 md:gap-3 items-start mt-4">
        <div
          className={`${avatarClass} rounded-full overflow-hidden border border-border shrink-0 mt-1 cursor-pointer hover:opacity-80 transition-opacity`}
          onClick={() => {
            const commentUser = db.users.find(u => u.username === comment.username) || {
              id: comment.userId || 'unknown',
              username: comment.username,
              displayName: comment.username,
              avatarUrl: comment.avatarUrl
            };
            openProfilePreview(commentUser);
          }}
        >
          <img
            src={comment.avatarUrl || undefined}
            alt="user"
            className="w-full h-full object-cover"
            onError={handleAvatarError}
          />
        </div>
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-2 text-left">
            <div className="text-[14px] leading-relaxed break-words flex-1 flex flex-col items-start pr-2 md:pr-4 min-w-0">
              <div
                className="w-full break-words whitespace-pre-wrap"
                style={{ wordBreak: "break-word" }}
              >
                <span 
                  className="font-bold mr-2 cursor-pointer hover:underline"
                  onClick={() => {
                    const commentUser = db.users.find(u => u.username === comment.username) || {
                      id: comment.userId || 'unknown',
                      username: comment.username,
                      displayName: comment.username,
                      avatarUrl: comment.avatarUrl
                    };
                    openProfilePreview(commentUser);
                  }}
                >
                  {comment.username}
                </span>
                <span>{comment.text}</span>
              </div>
              {comment.media && comment.media.length > 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-2 w-full max-w-full md:max-w-[300px]">
                  {comment.media.map((m: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-border overflow-hidden bg-secondary/30 relative group aspect-square"
                    >
                      {m.isVideo ? (
                        <video
                          src={m.url || undefined}
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="auto"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={m.url || undefined}
                          className="w-full h-full object-cover cursor-pointer"
                          alt="comment media"
                          onError={handleMediaError}
                          onClick={() =>
                            setFullscreenMedia({
                              items: comment.media.map((med: any) => ({ url: med.url, isVideo: med.isVideo })),
                              mediaIndex: idx,
                            })
                          }
                        />
                      )}
                      {m.isVideo && (
                        <button
                          onClick={() =>
                            setFullscreenMedia({
                              items: comment.media.map((med: any) => ({ url: med.url, isVideo: med.isVideo })),
                              mediaIndex: idx,
                            })
                          }
                          className="absolute top-2 right-2 bg-background/80 backdrop-blur text-foreground rounded-md p-1.5 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-sm hover:bg-background shadow-lg"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                comment.mediaUrl && (
                  <div className="mt-2 rounded-xl border border-border overflow-hidden max-w-full md:max-w-[250px] bg-secondary/30 relative group">
                    {comment.isVideo ? (
                      <video
                        src={comment.mediaUrl || undefined}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                        className="w-full h-full object-cover max-h-[250px]"
                      />
                    ) : (
                      <img
                        src={comment.mediaUrl || undefined}
                        className="w-full h-full object-cover max-h-[250px] cursor-pointer"
                        alt="comment media"
                        onError={handleMediaError}
                        onClick={() =>
                          setFullscreenMedia({
                            items: [{ url: comment.mediaUrl, isVideo: comment.isVideo }],
                            mediaIndex: 0,
                          })
                        }
                      />
                    )}
                    {comment.isVideo && (
                      <button
                        onClick={() =>
                          setFullscreenMedia({
                            items: [{ url: comment.mediaUrl, isVideo: comment.isVideo }],
                            mediaIndex: 0,
                          })
                        }
                        className="absolute top-2 right-2 bg-background/80 backdrop-blur text-foreground rounded-md p-1.5 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-sm hover:bg-background shadow-lg"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0 px-2 mt-1 w-12">
              <button
                onClick={() =>
                  db.likePostComment(
                    selectedPost.id,
                    comment.id,
                    db.currentUser.id,
                  )
                }
                className="p-1 hover:scale-110 transition-transform"
              >
                <Heart
                  className={`w-3.5 h-3.5 ${isLiked ? "fill-current text-red-500" : "text-muted-foreground hover:text-red-500"}`}
                />
              </button>
              {comment.likes > 0 && (
                <span className="text-[10px] font-bold text-muted-foreground">
                  {comment.likes}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground mt-1">
            <span>
              {comment.timestamp
                ? formatTimeAgo(comment.timestamp)
                : "just now"}
            </span>
            <button
              onClick={() => {
                setReplyingTo({
                  commentId: comment.id,
                  username: comment.username,
                });
                setCommentText(`@${comment.username} `);
                commentInputRef.current?.focus();
              }}
              className="hover:text-foreground transition-colors"
            >
              Reply
            </button>
          </div>
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-1">
              {!showReplies ? (
                <button
                  onClick={() => setShowReplies(true)}
                  className="text-xs font-bold text-muted-foreground flex items-center gap-2 mt-2 mb-1 hover:text-foreground"
                >
                  <span className="w-6 h-[1px] bg-border"></span> View{" "}
                  {comment.replies.length} repl
                  {comment.replies.length === 1 ? "y" : "ies"}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowReplies(false)}
                    className="text-xs font-bold text-muted-foreground flex items-center gap-2 mt-2 mb-2 hover:text-foreground"
                  >
                    <span className="w-6 h-[1px] bg-border"></span> Hide replies
                  </button>
                  {comment.replies.map((reply: any) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      depth={depth + 1}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return createPortal(
    <div
      id="post-modal"
      className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center bg-background/80 backdrop-blur-md"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-foreground p-2 hover:bg-secondary rounded-full transition-colors z-50 cursor-pointer hidden md:block border border-border shadow-sm"
      >
        <X className="w-6 h-6" />
      </button>
      <div className="w-full h-[100dvh] md:h-[85vh] max-w-5xl bg-card border-none md:border md:border-border shadow-2xl md:rounded-3xl flex flex-col md:flex-row overflow-hidden md:max-h-[800px] min-h-0">
        <div 
          className="hidden md:flex w-3/5 bg-secondary items-center justify-center relative group cursor-pointer h-full min-w-0 min-h-0 overflow-hidden"
          onClick={handleDoubleTap}
        >
          {isDesktop && (() => {
            if (selectedPost.repost) {
              return (
                <div className="w-full h-full p-4 flex flex-col pointer-events-auto cursor-default">
                  <div className="h-full bg-card relative flex flex-col overflow-hidden border border-border/80 rounded-[18px] shadow-sm">
                    {/* Repost Header */}
                    <div className="flex items-start gap-3 p-4 bg-card border-b border-border/50 shrink-0">
                      <div onClick={() => selectedPost.repost?.user && openProfilePreview(selectedPost.repost.user)} className="cursor-pointer shrink-0">
                        <Avatar user={selectedPost.repost.user || db.currentUser} size="md" />
                      </div>
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center gap-1.5 text-[14px]">
                          <span className="font-bold cursor-pointer hover:underline" onClick={() => selectedPost.repost?.user && openProfilePreview(selectedPost.repost.user)}>
                            {selectedPost.repost.user?.displayName || selectedPost.repost.user?.username || 'Unknown'}
                          </span>
                          {selectedPost.repost.user?.isVerified && <span className="bg-primary/20 text-primary text-[10px] px-1 rounded-sm">✓</span>}
                          <span className="text-muted-foreground font-semibold text-[13px]">• Follow</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium mt-0.5">
                          {formatTimeAgo(selectedPost.repost.createdAt || Date.now().toString())}
                        </span>
                        
                        {selectedPost.repost.caption && (
                          <div className="text-[14px] font-medium text-foreground leading-relaxed mt-2 line-clamp-3">
                           {selectedPost.repost.caption}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="w-full flex-1 relative bg-black overflow-hidden flex items-center justify-center">
                       {selectedPost.repost.imageUrl && (
                         <img 
                           src={selectedPost.repost.imageUrl} 
                           alt="Repost content" 
                           className="w-full h-full object-contain pointer-events-none" 
                           loading="lazy" 
                           onError={handleMediaError}
                         />
                       )}
                       {selectedPost.repost.videoUrl && (
                         <video 
                           src={selectedPost.repost.videoUrl} 
                           className="max-w-full max-h-full object-contain"
                           controls
                           muted
                         />
                       )}
                       {selectedPost.repost.textOverlay?.trim() && (
                         <div 
                           style={{ 
                             color: selectedPost.repost.textOverlayColor || '#ffffff', 
                             fontSize: `${(selectedPost.repost.textOverlaySize || 20) * 1.5}px`,
                             top: `${selectedPost.repost.textOverlayPos ?? 50}%`,
                             textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)',
                             whiteSpace: 'pre-line'
                           }} 
                           className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center font-black tracking-tight pointer-events-none z-20 select-none px-4 py-1.5 rounded bg-black/40 backdrop-blur-[2px] border border-white/10 w-[90%]"
                         >
                           {selectedPost.repost.textOverlay}
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              );
            }

            const isTextPost = (!selectedPost.mediaList || selectedPost.mediaList.length === 0) && !selectedPost.videoUrl && !selectedPost.imageUrl;
            
            if (isTextPost) {
              return (
                <div className={`w-full h-full flex flex-col items-center justify-center p-10 ${selectedPost.bg || 'bg-gradient-to-br from-indigo-500 to-purple-600'} rounded-xl overflow-hidden relative shadow-2xl`}>
                  <div className="w-full flex-1 overflow-y-auto no-scrollbar flex flex-col items-center justify-center py-8">
                    <p className={`${getFontClass(selectedPost.font)} ${getAlignClass(selectedPost.alignment)} ${selectedPost.size || (selectedPost.caption.length > 50 ? 'text-3xl' : 'text-5xl')} ${selectedPost.color || 'text-white'} font-black break-words w-full`}>
                      {selectedPost.caption}
                    </p>
                  </div>
                </div>
              );
            }

            const mediaList = selectedPost.mediaList || [];
            const currentMedia = mediaList.length > 0 
              ? mediaList[currentMediaIdx] 
              : { url: selectedPost.videoUrl || selectedPost.imageUrl || '', type: selectedPost.videoUrl ? 'video' : 'image', name: '' };

            return (
              <>
                {currentMedia.type === 'video' ? (
                  <video
                    key={`modal-des-vid-${currentMediaIdx}`}
                    src={currentMedia.url || undefined}
                    autoPlay
                    loop
                    playsInline
                    muted
                    controls
                    preload="auto"
                    className="max-w-full max-h-full object-contain bg-black"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickY = e.clientY - rect.top;
                      if (clickY > rect.height - 60) {
                        e.stopPropagation();
                      }
                    }}
                  />
                ) : currentMedia.type === 'audio' ? (
                  <div className="flex flex-col items-center justify-center p-8 bg-card border border-border shadow-2xl rounded-2xl w-full max-w-[325px] aspect-square relative z-10" onClick={(e) => e.stopPropagation()}>
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 relative overflow-hidden animate-pulse">
                      <Music className="w-10 h-10 animate-bounce" />
                      <div className="absolute inset-0 border-2 border-dashed border-primary/20 rounded-full animate-spin [animation-duration:10s]"></div>
                    </div>
                    <p className="font-bold text-sm text-center mb-1 max-w-[280px] truncate text-white">{currentMedia.name || 'Audio Track'}</p>
                    <p className="text-xs text-muted-foreground mb-4 font-mono">Audio Track</p>
                    <audio src={currentMedia.url || undefined} controls className="w-full scale-95 accent-primary focus:outline-none" />
                  </div>
                ) : (
                  <img
                    key={`modal-des-img-${currentMediaIdx}`}
                    src={currentMedia.url || undefined}
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    alt="Post"
                    onError={handleMediaError}
                  />
                )}

                {/* Desktop controls - hidden on mobile, shown on desktop (lg) */}
                {mediaList.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentMediaIdx((prev) => (prev === 0 ? mediaList.length - 1 : prev - 1));
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/75 hidden lg:flex items-center justify-center text-white transition-all z-20 shadow-md active:scale-95"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentMediaIdx((prev) => (prev === mediaList.length - 1 ? 0 : prev + 1));
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/75 hidden lg:flex items-center justify-center text-white transition-all z-20 shadow-md active:scale-95"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
                      {mediaList.map((_, i) => (
                        <div
                          key={`m-dot-des-${i}`}
                          className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentMediaIdx ? 'bg-white scale-110' : 'bg-white/40'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            );
          })()}

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
        <div className="w-full md:w-2/5 flex flex-col h-full bg-card relative overflow-hidden min-h-0">
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0 sticky top-0 bg-card z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="md:hidden p-2 hover:bg-secondary rounded-full bg-background border border-border"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div 
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => selectedPost.user && openProfilePreview(selectedPost.user)}
              >
                <div className="w-9 h-9 rounded-full overflow-hidden border border-border group-hover:opacity-80 transition-opacity">
                  <Avatar user={selectedPost.user} size="sm" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-[14px] group-hover:underline leading-none">
                    {selectedPost.user?.username || 'Unknown'}
                  </span>
                  {selectedPost.location && <span className="text-[10px] text-muted-foreground font-medium mt-0.5">{selectedPost.location}</span>}
                </div>
              </div>
            </div>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowOptionsModal(!showOptionsModal); }}
                className="p-2 hover:bg-secondary rounded-full transition-colors relative z-10"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              {showOptionsModal && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowOptionsModal(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl flex flex-col z-50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    {selectedPost.user?.id === db.currentUser?.id ? (
                      <button
                        onClick={() => {
                          setShowOptionsModal(false);
                          db.deletePost(selectedPost.id);
                          onClose();
                        }}
                        className="w-full text-left px-4 py-3 text-red-500 font-medium text-sm hover:bg-secondary transition-colors cursor-pointer border-b border-border"
                      >
                        Delete Post
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setShowOptionsModal(false);
                          db.updatePost(selectedPost.id, (p: any) => ({
                            ...p,
                            isReported: true,
                          }));
                        }}
                        className="w-full text-left px-4 py-3 text-red-500 font-medium text-sm hover:bg-secondary transition-colors cursor-pointer border-b border-border"
                      >
                        Report
                      </button>
                    )}
                    {selectedPost.user?.id !== db.currentUser?.id && (
                      <button
                        onClick={() => {
                          setShowOptionsModal(false);
                          if (selectedPost.user?.id) {
                            db.updateUser(selectedPost.user.id, (u: any) => ({
                              ...u,
                              isFollowing: false,
                            }));
                          }
                        }}
                        className="w-full text-left px-4 py-3 text-red-500 font-medium text-sm hover:bg-secondary transition-colors border-b border-border"
                      >
                        Unfollow
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowOptionsModal(false);
                        db.updatePost(selectedPost.id, (p: any) => ({
                          ...p,
                          isSaved: true,
                        }));
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-secondary transition-colors border-b border-border"
                    >
                      Add to favorites
                    </button>
                    <button
                      onClick={() => {
                        setShowOptionsModal(false);
                        handleCopyLink();
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-secondary transition-colors"
                    >
                      Copy link
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar bg-secondary/10 flex flex-col min-h-0">
            <div 
              className="md:hidden w-full aspect-square max-h-[45dvh] bg-black shrink-0 relative cursor-pointer overflow-hidden flex items-center justify-center"
              onClick={handleDoubleTap}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {!isDesktop && (() => {
                if (selectedPost.repost) {
                  return (
                    <div className="w-full h-full p-2 flex flex-col pointer-events-auto cursor-default">
                      <div className="h-full bg-card relative flex flex-col overflow-hidden border border-border/80 rounded-[12px] shadow-sm">
                        {/* Repost Header */}
                        <div className="flex items-start gap-2 p-3 bg-card border-b border-border/50 shrink-0">
                          <div onClick={() => selectedPost.repost?.user && openProfilePreview(selectedPost.repost.user)} className="cursor-pointer shrink-0">
                            <Avatar user={selectedPost.repost.user || db.currentUser} size="sm" />
                          </div>
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center gap-1.5 text-[13px]">
                              <span className="font-bold cursor-pointer hover:underline" onClick={() => selectedPost.repost?.user && openProfilePreview(selectedPost.repost.user)}>
                                {selectedPost.repost.user?.displayName || selectedPost.repost.user?.username || 'Unknown'}
                              </span>
                              {selectedPost.repost.user?.isVerified && <span className="bg-primary/20 text-primary text-[10px] px-1 rounded-sm">✓</span>}
                              <span className="text-muted-foreground font-semibold text-[11px]">• Follow</span>
                            </div>
                            <span className="text-[11px] text-muted-foreground font-medium mt-0.5">
                              {formatTimeAgo(selectedPost.repost.createdAt || Date.now().toString())}
                            </span>
                            
                            {selectedPost.repost.caption && (
                              <div className="text-[13px] font-medium text-foreground leading-relaxed mt-2 line-clamp-2">
                               {selectedPost.repost.caption}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="w-full flex-1 relative bg-black overflow-hidden flex items-center justify-center">
                           {selectedPost.repost.imageUrl && (
                             <img 
                               src={selectedPost.repost.imageUrl} 
                               alt="Repost content" 
                               className="w-full h-full object-contain pointer-events-none" 
                               loading="lazy" 
                               onError={handleMediaError}
                             />
                           )}
                           {selectedPost.repost.videoUrl && (
                             <video 
                               src={selectedPost.repost.videoUrl} 
                               className="max-w-full max-h-full object-contain"
                               controls
                               muted
                             />
                           )}
                           {selectedPost.repost.textOverlay?.trim() && (
                             <div 
                               style={{ 
                                 color: selectedPost.repost.textOverlayColor || '#ffffff', 
                                 fontSize: `${selectedPost.repost.textOverlaySize || 20}px`,
                                 top: `${selectedPost.repost.textOverlayPos ?? 50}%`,
                                 textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)',
                                 whiteSpace: 'pre-line'
                               }} 
                               className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center font-black tracking-tight pointer-events-none z-20 select-none px-4 py-1.5 rounded bg-black/40 backdrop-blur-[2px] border border-white/10 w-[90%]"
                             >
                               {selectedPost.repost.textOverlay}
                             </div>
                           )}
                        </div>
                      </div>
                    </div>
                  );
                }

                const isTextPost = (!selectedPost.mediaList || selectedPost.mediaList.length === 0) && !selectedPost.videoUrl && !selectedPost.imageUrl;
                if (isTextPost) {
                  return (
                    <div className={`w-full h-full flex flex-col items-center justify-center p-8 ${selectedPost.bg || 'bg-gradient-to-br from-indigo-500 to-purple-600'} rounded-xl overflow-hidden relative shadow-inner`}>
                      <div className="w-full flex-1 overflow-y-auto no-scrollbar flex flex-col items-center justify-center py-6">
                        <p className={`${getFontClass(selectedPost.font)} ${getAlignClass(selectedPost.alignment)} ${selectedPost.size || (selectedPost.caption.length > 50 ? 'text-2xl' : 'text-5xl')} ${selectedPost.color || 'text-white'} font-black break-words w-full`}>
                          {selectedPost.caption}
                        </p>
                      </div>
                    </div>
                  );
                }

                const mediaList = selectedPost.mediaList || [];
                const currentMedia = mediaList.length > 0 
                  ? mediaList[currentMediaIdx] 
                  : { url: selectedPost.videoUrl || selectedPost.imageUrl || '', type: selectedPost.videoUrl ? 'video' : 'image', name: '' };

                return (
                  <>
                    {currentMedia.type === 'video' ? (
                      <video
                        key={`modal-mob-vid-${currentMediaIdx}`}
                        src={currentMedia.url || undefined}
                        autoPlay
                        loop
                        playsInline
                        muted
                        controls
                        preload="auto"
                        className="w-full h-full object-contain"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickY = e.clientY - rect.top;
                          if (clickY > rect.height - 60) {
                            e.stopPropagation();
                          }
                        }}
                      />
                    ) : currentMedia.type === 'audio' ? (
                      <div className="flex flex-col items-center justify-center p-8 bg-card border border-border shadow-2xl rounded-2xl w-full max-w-[280px] aspect-square relative z-10" onClick={(e) => e.stopPropagation()}>
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 relative overflow-hidden animate-pulse">
                          <Music className="w-8 h-8 animate-bounce" />
                        </div>
                        <p className="font-bold text-xs text-center mb-1 max-w-[240px] truncate text-white">{currentMedia.name || 'Audio Track'}</p>
                        <p className="text-[10px] text-muted-foreground mb-4 font-mono">Audio Track</p>
                        <audio src={currentMedia.url || undefined} controls className="w-full scale-90 accent-primary focus:outline-none" />
                      </div>
                    ) : (
                      <img
                        key={`modal-mob-img-${currentMediaIdx}`}
                        src={currentMedia.url || undefined}
                        className="w-full h-full object-contain pointer-events-none"
                        alt="Post"
                        onError={handleMediaError}
                      />
                    )}

                    {/* Mobile swipe layout arrows - hidden on mobile/tablet, shown on desktop (lg) */}
                    {mediaList.length > 1 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentMediaIdx((prev) => (prev === 0 ? mediaList.length - 1 : prev - 1));
                          }}
                          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/75 hidden lg:flex items-center justify-center text-white transition-all z-20 shadow-md active:scale-95"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentMediaIdx((prev) => (prev === mediaList.length - 1 ? 0 : prev + 1));
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/75 hidden lg:flex items-center justify-center text-white transition-all z-20 shadow-md active:scale-95"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
                          {mediaList.map((_, i) => (
                            <div
                              key={`m-dot-mob-${i}`}
                              className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentMediaIdx ? 'bg-white scale-110' : 'bg-white/40'}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}

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

            <div className="p-4 space-y-6">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-border shrink-0 mt-1">
                  <img
                    src={selectedPost.user?.avatarUrl || undefined}
                    alt="user"
                    className="w-full h-full object-cover"
                    onError={handleAvatarError}
                  />
                </div>
                <div>
                  <span className="font-bold text-[15px] mr-2">
                    {selectedPost.user?.username || 'Unknown'}
                  </span>
                <div className="mt-1">
                  <p className={`text-[14px] leading-relaxed break-words ${getFontClass(selectedPost.font)} ${getAlignClass(selectedPost.alignment)} ${selectedPost.color || 'text-foreground'}`}>
                    {truncateText(selectedPost.caption, 180).text}
                    {truncateText(selectedPost.caption, 180).showMore && (
                      <button onClick={() => setShowFullCaption(true)} className="text-muted-foreground ml-2 hover:underline font-bold">view more</button>
                    )}
                  </p>
                </div>
                  {showFullCaption && <CaptionModal post={selectedPost} onClose={() => setShowFullCaption(false)} />}
                  <div className="text-[11px] font-bold tracking-widest text-muted-foreground mt-2 uppercase">
                    {formatTimeAgo(selectedPost.createdAt)}
                  </div>
                </div>
              </div>

              {(db?.postComments?.[selectedPost.id] || []).map(
                (comment: any, i: number) => (
                  <CommentItem
                    key={comment.id || "lc-" + i}
                    comment={comment}
                  />
                ),
              )}
            </div>
          </div>

          <div className="border-t border-border shrink-0 bg-card">
            <div className="p-3 space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      db.updatePost(selectedPost.id, (p) => ({
                        ...p,
                        isLiked: !p.isLiked,
                        likes: p.isLiked ? (p.likes || 0) - 1 : (p.likes || 0) + 1,
                      }));
                    }}
                    className="hover:text-red-500 transition-colors hover:scale-110"
                  >
                    <Heart
                      fill={selectedPost.isLiked ? "currentColor" : "none"}
                      className={`w-6 h-6 transition-colors ${selectedPost.isLiked ? "text-red-500" : "text-foreground"}`}
                    />
                  </button>
                  <button
                    onClick={() => commentInputRef.current?.focus()}
                    className="hover:text-muted-foreground transition-colors hover:scale-110"
                  >
                    <MessageCircle className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="hover:text-muted-foreground transition-colors hover:scale-110"
                  >
                    <Send className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => setShowRepostModal(true)}
                    className="hover:text-muted-foreground transition-colors hover:scale-110"
                  >
                    <Share className="w-6 h-6" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    db.updatePost(selectedPost.id, (p) => ({
                      ...p,
                      isSaved: !p.isSaved,
                    }));
                  }}
                  className="hover:opacity-70 transition-colors hover:scale-110 group"
                >
                  <Bookmark
                    fill={selectedPost.isSaved ? "currentColor" : "none"}
                    className="w-6 h-6 transition-colors text-foreground"
                  />
                </button>
              </div>
              <div className="font-bold text-[14px]">
                {(selectedPost?.likes || 0).toLocaleString()} likes
              </div>
            </div>

            {commentMedia.length > 0 && (
              <div className="ml-4 mt-2 mb-2 flex gap-2 overflow-x-auto py-2">
                {commentMedia.map((media, idx) => (
                  <div
                    key={idx}
                    className="relative inline-block p-1 border border-border rounded-lg max-w-[100px] h-20 group shrink-0"
                  >
                    {media.isVideo ? (
                      <video
                        src={media.url || undefined}
                        className="w-full h-full object-cover rounded-md"
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                      />
                    ) : (
                      <img
                        src={media.url || undefined}
                        className="w-full h-full object-cover rounded-md"
                        onError={handleMediaError}
                      />
                    )}
                    <button
                      onClick={() =>
                        setCommentMedia((prev) =>
                          prev.filter((_, i) => i !== idx),
                        )
                      }
                      className="absolute -top-2 -right-2 bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={handleCommentSubmit}
              className="border-t border-border p-2 md:p-3 pb-[calc(8px+env(safe-area-inset-bottom))] md:pb-3 flex flex-col bg-secondary/20 shrink-0"
            >
              {replyingTo && (
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium bg-card border border-border px-3 py-1 rounded-full self-start mb-2 shadow-sm">
                  <span>
                    Replying to{" "}
                    <span className="font-bold text-foreground">
                      @{replyingTo.username}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="ml-2 hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center w-full">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`p-1.5 md:p-2 hover:bg-secondary rounded-full mr-1 md:mr-2 transition-colors ${
                      showEmojiPicker
                        ? "text-primary bg-secondary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Smile className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                  {showEmojiPicker && (
                    <>
                      {/* Mobile Backdrop & Full Bottom Panel */}
                      <div
                        className="fixed inset-0 bg-background z-[2700] md:hidden block pointer-events-auto"
                        onClick={() => setShowEmojiPicker(false)}
                      />
                      <div className="fixed bottom-0 left-0 right-0 h-[60vh] bg-card rounded-t-[32px] border-t border-border z-[2800] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 md:hidden block pointer-events-auto">
                        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/10 shrink-0">
                          <span className="font-bold text-base">Select Emojis</span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowEmojiPicker(false);
                              commentInputRef.current?.focus();
                            }}
                            className="px-4 py-1.5 bg-primary text-primary-foreground font-bold rounded-full text-sm hover:opacity-90 transition-opacity"
                          >
                            Done
                          </button>
                        </div>
                        <div className="flex-1 w-full overflow-hidden">
                          <EmojiPicker
                            onEmojiClick={(emoji) => {
                              setCommentText((prev) => prev + emoji.emoji);
                              commentInputRef.current?.focus();
                            }}
                            width="100%"
                            height="100%"
                            previewConfig={{ showPreview: false }}
                          />
                        </div>
                      </div>

                      {/* Desktop Popover */}
                      <div className="absolute bottom-full left-0 mb-2 z-[2100] hidden md:block animate-in fade-in duration-200 pointer-events-auto">
                        <EmojiPicker
                          onEmojiClick={(emoji) => {
                            setCommentText((prev) => prev + emoji.emoji);
                            commentInputRef.current?.focus();
                          }}
                          previewConfig={{ showPreview: false }}
                        />
                      </div>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  id="comment-media"
                  className="hidden"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleMediaUpload}
                />
                <label
                  htmlFor="comment-media"
                  className="p-1.5 md:p-2 hover:bg-secondary rounded-full mr-2 md:mr-3 cursor-pointer transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Plus className="w-5 h-5 md:w-6 md:h-6" />
                </label>
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 bg-transparent border-none outline-none text-[14px] md:text-[15px] font-medium px-1 placeholder:text-muted-foreground/70"
                />
                <button
                  type="button"
                  className="p-1.5 md:p-2 hover:bg-secondary rounded-full mr-1 md:mr-2 transition-colors text-muted-foreground hover:text-foreground"
                >
                   <Mic className="w-5 h-5 md:w-6 md:h-6" />
                </button>
                <button
                  type="submit"
                  className="text-primary font-bold ml-2 md:ml-3 hover:text-primary/80 transition-colors disabled:opacity-50 text-[14px] md:text-[15px]"
                  disabled={!commentText.trim() && commentMedia.length === 0}
                >
                  Post
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {showShareModal && (
        <div className="fixed inset-0 z-[2500] flex items-end sm:items-center justify-center pointer-events-none">
          <div
            className="absolute inset-0 bg-background pointer-events-auto"
            onClick={() => setShowShareModal(false)}
          ></div>
          <div className="w-full max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl p-6 relative z-10 pointer-events-auto shadow-2xl overflow-hidden translate-y-0 opacity-100 transition-all duration-300">
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6 sm:hidden"></div>
            <h3 className="text-xl font-bold mb-6 text-center">
              Share to Messages
            </h3>
            <div className="flex gap-4 mb-6 overflow-x-auto no-scrollbar pb-2">
              {db.users
                .filter((u) => u.id !== db.currentUser.id)
                .map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      setShowShareModal(false);
                      db.addMessage(u.id, {
                        text: `Shared a post: https://instacollab.app/p/${selectedPost.id}`,
                        isAuthor: true,
                      });
                    }}
                    className="flex flex-col items-center gap-2 cursor-pointer group min-w-[72px]"
                  >
                    <div className="w-14 h-14 rounded-full border border-border group-hover:border-primary transition-colors overflow-hidden bg-card">
                      <img
                        src={u.avatarUrl || undefined}
                        alt={u.username}
                        className="w-full h-full object-cover"
                        onError={handleAvatarError}
                      />
                    </div>
                    <span className="text-xs font-bold text-center truncate w-full px-1">
                      {u.username}
                    </span>
                  </div>
                ))}
            </div>
            <div className="flex items-center gap-3 p-3 bg-secondary rounded-xl border border-border">
              <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center border border-border shrink-0">
                <Link className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 truncate text-sm font-medium text-muted-foreground">
                https://instacollab.app/p/{selectedPost.id}
              </div>
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-bold shrink-0 hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {fullscreenMedia && createPortal(
        <div 
          id="media-full-screen-modal"
          className="fixed inset-0 z-[2500] flex items-center justify-center bg-background pointer-events-auto animate-in fade-in duration-200"
          onTouchStart={handleFsTouchStart}
          onTouchMove={handleFsTouchMove}
          onTouchEnd={handleFsTouchEnd}
        >
          <button
            onClick={() => setFullscreenMedia(null)}
            className="absolute top-4 right-4 z-[2600] text-foreground p-2 hover:bg-secondary rounded-full transition-colors cursor-pointer border border-border shadow-sm"
          >
            <X className="w-8 h-8" />
          </button>
          
          <div className="w-full h-full flex items-center justify-center p-4 select-none overflow-hidden" onClick={() => setFullscreenMedia(null)}>
            {(() => {
              const item = fullscreenMedia.items[fullscreenMedia.mediaIndex];
              if (!item) return null;

              if (item.isText) {
                return (
                  <div className={`w-full max-w-2xl h-full max-h-[85vh] flex flex-col items-center justify-center p-12 ${item.bg && !item.bg.includes('bg-secondary') ? item.bg : 'bg-card'} rounded-3xl relative shadow-2xl overflow-hidden`} onClick={(e) => e.stopPropagation()}>
                    <div className="w-full flex-1 overflow-y-auto no-scrollbar flex flex-col items-center justify-center py-8 text-center px-4">
                       <p className={`${getFontClass(item.font)} ${getAlignClass(item.alignment)} ${item.size || (item.caption?.length > 50 ? 'text-3xl' : 'text-6xl')} ${(item.bg && !item.bg.includes('bg-secondary')) ? (item.color || 'text-white') : 'text-foreground'} font-black break-words w-full`}>
                         {item.caption}
                       </p>
                    </div>
                  </div>
                );
              }

              if (item.isVideo) {
                return (
                  <video
                    key={`fs-vid-${fullscreenMedia.mediaIndex}`}
                    src={item.url || undefined}
                    className="max-w-full max-h-full object-contain"
                    controls
                    autoPlay
                    loop
                    playsInline
                    preload="auto"
                  />
                );
              } else if (item.isAudio) {
                return (
                  <div className="flex flex-col items-center justify-center p-10 bg-card border border-border shadow-2xl rounded-2xl w-full max-w-[340px] aspect-square relative z-10" onClick={(e) => e.stopPropagation()}>
                    <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6 relative overflow-hidden animate-pulse">
                      <Music className="w-12 h-12" />
                    </div>
                    <p className="font-bold text-base text-center mb-1 max-w-[280px] truncate text-white">{item.name || 'Audio Track'}</p>
                    <p className="text-xs text-muted-foreground mb-6 font-mono">Audio Track</p>
                    <audio src={item.url || undefined} controls className="w-full accent-primary focus:outline-none" />
                  </div>
                );
              } else {
                return (
                  <img
                    key={`fs-img-${fullscreenMedia.mediaIndex}`}
                    src={item.url || undefined}
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    alt="Fullscreen media"
                    onError={handleMediaError}
                  />
                );
              }
            })()}
          </div>

          {/* Navigation Controls - Hidden on Mobile / Tablet, Swipes active everywhere */}
          {fullscreenMedia.items.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenMedia((prev) => 
                    prev ? { ...prev, mediaIndex: (prev.mediaIndex === 0 ? prev.items.length - 1 : prev.mediaIndex - 1) } : null
                  );
                }}
                className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 hidden lg:flex items-center justify-center text-white transition-all z-[260] hover:scale-105 active:scale-95"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenMedia((prev) => 
                    prev ? { ...prev, mediaIndex: (prev.mediaIndex === prev.items.length - 1 ? 0 : prev.mediaIndex + 1) } : null
                  );
                }}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 hidden lg:flex items-center justify-center text-white transition-all z-[260] hover:scale-105 active:scale-95"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Index indicator */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-[260] bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full">
                {fullscreenMedia.items.map((_, i) => (
                  <div 
                    key={`fs-dot-${i}`}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === fullscreenMedia.mediaIndex ? 'bg-white scale-125' : 'bg-white/30'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
      {showRepostModal && (
        <RepostModal post={selectedPost} onClose={() => setShowRepostModal(false)} />
      )}
    </div>,
    document.body
  );
}
