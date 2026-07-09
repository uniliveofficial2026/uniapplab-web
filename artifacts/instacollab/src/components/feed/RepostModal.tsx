import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit3 } from 'lucide-react';
import { Post as PostType } from '../../types';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { isPostTextOnly, resolveRepostPreview, buildRepostEmbedSnapshot, resolveRepostTargetId } from '../../lib/repostMedia';
import { RepostPostMediaPanel } from './RepostPostMediaPanel';
import { PLAYBACK_PRIORITY } from '../../lib/playbackAudio';
import {
  IMAGE_CAROUSEL_MS,
  nextCarouselIndex,
  postCarouselItemCount,
  shouldLoopCarouselItem,
} from '../../lib/mediaPlayback';
import { resolvePostDisplayMedia, touchClientX } from '../../lib/safe';
import { resolveEditorSoundtrackUrl, isPlayableAudioUrl } from '../../lib/audioMedia';
import { useExclusivePlayback } from '../../lib/useExclusivePlayback';
import {
  pinPostAudioEntry,
  unpinPostAudioEntry,
  usePostPlaybackAudio,
} from '../../lib/postAudioRegistry';
import { postPlaybackId } from '../../lib/postPlayback';
import { useCarouselNativeVideoAdvance } from '../../lib/useCarouselNativeVideoAdvance';

interface RepostModalProps {
  post: PostType;
  onClose: () => void;
}

