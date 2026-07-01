import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  Smile,
  X,
  Plus,
  Mic,
  ChevronLeft,
  ChevronRight,
  Music,
  ArrowLeft,
} from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useDB, usePostById } from "../../lib/useDB";
import { useToast } from "../../lib/ToastContext";
import { useVoice } from "../../lib/useVoice";
import {
  formatContentDateTime,
  formatRepostedDateTime,
  formatPostedDateTime,
  contentTimestampIso,
  openProfilePreview,
  handleAvatarError,
  handleMediaError,
  fileToBase64,
  getFontClass,
  getAlignClass,
  truncateText,
  resolveCaptionColorClass,
  resolveEditorTextColorClass,
  formatMentionsAndTags,
} from "../../lib/utils";
import { touchClientX, postUserId, resolveUser, resolvePostDisplayMedia, safeMediaUrl } from "../../lib/safe";
import { openNativeVideoFullscreen } from "../../lib/useNativeVideoFullscreen";
import { buildCommentPayload, type CommentLike } from "../../lib/entityResolve";
import { isPlayableAudioUrl, resolveEditorSoundtrackUrl } from "../../lib/audioMedia";
import {
  boostPostFeedAudioRegistry,
  pinPostAudioEntry,
  unpinPostAudioEntry,
  usePostPlaybackAudio,
} from "../../lib/postAudioRegistry";
import { MediaWithSoundtrack } from "../common/MediaWithSoundtrack";
import { ShareIcon } from "../common/ShareIcon";
import { ShareModal } from "./ShareModal";
import { buildPostSharePayload } from "../../lib/shareLinks";
import { FullscreenMediaStage } from "../common/FullscreenMediaStage";
import { FullscreenPostMediaContent } from "../common/FullscreenPostMediaContent";
import { PLAYBACK_PRIORITY } from "../../lib/playbackAudio";
import { buildMediaFilterStyle } from "../../lib/mediaFilters";
import {
  postPlaybackId,
  preparePostPlaybackExit,
  resetPostPlayback,
} from "../../lib/postPlayback";
import { useExclusivePlayback } from "../../lib/useExclusivePlayback";
import {
  useFullscreenOpenGuard,
  useMediaOverlayAcquire,
} from "../../lib/mediaOverlayLock";
import { useCarouselNativeVideoAdvance } from "../../lib/useCarouselNativeVideoAdvance";
import {
  IMAGE_CAROUSEL_MS,
  nextCarouselIndex,
  postCarouselItemCount,
  shouldLoopCarouselItem,
} from "../../lib/mediaPlayback";
import {
  getOptionsMenuItemClass,
  optionsMenuItemPointerHandlers,
  useOptionsMenuHover,
  type OptionsMenuTone,
} from "../../lib/optionsMenu";
import { CaptionModal } from './CaptionModal';
import { PostModalCommentItem } from "./PostModalCommentItem";
import { RepostPostMediaPanel } from './RepostPostMediaPanel';
import { PostContentFullscreenPortal } from './PostContentFullscreenPortal';
import { Avatar } from "../common/Avatar";
import { ProfileNamePrimary } from "../common/ProfileNameLines";
import { getProfileDisplayName } from "../../lib/profileDisplay";
import {
  isPostTextOnly,
  resolvePostModalMedia,
} from '../../lib/repostMedia';
import { Waveform } from "../messages/Waveform";
import { VoiceMessagePlayer } from "../messages/VoiceMessagePlayer";
import { InlineAttachmentVideo } from "../common/InlineAttachmentVideo";
import { PLAYBACK_SCOPE } from "../../lib/playbackScope";
import { nativeVideoControlGuardProps } from "../../lib/nativeVideoControls";
import type { Post } from "../../types";

