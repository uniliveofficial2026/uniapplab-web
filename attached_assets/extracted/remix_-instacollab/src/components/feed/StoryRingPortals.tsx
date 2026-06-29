import React from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, Send, Volume2, VolumeX, Play, Pause, Maximize2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  StoryCreatorFlow,
  StoryEmptyIntro,
  type StoryCreatorStep,
} from '../stories/StoryCreatorFlow';
import { openProfilePreview, handleAvatarError, handleMediaError, formatMentionsAndTags, resolveEditorTextColorClass, resolveOverlayTextStyle } from '../../lib/utils';
import { tryEnterVideoFullscreen } from '../../lib/safe';
import { db as LocalDb } from '../../lib/db';
import { PLAYBACK_PRIORITY } from '../../lib/playbackAudio';
import { storyDraftFilterStyle, type StoryDraftMedia } from '../stories/storyDraft';
import { isPlayableAudioUrl } from '../../lib/audioMedia';
import { BackgroundAudioPlayer } from '../common/BackgroundAudioPlayer';
import type { User } from '../../types';

/** Full-viewport shell — story viewer / empty intro (above main nav) */
const STORY_OVERLAY_SCRIM =
  'fixed inset-0 z-[100] flex items-center justify-center overflow-hidden overscroll-contain bg-background p-0 sm:p-4';

const STORY_OVERLAY_PANEL =
  'relative flex h-[100dvh] max-h-[100dvh] w-full max-w-md min-w-0 flex-col overflow-hidden sm:h-[90vh] sm:max-h-[90vh] sm:rounded-3xl bg-background border border-border shadow-2xl';

/** Standalone story creator — full-bleed scrim (no feed peeking); bottom nav hidden via CSS */
const STORY_CREATE_OVERLAY_SCRIM =
  'fixed z-50 inset-x-0 bottom-0 top-[calc(60px+env(safe-area-inset-top)+1px)] flex items-center justify-center overflow-hidden overscroll-contain bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pt-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))] md:inset-y-0 md:left-[72px] md:right-0 lg:left-[244px] md:p-4';

const STORY_CREATE_PANEL_BASE =
  'relative flex w-full min-w-0 max-h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-background border border-border shadow-2xl md:h-[90vh]';

const STORY_CREATE_PANEL_SELECT = `${STORY_CREATE_PANEL_BASE} max-w-md md:max-h-[90vh] h-full`;

/** Same shell as `#create-modal` story edit (max-w-4xl, max-h-[92vh], scrollable) */
const STORY_CREATE_PANEL_EDIT =
  'bg-background w-full max-w-4xl max-h-[92vh] flex flex-col min-h-0 overflow-y-auto rounded-3xl border border-border shadow-2xl transition-all duration-300';

export type StoryRingPortalsProps = {
  storyUser: User;
  db: typeof LocalDb;
  showStoryEmpty: boolean;
  setShowStoryEmpty: React.Dispatch<React.SetStateAction<boolean>>;
  showCreateStory: boolean;
  setShowCreateStory: React.Dispatch<React.SetStateAction<boolean>>;
  storyCreateStep: StoryCreatorStep;
  setStoryCreateStep: React.Dispatch<React.SetStateAction<StoryCreatorStep>>;
  storyCreatorBackRef: React.MutableRefObject<() => void>;
  storyCreatorShareRef: React.MutableRefObject<() => void>;
  showStory: boolean;
  currentSegment: StoryDraftMedia | undefined;
  currentSegmentIndex: number;
  segments: StoryDraftMedia[];
  progress: number;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
  setCurrentSegmentIndex: React.Dispatch<React.SetStateAction<number>>;
  isPaused: boolean;
  setIsPaused: React.Dispatch<React.SetStateAction<boolean>>;
  storyVideoRef: React.RefObject<HTMLVideoElement | null>;
  playbackSpeed: number;
  setPlaybackSpeed: React.Dispatch<React.SetStateAction<number>>;
  loopStoryVideo: boolean;
  likedSegments: Record<number, boolean>;
  handleTap: (direction: 'left' | 'right') => void;
  toggleLike: () => void;
  closeStoryViewer: () => void;
  messageText: string;
  setMessageText: React.Dispatch<React.SetStateAction<string>>;
  isSent: boolean;
  sendMessage: (e: React.FormEvent) => void;
  setShowShareModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleStoryShared: (newIndex: number) => void;
  storyPlaybackId: string;
  prevUserId?: string | null;
  nextUserId?: string | null;
  onRequestOpenUser?: (userId: string) => void;
};