const COLORS = ['#ffffff', '#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const REPOST_PREVIEW_INTENT = 'repost-modal';

export function RepostModal({ post, onClose }: RepostModalProps) {
  const db = useDB();
  const toast = useToast();
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  const { originalPost, mediaPost, mediaLivePost } = useMemo(
    () => resolveRepostPreview(post, db.posts, db.users),
    [post, db.posts, db.users],
  );

  const [caption, setCaption] = useState('');
  const [currentMediaIdx, setCurrentMediaIdx] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  // Text Overlay Editing
  const [textOverlay, setTextOverlay] = useState('');
  const [textOverlayColor, setTextOverlayColor] = useState('#ffffff');
  const [textOverlaySize, setTextOverlaySize] = useState(20);
  const [textOverlayPos, setTextOverlayPos] = useState(50);
  const [showOverlayEditor, setShowOverlayEditor] = useState(false);

  useEffect(() => {
    setCurrentMediaIdx(0);
    setVideoError(false);
  }, [originalPost.id]);

  const previewMediaPost = useMemo(
    () => ({
      ...mediaPost,
      textOverlay: textOverlay || mediaPost.textOverlay,
      textOverlayColor: textOverlayColor || mediaPost.textOverlayColor,
      textOverlaySize: textOverlaySize || mediaPost.textOverlaySize,
      textOverlayPos: textOverlayPos ?? mediaPost.textOverlayPos,
    }),
    [mediaPost, textOverlay, textOverlayColor, textOverlaySize, textOverlayPos],
  );
  const previewMediaLivePost = useMemo(
    () => ({
      ...mediaLivePost,
      textOverlay: previewMediaPost.textOverlay,
      textOverlayColor: previewMediaPost.textOverlayColor,
      textOverlaySize: previewMediaPost.textOverlaySize,
      textOverlayPos: previewMediaPost.textOverlayPos,
    }),
    [mediaLivePost, previewMediaPost],
  );
  const isTextPost = isPostTextOnly(previewMediaPost);
  const carouselItemCount = postCarouselItemCount(previewMediaPost);
  const loopCarouselItem = shouldLoopCarouselItem(carouselItemCount);
  const displayMedia = resolvePostDisplayMedia(previewMediaPost, currentMediaIdx);
  const previewShowVideo = displayMedia.type === 'video' && !videoError && !displayMedia.showAsImage;
  const previewSoundtrackUrl = resolveEditorSoundtrackUrl(
    previewMediaPost.audioUrl,
    displayMedia.type,
  );
  const previewTextAudioUrl =
    isTextPost && isPlayableAudioUrl(previewMediaPost.audioUrl)
      ? previewMediaPost.audioUrl
      : undefined;
  const previewCarouselAudio = displayMedia.type === 'audio' && !!displayMedia.url;

  const goToPrevCarouselItem = useCallback(() => {
    if (carouselItemCount <= 1) return;
    setCurrentMediaIdx((prev) => (prev === 0 ? carouselItemCount - 1 : prev - 1));
  }, [carouselItemCount]);

  const goToNextCarouselItem = useCallback(() => {
    if (carouselItemCount <= 1) return;
    setCurrentMediaIdx((prev) => nextCarouselIndex(prev, carouselItemCount));
  }, [carouselItemCount]);

  const { wrapCarouselAdvance } = useCarouselNativeVideoAdvance(
    previewVideoRef,
    currentMediaIdx,
    previewShowVideo ? displayMedia.url : undefined,
    previewShowVideo,
  );

  const previewPlaybackActive =
    !db.isCreatorEditingActive && !db.globalMuted;

  useEffect(() => {
    pinPostAudioEntry(originalPost.id);
    return () => unpinPostAudioEntry(originalPost.id);
  }, [originalPost.id]);

  usePostPlaybackAudio(originalPost.id, REPOST_PREVIEW_INTENT, {
    soundtrackUrl: previewSoundtrackUrl,
    textAudioUrl: previewTextAudioUrl,
    priority: PLAYBACK_PRIORITY.MODAL,
    active: previewPlaybackActive,
    muted: db.globalMuted,
    loop: loopCarouselItem,
    onEnded: loopCarouselItem ? undefined : goToNextCarouselItem,
  });

  const previewVideoWantsPlay =
    !db.isCreatorEditingActive &&
    previewShowVideo &&
    !previewSoundtrackUrl;

  useExclusivePlayback(
    postPlaybackId(originalPost.id, 'video'),
    PLAYBACK_PRIORITY.MODAL,
    previewVideoWantsPlay,
    previewVideoRef,
    REPOST_PREVIEW_INTENT,
  );

  useExclusivePlayback(
    postPlaybackId(originalPost.id, 'carousel-audio'),
    PLAYBACK_PRIORITY.MODAL,
    previewPlaybackActive && previewCarouselAudio,
    previewAudioRef,
    REPOST_PREVIEW_INTENT,
  );

  useEffect(() => {
    if (loopCarouselItem) return;
    const item = previewMediaPost.mediaList?.[currentMediaIdx];
    if (!item || item.type !== 'image') return;
    const timer = window.setTimeout(
      () => wrapCarouselAdvance(goToNextCarouselItem),
      IMAGE_CAROUSEL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [
    loopCarouselItem,
    currentMediaIdx,
    previewMediaPost.mediaList,
    goToNextCarouselItem,
    wrapCarouselAdvance,
  ]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(touchClientX(e.targetTouches));
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(touchClientX(e.targetTouches));
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || carouselItemCount <= 1) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) {
      wrapCarouselAdvance(goToNextCarouselItem);
    } else if (distance < -minSwipeDistance) {
      wrapCarouselAdvance(goToPrevCarouselItem);
    }
  };

  const handleRepost = () => {
    const newId = `new_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const embeddedOriginal = buildRepostEmbedSnapshot(post, db.posts, db.users, {
      textOverlay: textOverlay || undefined,
      textOverlayColor: textOverlayColor || undefined,
      textOverlaySize: textOverlaySize || undefined,
      textOverlayPos: textOverlayPos,
    });
    const targetId = resolveRepostTargetId(post, db.posts, db.users);
    const newPost: PostType = {
      id: newId,
      user: db.currentUser,
      caption: caption,
      imageUrl: '',
      likes: 0,
      comments: 0,
      reposts: 0,
      createdAt: new Date().toISOString(),
      isLiked: false,
      isSaved: false,
      repost: embeddedOriginal,
    };

    db.addPost(newPost);

    db.updatePost(targetId, (p) => ({
      ...p,
      reposts: (p.reposts || 0) + 1,
    }));

    if (toast?.showToast) {
      toast.showToast('Reposted successfully');
    }
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" data-app-overlay-root>
      <div className="w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="font-bold text-lg">Repost</div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-secondary rounded-full border border-border shadow-sm">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add your thoughts..."
            className="w-full bg-secondary border border-border rounded-xl p-3 min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />

          <div className="flex justify-between items-center bg-secondary/50 p-2 rounded-xl border border-border">
            <span className="text-sm font-semibold ml-2">Edit Meme / Overlay</span>
            <button
              type="button"
              onClick={() => setShowOverlayEditor(!showOverlayEditor)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
            >
              <Edit3 className="w-4 h-4" />
              {showOverlayEditor ? 'Hide Editor' : 'Edit Overlay'}
            </button>
          </div>

          {showOverlayEditor && (
            <div className="space-y-4 bg-secondary border border-border rounded-xl p-4 animate-in slide-in-from-top-2">
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Overlay Text</label>
                <textarea
                  value={textOverlay}
                  onChange={(e) => setTextOverlay(e.target.value)}
                  placeholder="Drop a funny text overlay..."
                  className="w-full bg-background border border-border rounded-lg p-2 text-sm max-h-[80px]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground mb-2 block">Text Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTextOverlayColor(c)}
                      className={`w-8 h-8 rounded-full border-2 ${textOverlayColor === c ? 'border-primary scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Size: {textOverlaySize}px</label>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    value={textOverlaySize}
                    onChange={(e) => setTextOverlaySize(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Y-Position: {textOverlayPos}%</label>
                  <input
                    type="range"
                    min="5"
                    max="95"
                    value={textOverlayPos}
                    onChange={(e) => setTextOverlayPos(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>
          )}

          <div
            className="relative w-full aspect-square max-h-[min(60vh,420px)] mx-auto"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <RepostPostMediaPanel
              repost={originalPost}
              mediaPost={previewMediaPost}
              mediaLivePost={previewMediaLivePost}
              isTextPost={isTextPost}
              shellClassName="absolute inset-0 opacity-95"
              mediaStageProps={{
                currentMediaIdx,
                videoError,
                setVideoError,
                loopCarouselItem,
                showHeartAnimation: false,
                onShowFullCaption: () => {},
                videoRef: previewVideoRef,
                carouselAudioRef: previewAudioRef,
                globalMuted: db.globalMuted,
                onSetGlobalMuted: db.setGlobalMuted,
                onOpenFullscreen: () => {},
                onPrevCarouselItem: () => wrapCarouselAdvance(goToPrevCarouselItem),
                onNextCarouselItem: () => wrapCarouselAdvance(goToNextCarouselItem),
                postAudioIntentKey: REPOST_PREVIEW_INTENT,
                postAudioPriority: PLAYBACK_PRIORITY.MODAL,
                playbackPostId: originalPost.id,
              }}
            />
          </div>
        </div>

        <div className="p-4 border-t border-border bg-card shrink-0">
          <button
            type="button"
            onClick={handleRepost}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            Share Repost
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