export function PostModal({
  postId,
  onClose,
}: {
  postId: string;
  onClose: () => void;
}) {
  const db = useDB();
  const { showToast } = useToast();
  const selectedPost = usePostById(postId);
  const modalMedia = useMemo(
    () =>
      selectedPost
        ? resolvePostModalMedia(selectedPost, db.posts, db.users)
        : null,
    [selectedPost, db.posts, db.users],
  );
  const livePost = modalMedia?.livePost ?? selectedPost;
  const mediaPost = modalMedia?.mediaPost ?? null;
  const mediaLivePost = modalMedia?.mediaLivePost ?? null;
  const isRepostEmbed = modalMedia?.isRepostEmbed ?? false;
  const repostHeaderPost = modalMedia?.repostHeaderPost ?? null;
  const playbackWrapperId = modalMedia?.playbackWrapperId ?? postId;
  const mediaPlaybackId = modalMedia?.mediaPlaybackId ?? playbackWrapperId;
  const postAuthor = selectedPost
    ? resolveUser(db.users, selectedPost.user)
    : null;
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    username: string;
  } | null>(null);
  const [commentMedia, setCommentMedia] = useState<
    { url: string; isVideo: boolean; isAudio?: boolean; name?: string }[]
  >([]);
  const {
    isListening,
    isRecording,
    recordedVoice,
    toggleListening,
    stopListening,
    startRecording,
    stopRecording,
    clearRecording
  } = useVoice((text) => setCommentText(text));
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const micModeRef = useRef<'idle' | 'pressing' | 'recording'>('idle');

  const [showShareModal, setShowShareModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const { hoveredMenuItem, setHoveredMenuItem } = useOptionsMenuHover(showOptionsModal);
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
      audioUrl?: string;
    }>;
    mediaIndex: number;
  } | null>(null);
  const [isPostContentFullscreen, setIsPostContentFullscreen] = useState(false);

  const isAttachmentFullscreen = !!fullscreenMedia;
  const isAnyMediaFullscreen = isPostContentFullscreen || isAttachmentFullscreen;

  const { markOpened: markModalFsOpened, shouldIgnoreClose: shouldIgnoreModalFsBackdropClose } =
    useFullscreenOpenGuard(isAnyMediaFullscreen);

  useMediaOverlayAcquire(isAnyMediaFullscreen);

  const [currentMediaIdx, setCurrentMediaIdx] = useState(0);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    setCurrentMediaIdx(0);
    setVideoError(false);
    setIsPostContentFullscreen(false);
    setFullscreenMedia(null);
  }, [postId, mediaPost?.id]);

  useEffect(() => {
    if (!mediaPlaybackId) return;
    pinPostAudioEntry(mediaPlaybackId);
    if (isRepostEmbed && playbackWrapperId !== mediaPlaybackId) {
      resetPostPlayback(playbackWrapperId);
    }
    return () => unpinPostAudioEntry(mediaPlaybackId);
  }, [mediaPlaybackId, isRepostEmbed, playbackWrapperId]);
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const modalFsVideoRef = useRef<HTMLVideoElement>(null);
  const modalCarouselAudioRef = useRef<HTMLAudioElement>(null);
  const commentVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const fsItemForPlayback = fullscreenMedia?.items[fullscreenMedia.mediaIndex];
  const displayMediaForPlaybackHook = mediaPost
    ? resolvePostDisplayMedia(mediaPost, currentMediaIdx)
    : null;
  const postSoundtrackForVideoHook = mediaPost
    ? resolveEditorSoundtrackUrl(
        mediaPost.audioUrl,
        displayMediaForPlaybackHook?.type ?? 'image'
      )
    : undefined;
  const fsSoundtrackForVideoHook =
    selectedPost && fsItemForPlayback && !fsItemForPlayback.isText
      ? resolveEditorSoundtrackUrl(
          fsItemForPlayback.audioUrl,
          fsItemForPlayback.isVideo
            ? 'video'
            : fsItemForPlayback.isAudio
              ? 'audio'
              : 'image'
        )
      : undefined;
  const activeSoundtrackForVideoHook = isPostContentFullscreen
    ? postSoundtrackForVideoHook
    : isAttachmentFullscreen
      ? fsSoundtrackForVideoHook
      : postSoundtrackForVideoHook;
  const modalShowVideoHook =
    displayMediaForPlaybackHook?.type === 'video' &&
    !videoError &&
    !displayMediaForPlaybackHook?.showAsImage;
  const fsShowVideoHook = isPostContentFullscreen
    ? modalShowVideoHook
    : !!(fullscreenMedia && fsItemForPlayback?.isVideo);
  const modalVideoWantsPlay =
    !!selectedPost &&
    !db.isCreatorEditingActive &&
    !activeSoundtrackForVideoHook &&
    (isAnyMediaFullscreen ? fsShowVideoHook : modalShowVideoHook);
  useExclusivePlayback(
    mediaPlaybackId ? postPlaybackId(mediaPlaybackId, "video") : "post:__none__:video",
    PLAYBACK_PRIORITY.MODAL,
    modalVideoWantsPlay && !isAnyMediaFullscreen,
    modalVideoRef,
    "modal"
  );

  useExclusivePlayback(
    mediaPlaybackId ? postPlaybackId(mediaPlaybackId, "video-fs") : "post:__none__:video-fs",
    PLAYBACK_PRIORITY.MODAL_FS,
    modalVideoWantsPlay && isAnyMediaFullscreen && fsShowVideoHook,
    modalFsVideoRef,
    "modal-fs"
  );

  const modalCarouselAudioEligible =
    !!selectedPost && !db.globalMuted && !db.isCreatorEditingActive;
  const modalInlineCarouselAudio =
    modalCarouselAudioEligible &&
    !isAnyMediaFullscreen &&
    displayMediaForPlaybackHook?.type === "audio";
  const modalFsCarouselAudio =
    modalCarouselAudioEligible &&
    isAnyMediaFullscreen &&
    (isPostContentFullscreen
      ? displayMediaForPlaybackHook?.type === "audio"
      : !!fsItemForPlayback?.isAudio);

  useExclusivePlayback(
    mediaPlaybackId ? postPlaybackId(mediaPlaybackId, "carousel-audio") : "post:__none__:carousel-audio",
    PLAYBACK_PRIORITY.MODAL,
    modalInlineCarouselAudio,
    modalCarouselAudioRef,
    "modal"
  );

  useExclusivePlayback(
    mediaPlaybackId ? postPlaybackId(mediaPlaybackId, "carousel-audio-fs") : "post:__none__:carousel-audio-fs",
    PLAYBACK_PRIORITY.MODAL_FS,
    modalFsCarouselAudio,
    modalCarouselAudioRef,
    "modal-fs"
  );

  const carouselItemCount = mediaPost ? postCarouselItemCount(mediaPost) : 0;
  const loopCarouselItem = shouldLoopCarouselItem(carouselItemCount);

  const modalCarouselVideoUrl =
    modalShowVideoHook && displayMediaForPlaybackHook?.url
      ? displayMediaForPlaybackHook.url
      : undefined;

  const { wrapCarouselAdvance } = useCarouselNativeVideoAdvance(
    modalVideoRef,
    currentMediaIdx,
    modalCarouselVideoUrl,
    modalShowVideoHook && !isAnyMediaFullscreen,
    { coordinatorOwnsPlay: true }
  );

  const goToPrevCarouselItem = useCallback(() => {
    if (carouselItemCount <= 1) return;
    wrapCarouselAdvance(() => {
      setCurrentMediaIdx((prev) => (prev === 0 ? carouselItemCount - 1 : prev - 1));
    });
  }, [carouselItemCount, wrapCarouselAdvance]);

  const goToNextCarouselItem = useCallback(() => {
    if (carouselItemCount <= 1) return;
    wrapCarouselAdvance(() => {
      setCurrentMediaIdx((prev) => nextCarouselIndex(prev, carouselItemCount));
    });
  }, [carouselItemCount, wrapCarouselAdvance]);

  const goToNextFullscreenItem = useCallback(() => {
    setFullscreenMedia((prev) => {
      if (!prev || prev.items.length <= 1) return prev;
      return {
        ...prev,
        mediaIndex: nextCarouselIndex(prev.mediaIndex, prev.items.length),
      };
    });
  }, []);

  useEffect(() => {
    if (!selectedPost || loopCarouselItem || isAnyMediaFullscreen) return;
    const item = mediaPost?.mediaList?.[currentMediaIdx];
    if (!item || item.type !== "image") return;
    const timer = window.setTimeout(goToNextCarouselItem, IMAGE_CAROUSEL_MS);
    return () => window.clearTimeout(timer);
  }, [
    selectedPost,
    loopCarouselItem,
    isAnyMediaFullscreen,
    currentMediaIdx,
    goToNextCarouselItem,
    mediaPost?.mediaList,
  ]);

  useEffect(() => {
    if (!isPostContentFullscreen || loopCarouselItem || carouselItemCount <= 1) return;
    const item = mediaPost?.mediaList?.[currentMediaIdx];
    if (!item || item.type !== "image") return;
    const timer = window.setTimeout(goToNextCarouselItem, IMAGE_CAROUSEL_MS);
    return () => window.clearTimeout(timer);
  }, [
    isPostContentFullscreen,
    loopCarouselItem,
    carouselItemCount,
    currentMediaIdx,
    goToNextCarouselItem,
    mediaPost?.mediaList,
  ]);

  useEffect(() => {
    if (!fullscreenMedia || fullscreenMedia.items.length <= 1) return;
    const item = fullscreenMedia.items[fullscreenMedia.mediaIndex];
    if (!item || item.isVideo || item.isAudio || item.isText) return;
    const timer = window.setTimeout(goToNextFullscreenItem, IMAGE_CAROUSEL_MS);
    return () => window.clearTimeout(timer);
  }, [fullscreenMedia, goToNextFullscreenItem]);

  const modalAudioIntentKeyEarly = isAnyMediaFullscreen ? "modal-fs" : "modal";
  const isTextPostEarly = isPostTextOnly(mediaLivePost);
  const postSoundtrackEarly =
    mediaPost && displayMediaForPlaybackHook
      ? resolveEditorSoundtrackUrl(
          mediaPost.audioUrl,
          displayMediaForPlaybackHook.type
        )
      : undefined;
  const activeSoundtrackEarly = isPostContentFullscreen
    ? postSoundtrackEarly
    : isAttachmentFullscreen
      ? fsSoundtrackForVideoHook
      : postSoundtrackEarly;
  const activeTextEarly =
    isAttachmentFullscreen &&
    fsItemForPlayback?.isText &&
    isPlayableAudioUrl(fsItemForPlayback.audioUrl)
      ? fsItemForPlayback.audioUrl
      : !isAnyMediaFullscreen &&
          isTextPostEarly &&
          mediaPost &&
          isPlayableAudioUrl(mediaPost.audioUrl)
        ? mediaPost.audioUrl
        : undefined;
  const loopEarly = shouldLoopCarouselItem(carouselItemCount);

  usePostPlaybackAudio(mediaPlaybackId || "__none__", modalAudioIntentKeyEarly, {
    soundtrackUrl: activeSoundtrackEarly,
    textAudioUrl: activeTextEarly,
    priority: isAnyMediaFullscreen
      ? PLAYBACK_PRIORITY.MODAL_FS
      : PLAYBACK_PRIORITY.MODAL,
    active: !!selectedPost && !db.globalMuted && !db.isCreatorEditingActive,
    muted: db.globalMuted,
    loop: isPostContentFullscreen
      ? loopEarly
      : isAttachmentFullscreen
        ? fullscreenMedia!.items.length <= 1
        : loopEarly,
    onEnded: isPostContentFullscreen
      ? loopEarly
        ? undefined
        : goToNextCarouselItem
      : isAttachmentFullscreen
        ? fullscreenMedia!.items.length <= 1
          ? undefined
          : goToNextFullscreenItem
        : loopEarly
          ? undefined
          : goToNextCarouselItem,
  });

  const me = resolveUser(db.users, db.currentUser);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(touchClientX(e.targetTouches));
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(touchClientX(e.targetTouches));
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || !selectedPost) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe || isRightSwipe) {
      const mediaList = mediaPost?.mediaList || [];
      const listLength = mediaList.length > 0 
        ? mediaList.length 
        : (mediaPost?.videoUrl || mediaPost?.imageUrl ? 1 : 0);
      if (listLength > 1) {
        if (isLeftSwipe) {
          goToNextCarouselItem();
        } else {
          goToPrevCarouselItem();
        }
      }
    }
  };

  // Full screen swipe handlers
  const [fsTouchStart, setFsTouchStart] = useState<number | null>(null);
  const [fsTouchEnd, setFsTouchEnd] = useState<number | null>(null);

  const handleFsTouchStart = (e: React.TouchEvent) => {
    setFsTouchEnd(null);
    setFsTouchStart(touchClientX(e.targetTouches));
  };

  const handleFsTouchMove = (e: React.TouchEvent) => {
    setFsTouchEnd(touchClientX(e.targetTouches));
  };

  const handleFsTouchEnd = () => {
    if (!fsTouchStart || !fsTouchEnd) return;
    const distance = fsTouchStart - fsTouchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe || isRightSwipe) {
      if (isPostContentFullscreen && carouselItemCount > 1) {
        if (isLeftSwipe) {
          goToNextCarouselItem();
        } else {
          goToPrevCarouselItem();
        }
        return;
      }
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
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMicPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerIdRef.current !== null) return;
    activePointerIdRef.current = event.pointerId;
    micModeRef.current = 'pressing';
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture may fail on unsupported environments.
    }
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }
    pressTimerRef.current = setTimeout(() => {
      if (isListening) stopListening();
      startRecording();
      micModeRef.current = 'recording';
      pressTimerRef.current = null;
    }, 500);
  };

  const finishMicInteraction = (event: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    activePointerIdRef.current = null;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore pointer capture release errors.
    }
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }

    if (cancelled) {
      if (micModeRef.current === 'recording') {
        stopRecording();
      }
      micModeRef.current = 'idle';
      return;
    }

    if (micModeRef.current === 'pressing') {
      toggleListening();
    } else if (micModeRef.current === 'recording') {
      stopRecording();
    }
    micModeRef.current = 'idle';
  };

  const handleMicPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    finishMicInteraction(event);
  };

  const handleMicPointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    finishMicInteraction(event, true);
  };

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
      }
      activePointerIdRef.current = null;
      micModeRef.current = 'idle';
    };
  }, []);

  const postSharePayload = selectedPost
    ? buildPostSharePayload(selectedPost.id)
    : null;

  const openModalFullscreen = useCallback(
    (state: NonNullable<typeof fullscreenMedia>) => {
      markModalFsOpened();
      setFullscreenMedia(state);
    },
    [markModalFsOpened]
  );

  if (!selectedPost || !livePost || !mediaPost || !mediaLivePost) return null;

  const repostEmbedHeader = repostHeaderPost ?? mediaPost;
  const attachmentMediaPost: Post | null = fullscreenMedia
    ? {
        id: `${selectedPost.id}:comment-attachment`,
        user: selectedPost.user,
        imageUrl: '',
        caption: '',
        likes: 0,
        comments: 0,
        createdAt: selectedPost.createdAt ?? new Date().toISOString(),
        isLiked: false,
        isSaved: false,
        mediaList: fullscreenMedia.items.map((m) => ({
          url: m.url,
          type: m.isVideo ? 'video' : m.isAudio ? 'audio' : 'image',
          name: m.name ?? '',
        })),
      }
    : null;

  const isTextPost = isPostTextOnly(mediaLivePost);
  const postFilterStyle = buildMediaFilterStyle(mediaPost?.filter, {
    brightness: mediaPost?.brightness,
    contrast: mediaPost?.contrast,
  });
  const displayMediaForPlayback = resolvePostDisplayMedia(
    mediaPost!,
    currentMediaIdx
  );
  const postSoundtrackUrl = resolveEditorSoundtrackUrl(
    mediaPost?.audioUrl,
    displayMediaForPlayback.type
  );

  const modalOpenMediaFullscreen = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!mediaPost) return;
    markModalFsOpened();
    setIsPostContentFullscreen(true);
  };

  const modalMediaStageProps = {
    currentMediaIdx,
    videoError,
    setVideoError,
    loopCarouselItem,
    showHeartAnimation,
    onShowFullCaption: () => setShowFullCaption(true),
    videoRef: modalVideoRef,
    carouselAudioRef: modalCarouselAudioRef,
    globalMuted: db.globalMuted,
    onSetGlobalMuted: db.setGlobalMuted,
    onOpenFullscreen: modalOpenMediaFullscreen,
    onPrevCarouselItem: goToPrevCarouselItem,
    onNextCarouselItem: goToNextCarouselItem,
    postAudioIntentKey: modalAudioIntentKeyEarly,
    postAudioPriority: PLAYBACK_PRIORITY.MODAL,
    playbackPostId: mediaPlaybackId,
    mediaObjectFit: 'contain' as const,
    deferVideoTapToParent: !isRepostEmbed,
    hideVideoControls: !isRepostEmbed,
  };

  const openCommentMediaFullscreen = (
    commentId: string,
    media: Array<{ url: string; isVideo?: boolean; isAudio?: boolean; name?: string }>,
    mediaIndex: number
  ) => {
    void commentId;
    openModalFullscreen({ items: media, mediaIndex });
  };

  const handleClose = () => {
    setIsPostContentFullscreen(false);
    setFullscreenMedia(null);
    preparePostPlaybackExit(postId);
    boostPostFeedAudioRegistry(postId, PLAYBACK_PRIORITY.FEED);
    onClose();
  };

  const handleCloseModalFullscreen = () => {
    setFullscreenMedia(null);
  };

  const handleClosePostContentFullscreen = () => {
    setIsPostContentFullscreen(false);
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_PRESS_DELAY) {
      if (!selectedPost.isLiked) {
        db.togglePostLike(selectedPost.id);
      }
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 1000);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current === now && mediaPost) {
          markModalFsOpened();
          setIsPostContentFullscreen(true);
        }
      }, DOUBLE_PRESS_DELAY);
    }
  };

  const handleCopyLink = () => {
    if (!postSharePayload) return;
    navigator.clipboard.writeText(postSharePayload.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderOptionsMenuButton = (
    id: string,
    label: string,
    tone: OptionsMenuTone,
    onSelect: () => void
  ) => (
    <button
      type="button"
      role="menuitem"
      className={getOptionsMenuItemClass(id, tone, hoveredMenuItem)}
      {...optionsMenuItemPointerHandlers(id, setHoveredMenuItem)}
      onClick={(e) => {
        e.stopPropagation();
        setShowOptionsModal(false);
        setHoveredMenuItem(null);
        onSelect();
      }}
    >
      {label}
    </button>
  );

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() && commentMedia.length === 0 && !recordedVoice) return;

    const mediaPayload = [
      ...(recordedVoice ? [{ url: recordedVoice, isAudio: true }] : []),
      ...commentMedia,
    ];

    const commentData = buildCommentPayload(
      me,
      commentText,
      mediaPayload.length > 0 ? { media: mediaPayload } : undefined
    );

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
    clearRecording();
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
        showToast("Could not attach media. Try a smaller file.");
      }
    }
  };
  const isCommentPostDisabled = !commentText.trim() && commentMedia.length === 0 && !recordedVoice;

  const commentItemProps = {
    db,
    me,
    selectedPost,
    openProfilePreview,
    commentVideoRefs,
    openCommentMediaFullscreen,
    setReplyingTo,
    setCommentText,
    commentInputRef,
  };

  return createPortal(
    <div
      id="post-modal"
      className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-background"
    >
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 text-foreground p-2 hover:bg-secondary rounded-full transition-colors z-50 cursor-pointer hidden md:block border border-border shadow-sm"
      >
        <X className="w-6 h-6" />
      </button>
      <div className="w-full h-full md:h-[85vh] max-w-5xl bg-background border-none md:border md:border-border shadow-2xl md:rounded-3xl flex flex-col md:flex-row overflow-hidden md:max-h-[800px]">
        <div 
          className="hidden md:flex w-3/5 bg-zinc-100 dark:bg-black items-center justify-center relative group cursor-pointer"
          onClick={handleDoubleTap}
        >
          {isDesktop && (() => {
            if (isRepostEmbed && mediaPost && mediaLivePost) {
              return (
                <div className="w-full h-full p-4 flex flex-col pointer-events-auto">
                  <RepostPostMediaPanel
                    repost={repostEmbedHeader}
                    mediaPost={mediaPost}
                    mediaLivePost={mediaLivePost}
                    isTextPost={isTextPost}
                    headerSize="md"
                    shellClassName="h-full w-full relative"
                    mediaStageProps={modalMediaStageProps}
                  />
                </div>
              );
            }

            if (isTextPost) {
              return (
                <div className={`w-full h-full flex flex-col items-center justify-center p-10 ${selectedPost.bg || 'bg-gradient-to-br from-indigo-500 to-purple-600'} rounded-xl overflow-hidden relative shadow-2xl`}>
                  <div className="w-full flex-1 overflow-y-auto no-scrollbar flex flex-col items-center justify-center py-8">
                    <p className={`story-user-text editor-adaptive-text ${getFontClass(selectedPost.font)} ${getAlignClass(selectedPost.alignment)} ${selectedPost.size || (selectedPost.caption.length > 50 ? 'text-3xl' : 'text-5xl')} ${resolveEditorTextColorClass(selectedPost.color)} font-black break-words w-full`}>
                      {formatMentionsAndTags(selectedPost.caption)}
                    </p>
                  </div>
                </div>
              );
            }

            const mediaList = mediaPost?.mediaList || [];
            const currentMedia = mediaList.length > 0 
              ? mediaList[currentMediaIdx] 
              : { url: mediaPost?.videoUrl || mediaPost?.imageUrl || '', type: mediaPost?.videoUrl ? 'video' : 'image', name: '' };
            return (
              <>
                {currentMedia.type === 'video' ? (
                  <MediaWithSoundtrack className="relative w-full h-full">
                  <video
                    data-playback-scope={PLAYBACK_SCOPE.MANAGED}
                    ref={modalVideoRef}
                    src={currentMedia.url || undefined}
                    loop={loopCarouselItem}
                    playsInline
                    muted={postSoundtrackUrl ? true : db.globalMuted}
                    controls
                    preload="auto"
                    onEnded={loopCarouselItem ? undefined : goToNextCarouselItem}
                    onVolumeChange={(e) => {
                      if (!postSoundtrackUrl) {
                        db.setGlobalMuted(e.currentTarget.muted);
                      }
                    }}
                    style={postFilterStyle}
                    className="w-full h-full object-contain"
                    {...nativeVideoControlGuardProps()}
                  />
                  </MediaWithSoundtrack>
                ) : currentMedia.type === 'audio' ? (
                  <div className="flex flex-col items-center justify-center p-8 bg-zinc-950 border border-zinc-800 shadow-2xl rounded-2xl w-full max-w-[325px] aspect-square relative z-10" onClick={(e) => e.stopPropagation()}>
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 relative overflow-hidden animate-pulse">
                      <Music className="w-10 h-10 animate-bounce" />
                      <div className="absolute inset-0 border-2 border-dashed border-primary/20 rounded-full animate-spin [animation-duration:10s]"></div>
                    </div>
                    <p className="font-bold text-sm text-center mb-1 max-w-[280px] truncate text-white">{currentMedia.name || 'Audio Track'}</p>
                    <p className="text-xs text-muted-foreground mb-4 font-mono">Audio Track</p>
                    <audio
                      ref={modalCarouselAudioRef}
                      src={currentMedia.url || undefined}
                      controls
                      loop={loopCarouselItem}
                      onEnded={loopCarouselItem ? undefined : goToNextCarouselItem}
                      className="w-full scale-95 accent-primary focus:outline-none"
                    />
                  </div>
                ) : (
                  <MediaWithSoundtrack className="relative w-full h-full">
                    <img
                      key={`modal-des-img-${currentMediaIdx}`}
                      src={currentMedia.url || undefined}
                      style={postFilterStyle}
                      className="w-full h-full object-contain pointer-events-none"
                      alt="Post"
                      onError={handleMediaError}
                    />
                  </MediaWithSoundtrack>
                )}

                {/* Desktop controls - hidden on mobile, shown on desktop (lg) */}
                {mediaList.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPrevCarouselItem();
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/75 hidden lg:flex items-center justify-center text-white transition-all z-20 shadow-md active:scale-95"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goToNextCarouselItem();
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
        <div className="w-full md:w-2/5 flex flex-col h-full bg-background relative overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0 sticky top-0 bg-background z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="md:hidden p-2 hover:bg-secondary rounded-full bg-background border border-border"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div 
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => postAuthor && openProfilePreview(postAuthor)}
              >
                <div className="w-9 h-9 rounded-full overflow-hidden border border-border group-hover:opacity-80 transition-opacity">
                  <Avatar user={postAuthor ?? resolveUser(db.users, db.currentUser)} size="sm" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-[14px] group-hover:underline leading-none">
                    <ProfileNamePrimary user={postAuthor} fallback="Unknown" />
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
                  <div className="fixed inset-0 z-40" onClick={() => setShowOptionsModal(false)} aria-hidden />
                  <div
                    role="menu"
                    onMouseLeave={() => setHoveredMenuItem(null)}
                    className="absolute right-0 top-full mt-2 w-48 min-w-[12rem] bg-white/70 dark:bg-black/75 backdrop-blur-xl backdrop-saturate-150 border border-black/10 dark:border-white/15 rounded-xl flex flex-col gap-1 p-1.5 z-50 shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)] overflow-hidden pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
                  >
                    {selectedPost.user?.id === me.id ? (
                      <>
                        {selectedPost.isArchived
                          ? renderOptionsMenuButton('unarchive', 'Unarchive', 'default', () => {
                              db.togglePostArchive(selectedPost.id);
                              showToast('Post restored to profile');
                              handleClose();
                            })
                          : renderOptionsMenuButton('archive', 'Archive', 'default', () => {
                              db.togglePostArchive(selectedPost.id);
                              showToast('Post archived');
                              handleClose();
                            })}
                        {renderOptionsMenuButton('delete', 'Delete Post', 'danger', () => {
                          db.deletePost(selectedPost.id);
                          handleClose();
                        })}
                      </>
                    ) : (
                      renderOptionsMenuButton('report', 'Report', 'danger', () => {
                          db.updatePost(selectedPost.id, (p) => ({
                            ...p,
                            isReported: true,
                          }));
                        })
                    )}
                    {selectedPost.user?.id !== me.id &&
                      renderOptionsMenuButton('unfollow', 'Unfollow', 'danger', () => {
                        const authorId = postUserId(selectedPost);
                        if (authorId && postAuthor?.isFollowing) {
                          db.toggleFollow(authorId);
                        }
                      })}
                    {renderOptionsMenuButton('favorite', 'Add to favorites', 'default', () => {
                      if (!selectedPost.isSaved) db.togglePostSave(selectedPost.id);
                    })}
                    {renderOptionsMenuButton('copy', 'Copy link', 'default', () => {
                      handleCopyLink();
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar bg-secondary/10 flex flex-col">
            <div 
              className="md:hidden w-full aspect-square bg-black shrink-0 relative cursor-pointer"
              onClick={handleDoubleTap}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {!isDesktop && (() => {
                if (isRepostEmbed && mediaPost && mediaLivePost) {
                  return (
                    <div className="w-full h-full p-3 flex flex-col pointer-events-auto">
                      <RepostPostMediaPanel
                        repost={repostEmbedHeader}
                        mediaPost={mediaPost}
                        mediaLivePost={mediaLivePost}
                        isTextPost={isTextPost}
                        headerSize="sm"
                        shellClassName="h-full w-full relative"
                        mediaStageProps={modalMediaStageProps}
                      />
                    </div>
                  );
                }

                if (isTextPost) {
                  return (
                    <div className={`w-full h-full flex flex-col items-center justify-center p-8 ${selectedPost.bg || 'bg-gradient-to-br from-indigo-500 to-purple-600'} rounded-xl overflow-hidden relative shadow-inner`}>
                      <div className="w-full flex-1 overflow-y-auto no-scrollbar flex flex-col items-center justify-center py-6">
                        <p className={`story-user-text editor-adaptive-text ${getFontClass(selectedPost.font)} ${getAlignClass(selectedPost.alignment)} ${selectedPost.size || (selectedPost.caption.length > 50 ? 'text-2xl' : 'text-5xl')} ${resolveEditorTextColorClass(selectedPost.color)} font-black break-words w-full`}>
                          {formatMentionsAndTags(selectedPost.caption)}
                        </p>
                      </div>
                    </div>
                  );
                }

                const mediaList = mediaPost?.mediaList || [];
                const currentMedia = mediaList.length > 0 
                  ? mediaList[currentMediaIdx] 
                  : { url: mediaPost?.videoUrl || mediaPost?.imageUrl || '', type: mediaPost?.videoUrl ? 'video' : 'image', name: '' };
                return (
                  <>
                    {currentMedia.type === 'video' ? (
                      <MediaWithSoundtrack className="relative w-full h-full">
                      <video
                        data-playback-scope={PLAYBACK_SCOPE.MANAGED}
                        ref={modalVideoRef}
                        src={currentMedia.url || undefined}
                        loop={loopCarouselItem}
                        playsInline
                        muted={postSoundtrackUrl ? true : db.globalMuted}
                        controls
                        preload="auto"
                        onEnded={loopCarouselItem ? undefined : goToNextCarouselItem}
                        onVolumeChange={(e) => {
                          if (!postSoundtrackUrl) {
                            db.setGlobalMuted(e.currentTarget.muted);
                          }
                        }}
                        style={postFilterStyle}
                        className="w-full h-full object-contain"
                        {...nativeVideoControlGuardProps()}
                      />
                      </MediaWithSoundtrack>
                    ) : currentMedia.type === 'audio' ? (
                      <div className="flex flex-col items-center justify-center p-8 bg-zinc-950 border border-zinc-800 shadow-2xl rounded-2xl w-full max-w-[280px] aspect-square relative z-10" onClick={(e) => e.stopPropagation()}>
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 relative overflow-hidden animate-pulse">
                          <Music className="w-8 h-8 animate-bounce" />
                        </div>
                        <p className="font-bold text-xs text-center mb-1 max-w-[240px] truncate text-white">{currentMedia.name || 'Audio Track'}</p>
                        <p className="text-[10px] text-muted-foreground mb-4 font-mono">Audio Track</p>
                        <audio
                          ref={modalCarouselAudioRef}
                          src={currentMedia.url || undefined}
                          controls
                          loop={loopCarouselItem}
                          onEnded={loopCarouselItem ? undefined : goToNextCarouselItem}
                          className="w-full scale-90 accent-primary focus:outline-none"
                        />
                      </div>
                    ) : (
                      <MediaWithSoundtrack className="relative w-full h-full">
                        <img
                          key={`modal-mob-img-${currentMediaIdx}`}
                          src={currentMedia.url || undefined}
                          style={postFilterStyle}
                          className="w-full h-full object-contain pointer-events-none"
                          alt="Post"
                          onError={handleMediaError}
                        />
                      </MediaWithSoundtrack>
                    )}

                    {/* Mobile swipe layout arrows - hidden on mobile/tablet, shown on desktop (lg) */}
                    {mediaList.length > 1 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            goToPrevCarouselItem();
                          }}
                          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/75 hidden lg:flex items-center justify-center text-white transition-all z-20 shadow-md active:scale-95"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            goToNextCarouselItem();
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
                    src={postAuthor?.avatarUrl || undefined}
                    alt="user"
                    className="w-full h-full object-cover"
                    onError={handleAvatarError}
                  />
                </div>
                <div>
                  <span className="font-bold text-[15px] mr-2">
                    <ProfileNamePrimary user={postAuthor} fallback="Unknown" />
                  </span>
                <div className="mt-1">
                  <p className={`post-caption-text text-[14px] leading-relaxed break-words ${getFontClass(selectedPost.font)} ${getAlignClass(selectedPost.alignment)} ${resolveCaptionColorClass(selectedPost.color)}`}>
                    {formatMentionsAndTags(truncateText(selectedPost.caption, 180).text)}
                    {truncateText(selectedPost.caption, 180).showMore && (
                      <button onClick={() => setShowFullCaption(true)} className="text-foreground/70 ml-2 hover:underline font-bold">view more</button>
                    )}
                  </p>
                </div>
                  {showFullCaption && <CaptionModal post={selectedPost} onClose={() => setShowFullCaption(false)} />}
                  {isRepostEmbed ? (
                    <div className="mt-2 space-y-0.5">
                      <time
                        dateTime={contentTimestampIso(selectedPost.createdAt)}
                        className="block text-[11px] font-medium text-muted-foreground"
                      >
                        {formatRepostedDateTime(selectedPost.createdAt)}
                      </time>
                      {mediaPost?.createdAt ? (
                        <time
                          dateTime={contentTimestampIso(mediaPost.createdAt)}
                          className="block text-[11px] font-medium text-muted-foreground/80"
                        >
                          {formatPostedDateTime(mediaPost.createdAt)}
                        </time>
                      ) : null}
                    </div>
                  ) : (
                    <time
                      dateTime={contentTimestampIso(selectedPost.createdAt)}
                      className="block text-[11px] font-medium text-muted-foreground mt-2"
                    >
                      {formatContentDateTime(selectedPost.createdAt)}
                    </time>
                  )}
                </div>
              </div>

              {(db?.postComments?.[selectedPost.id] || []).map(
                (comment: CommentLike, i: number) => (
                  <PostModalCommentItem
                    key={comment.id || "lc-" + i}
                    comment={comment}
                    {...commentItemProps}
                  />
                ),
              )}
            </div>
          </div>

          <div className="border-t border-border shrink-0 bg-background">
            <div className="p-3 space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      db.togglePostLike(selectedPost.id);
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
                  <div className="relative">
                    <button
                      onClick={() => setShowShareModal(true)}
                      className="group hover:text-muted-foreground transition-colors hover:scale-110"
                    >
                      <ShareIcon size="md" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    db.togglePostSave(selectedPost.id);
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
                      <InlineAttachmentVideo
                        src={media.url || ''}
                        className="w-full h-full"
                        videoClassName="w-full h-full object-cover rounded-md"
                      />
                    ) : media.isAudio ? (
                      <div className="w-full h-full rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center p-1">
                        <audio src={media.url || undefined} controls className="w-full scale-90" />
                      </div>
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
              className="border-t border-border p-2 md:p-3 flex flex-col bg-secondary/20 shrink-0"
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
                    onClick={() => {
                      setReplyingTo(null);
                      setCommentText("");
                    }}
                    className="ml-2 hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center w-full min-w-0 gap-1">
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
                        className="fixed inset-0 bg-background z-[150] md:hidden block pointer-events-auto"
                        onClick={() => setShowEmojiPicker(false)}
                      />
                      <div className="fixed bottom-0 left-0 right-0 h-[60vh] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-t-[32px] border-t border-border z-[160] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 md:hidden block pointer-events-auto emoji-glass-sheet">
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
                            theme={Theme.AUTO}
                          />
                        </div>
                      </div>

                      {/* Desktop Popover */}
                      <div className="absolute bottom-full left-0 mb-2 z-[60] hidden md:block animate-in fade-in duration-200 pointer-events-auto emoji-glass-popover">
                        <EmojiPicker
                          onEmojiClick={(emoji) => {
                            setCommentText((prev) => prev + emoji.emoji);
                            commentInputRef.current?.focus();
                          }}
                          previewConfig={{ showPreview: false }}
                          theme={Theme.AUTO}
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
                {isRecording ? (
                  <div className="flex-1 min-w-0 flex items-center gap-3 px-1">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-semibold text-red-500 text-sm">Recording...</span>
                    <div className="flex-1 overflow-hidden">
                      <Waveform isPlaying={true} color="bg-red-500" />
                    </div>
                  </div>
                ) : recordedVoice ? (
                  <div className="flex items-center gap-2 bg-secondary rounded-full pl-3 pr-2 py-1 flex-1 min-w-0 overflow-hidden">
                    <div className="flex-1 min-w-0">
                      <VoiceMessagePlayer
                        url={recordedVoice}
                        color="secondary"
                        onReRecord={clearRecording}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={clearRecording}
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                      aria-label="Clear recorded voice"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <input
                    ref={commentInputRef}
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={isListening ? "Listening..." : "Add a comment..."}
                    className="flex-1 min-w-0 bg-transparent border-none outline-none text-[14px] md:text-[15px] font-medium px-1 placeholder:text-muted-foreground/70"
                  />
                )}
                {!recordedVoice && (
                  <button
                    type="button"
                    onPointerDown={handleMicPointerDown}
                    onPointerUp={handleMicPointerUp}
                    onPointerCancel={handleMicPointerCancel}
                    className={`p-1.5 md:p-2 rounded-full mr-1 md:mr-2 transition-colors ${
                      isRecording
                        ? "bg-red-500 text-white animate-pulse"
                        : isListening
                          ? "bg-primary text-primary-foreground animate-pulse"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Mic className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                )}
                <button
                  type="submit"
                  className={`ml-1 md:ml-2 px-3 py-1.5 rounded-full font-bold text-[13px] md:text-[14px] transition-colors shrink-0 border ${
                    isCommentPostDisabled ? "cursor-not-allowed" : "hover:opacity-90"
                  }`}
                  style={isCommentPostDisabled
                    ? { backgroundColor: "rgba(115, 115, 115, 0.45)", color: "rgba(255, 255, 255, 0.7)", borderColor: "rgba(255, 255, 255, 0.25)" }
                    : { backgroundColor: "#111827", color: "#ffffff", borderColor: "#111827" }}
                  disabled={isCommentPostDisabled}
                >
                  Post
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <ShareModal
        isOpen={showShareModal && Boolean(postSharePayload)}
        onClose={() => setShowShareModal(false)}
        shareUrl={postSharePayload?.shareUrl ?? ''}
        itemTitle={postSharePayload?.itemTitle ?? 'Share Post'}
        shareText={postSharePayload?.shareText ?? 'Shared a post'}
        kind={postSharePayload?.kind ?? 'post'}
        notificationText={postSharePayload?.notificationText}
      />

      {mediaPost && mediaLivePost && (
        <PostContentFullscreenPortal
          isOpen={isPostContentFullscreen}
          post={mediaPost}
          livePost={mediaLivePost}
          currentMediaIdx={currentMediaIdx}
          isTextPost={isTextPost}
          loopCarouselItem={loopCarouselItem}
          videoError={videoError}
          carouselAudioRef={modalCarouselAudioRef}
          fsVideoRef={modalFsVideoRef}
          globalMuted={db.globalMuted}
          onSetGlobalMuted={db.setGlobalMuted}
          postAudioIntentKey="modal-fs"
          postAudioPriority={PLAYBACK_PRIORITY.MODAL_FS}
          playbackPostId={mediaPlaybackId}
          onClose={handleClosePostContentFullscreen}
          shouldIgnoreBackdropClose={shouldIgnoreModalFsBackdropClose}
          onRequestNativeVideoFullscreen={() =>
            openNativeVideoFullscreen(modalFsVideoRef.current)
          }
          onTouchStart={handleFsTouchStart}
          onTouchMove={handleFsTouchMove}
          onTouchEnd={handleFsTouchEnd}
          onPrevCarouselItem={goToPrevCarouselItem}
          onNextCarouselItem={goToNextCarouselItem}
        />
      )}

      {fullscreenMedia && createPortal(
        <div 
          id="media-full-screen-modal"
          className="fixed inset-0 z-[320] flex items-center justify-center bg-background pointer-events-auto animate-in fade-in duration-200"
          onTouchStart={handleFsTouchStart}
          onTouchMove={handleFsTouchMove}
          onTouchEnd={handleFsTouchEnd}
        >
          <button
            onClick={handleCloseModalFullscreen}
            className="absolute top-4 right-4 z-[260] text-foreground p-2 hover:bg-secondary rounded-full transition-colors cursor-pointer border border-border shadow-sm"
          >
            <X className="w-8 h-8" />
          </button>
          
          <FullscreenMediaStage
            className="select-none"
            onBackdropClick={handleCloseModalFullscreen}
            shouldIgnoreBackdropClose={shouldIgnoreModalFsBackdropClose}
          >
            {(() => {
              const item = fullscreenMedia.items[fullscreenMedia.mediaIndex];
              if (!item) return null;

              if (item.isText) {
                return (
                  <div className={`w-full max-w-2xl h-full max-h-[85vh] flex flex-col items-center justify-center p-12 ${item.bg && !item.bg.includes('bg-secondary') ? item.bg : 'bg-background'} rounded-3xl relative shadow-2xl overflow-hidden`} onClick={(e) => e.stopPropagation()}>
                    <div className="w-full flex-1 overflow-y-auto no-scrollbar flex flex-col items-center justify-center py-8 text-center px-4">
                       <p className={`story-user-text editor-adaptive-text ${getFontClass(item.font)} ${getAlignClass(item.alignment)} ${item.size || ((item.caption?.length ?? 0) > 50 ? 'text-3xl' : 'text-6xl')} ${resolveEditorTextColorClass(item.color)} font-black break-words w-full`}>
                         {formatMentionsAndTags(item.caption ?? '')}
                       </p>
                    </div>
                  </div>
                );
              }

              const fsLoopItem = fullscreenMedia.items.length <= 1;
              const fsMediaType = item.isVideo
                ? 'video'
                : item.isAudio
                  ? 'audio'
                  : 'image';

              if (!attachmentMediaPost) return null;

              return (
                <FullscreenPostMediaContent
                  post={attachmentMediaPost}
                  livePost={attachmentMediaPost}
                  currentMediaIdx={fullscreenMedia.mediaIndex}
                  mediaOverride={{
                    url: item.url,
                    type: fsMediaType,
                    posterUrl: item.isVideo ? undefined : safeMediaUrl(item.url),
                    name: item.name,
                  }}
                  isTextPost={false}
                  loopCarouselItem={fsLoopItem}
                  videoError={false}
                  filterStyle={undefined}
                  carouselAudioRef={modalCarouselAudioRef}
                  videoRef={modalFsVideoRef}
                  globalMuted={db.globalMuted}
                  onSetGlobalMuted={db.setGlobalMuted}
                  soundtrackUrl={fsSoundtrackForVideoHook}
                  postId={selectedPost.id}
                  postAudioIntentKey={modalAudioIntentKeyEarly}
                  postAudioPriority={PLAYBACK_PRIORITY.MODAL_FS}
                  onNextCarouselItem={goToNextFullscreenItem}
                  onRequestNativeVideoFullscreen={() =>
                    openNativeVideoFullscreen(modalFsVideoRef.current)
                  }
                />
              );
            })()}
          </FullscreenMediaStage>

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
    </div>,
    document.body
  );
}