export function StoryRingPortals(props: StoryRingPortalsProps) {
  const {
    storyUser,
    db,
    showStoryEmpty,
    setShowStoryEmpty,
    showCreateStory,
    setShowCreateStory,
    storyCreateStep,
    setStoryCreateStep,
    storyCreatorBackRef,
    storyCreatorShareRef,
    showStory,
    currentSegment,
    currentSegmentIndex,
    segments,
    progress,
    setProgress,
    setCurrentSegmentIndex,
    isPaused,
    setIsPaused,
    storyVideoRef,
    playbackSpeed,
    setPlaybackSpeed,
    loopStoryVideo,
    likedSegments,
    handleTap,
    toggleLike,
    closeStoryViewer,
    messageText,
    setMessageText,
    isSent,
    sendMessage,
    setShowShareModal,
    handleStoryShared,
    storyPlaybackId,
    prevUserId,
    nextUserId,
    onRequestOpenUser,
  } = props;
  const swipeStartXRef = React.useRef<number | null>(null);
  const swipeStartYRef = React.useRef<number | null>(null);
  const SWIPE_THRESHOLD_PX = 56;

  const onViewerTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    swipeStartXRef.current = touch.clientX;
    swipeStartYRef.current = touch.clientY;
  };

  const onViewerTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const startX = swipeStartXRef.current;
    const startY = swipeStartYRef.current;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    if (startX == null || startY == null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX < 0 && nextUserId && onRequestOpenUser) {
      closeStoryViewer();
      onRequestOpenUser(nextUserId);
      return;
    }
    if (deltaX > 0 && prevUserId && onRequestOpenUser) {
      closeStoryViewer();
      onRequestOpenUser(prevUserId);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
          <>
            <AnimatePresence>
              {showStoryEmpty && (
                <div id="story-empty-modal" className={STORY_OVERLAY_SCRIM}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={STORY_OVERLAY_PANEL}
                  >
                    <StoryEmptyIntro
                      username={storyUser.username}
                      avatarUrl={storyUser.avatarUrl}
                      onCreate={() => {
                        setShowStoryEmpty(false);
                        setShowCreateStory(true);
                      }}
                      onClose={() => setShowStoryEmpty(false)}
                    />
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showCreateStory && (
                <div id="story-create-modal-root" className={STORY_CREATE_OVERLAY_SCRIM}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={
                      storyCreateStep !== 'select'
                        ? STORY_CREATE_PANEL_EDIT
                        : STORY_CREATE_PANEL_SELECT
                    }
                  >
                    {storyCreateStep !== 'select' && (
                      <div className="h-12 shrink-0 border-b border-border flex items-center justify-between px-4 sticky top-0 bg-background z-10">
                        <button
                          type="button"
                          onClick={() => storyCreatorBackRef.current()}
                          className="p-1 -ml-1 hover:text-muted-foreground transition-colors"
                          aria-label="Back"
                        >
                          <ArrowLeft className="w-6 h-6" />
                        </button>
                        <span className="font-bold text-sm">Story</span>
                        <button
                          type="button"
                          onClick={() => storyCreatorShareRef.current()}
                          className="text-primary font-bold text-sm hover:text-primary/80 transition-colors"
                        >
                          Share
                        </button>
                      </div>
                    )}
                    <StoryCreatorFlow
                      userId={storyUser.id}
                      username={storyUser.username}
                      avatarUrl={storyUser.avatarUrl}
                      layout="embedded"
                      showCloseButton={storyCreateStep === 'select'}
                      onClose={() => {
                        setStoryCreateStep('select');
                        setShowCreateStory(false);
                      }}
                      onStepChange={setStoryCreateStep}
                      registerBackHandler={(fn) => {
                        storyCreatorBackRef.current = fn;
                      }}
                      registerShareHandler={(fn) => {
                        storyCreatorShareRef.current = fn;
                      }}
                      onShared={handleStoryShared}
                    />
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showStory && (
                <div
                  id="story-modal"
                  className={STORY_OVERLAY_SCRIM}
                  onPointerDown={(e) => {
                    if (e.target === e.currentTarget) {
                      closeStoryViewer();
                    }
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={STORY_OVERLAY_PANEL}
                    onTouchStart={onViewerTouchStart}
                    onTouchEnd={onViewerTouchEnd}
                  >
                {/* Story Image */}
                <div 
                  className="absolute inset-0 z-0" 
                  onPointerDown={() => setIsPaused(true)}
                  onPointerUp={() => setIsPaused(false)}
                  onPointerLeave={() => setIsPaused(false)}
                >
                  <img src={storyUser.avatarUrl || undefined} alt="Story" className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30" onError={handleAvatarError} />
                  {!currentSegment ? (
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-muted-foreground">
                      No story content
                    </div>
                  ) : currentSegment.isText ? (
                    <div
                      className={`absolute inset-0 flex items-center justify-center p-8 ${currentSegment.textBg ?? 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}
                    >
                      <p
                        className={`story-user-text editor-adaptive-text w-full max-w-sm break-words font-black leading-tight drop-shadow-md ${currentSegment.font ?? 'font-sans'} ${currentSegment.textAlign ?? 'text-center'} ${resolveEditorTextColorClass(currentSegment.textColor)}`}
                        style={{ fontSize: `${currentSegment.textSizePx ?? 32}px` }}
                      >
                        {currentSegment.textContent || currentSegment.caption || ''}
                      </p>
                    </div>
                  ) : currentSegment.isVideo ? (
                    <video 
                      ref={storyVideoRef}
                      src={currentSegment.url || undefined} 
                      className="absolute inset-0 w-full h-full object-contain" 
                      style={storyDraftFilterStyle(currentSegment)}
                      autoPlay 
                      playsInline 
                      muted={
                        db.globalMuted ||
                        !!(currentSegment.backgroundAudio?.url &&
                          isPlayableAudioUrl(currentSegment.backgroundAudio.url))
                      }
                      onVolumeChange={(e) => {
                        db.setGlobalMuted(e.currentTarget.muted);
                      }}
                      onPlay={() => setIsPaused(false)}
                      onPause={() => setIsPaused(true)}
                      controls
                      preload="auto"
                      onTimeUpdate={(e) => {
                        const video = e.currentTarget;
                        if (!video.duration) return;
                        const trimStart = (currentSegment.trimStart ?? 0) / 100;
                        const trimEnd = (currentSegment.trimEnd ?? 100) / 100;
                        const startTime = video.duration * trimStart;
                        const endTime = video.duration * trimEnd;
                        if (video.currentTime < startTime - 0.05) {
                          video.currentTime = startTime;
                        }
                        if (video.currentTime >= endTime - 0.05) {
                          if (loopStoryVideo) {
                            video.currentTime = startTime;
                          } else if (currentSegmentIndex < segments.length - 1) {
                            setCurrentSegmentIndex((c) => c + 1);
                            setProgress(0);
                          } else {
                            setProgress(100);
                          }
                          return;
                        }
                        const span = Math.max(endTime - startTime, 0.001);
                        setProgress(((video.currentTime - startTime) / span) * 100);
                      }}
                      loop={loopStoryVideo}
                      onEnded={() => {
                        if (loopStoryVideo) return;
                        if (currentSegmentIndex < segments.length - 1) {
                          setCurrentSegmentIndex((c) => c + 1);
                          setProgress(0);
                        } else {
                          setProgress(100);
                        }
                      }}
                      onLoadedMetadata={(e) => {
                        const video = e.currentTarget;
                        video.playbackRate = playbackSpeed;
                        if (video.duration) {
                          video.currentTime =
                            video.duration * ((currentSegment.trimStart ?? 0) / 100);
                        }
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
                    <img
                      src={currentSegment.url || undefined}
                      alt="Story content"
                      className="absolute inset-0 w-full h-full object-contain"
                      style={storyDraftFilterStyle(currentSegment)}
                      onError={handleMediaError}
                    />
                  )}

                  {currentSegment && (currentSegment.textOverlay ?? '').trim() && !currentSegment.isText && (
                    <div
                      style={{
                        ...resolveOverlayTextStyle(currentSegment.textOverlayColor),
                        fontSize: `${currentSegment.textOverlaySize ?? 24}px`,
                        top: `${currentSegment.textOverlayPos ?? 50}%`,
                        textShadow:
                          '0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)',
                      }}
                      className="dark editor-overlay-text absolute left-1/2 z-10 max-w-[90%] -translate-x-1/2 -translate-y-1/2 text-center font-black tracking-tight pointer-events-none select-none px-4 py-1.5 rounded bg-black/40 backdrop-blur-[2px] border border-white/10"
                    >
                      {currentSegment.textOverlay}
                    </div>
                  )}

                  {currentSegment?.backgroundAudio?.url &&
                    isPlayableAudioUrl(currentSegment.backgroundAudio.url) && (
                      <div className="absolute bottom-16 left-3 right-3 z-20 flex justify-center pointer-events-auto">
                        <BackgroundAudioPlayer
                          audioUrl={currentSegment.backgroundAudio.url}
                          playbackId={storyPlaybackId}
                          priority={PLAYBACK_PRIORITY.STORY}
                          showControls
                        />
                      </div>
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
                {currentSegment?.caption && !currentSegment.isText && (
                  <div className="absolute inset-x-0 bottom-24 p-6 z-10 flex justify-center pointer-events-none">
                    <div className="bg-background px-6 py-3 rounded-full border border-border shadow-lg post-caption-text">
                      <span className="text-foreground font-medium text-center block text-sm">
                        {formatMentionsAndTags(currentSegment.caption)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                <div className="relative z-10 w-full pt-2 px-2 flex gap-1 pb-3">
                  {segments.map((_: unknown, idx: number) => (
                    <div key={idx} className="h-1 bg-white/35 rounded-full flex-1 overflow-hidden">
                      <div 
                        className="h-full bg-white rounded-full transition-all" 
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
                       closeStoryViewer();
                       openProfilePreview(storyUser);
                     }}
                   >
                     <div className="w-10 h-10 rounded-full overflow-hidden border border-border">
                       <img src={storyUser.avatarUrl || undefined} alt="user" className="w-full h-full object-cover" onError={handleAvatarError} />
                     </div>
                     <span className="text-foreground font-bold text-sm drop-shadow-sm">{storyUser.username}</span>
                     <span className="text-muted-foreground text-xs font-semibold">
                       {2 + currentSegmentIndex}h
                     </span>
                   </div>
                   
                   <div className="flex items-center gap-1.5 pointer-events-auto">
                     {currentSegment?.isVideo && (
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
                             tryEnterVideoFullscreen(storyVideoRef.current);
                           }} 
                           className="p-2 hover:bg-secondary rounded-full transition-colors text-foreground"
                           title="Fullscreen"
                         >
                           <Maximize2 className="w-5 h-5" />
                         </button>
                       </>
                     )}
                     <button 
                       onClick={(e) => { e.stopPropagation(); closeStoryViewer(); }} 
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
                   <div className="flex-1 border border-border rounded-full px-4 py-3 bg-background relative flex items-center gap-2 shadow-sm">
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
          </>,
    document.body
  );
}
