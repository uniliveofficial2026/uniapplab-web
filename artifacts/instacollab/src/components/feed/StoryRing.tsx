import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Story } from '../../types';
import type { StoryDraftMedia } from '../stories/storyDraft';
import { Plus, X } from 'lucide-react';
import { ShareModal } from './ShareModal';
import { buildStorySharePayload } from '../../lib/shareLinks';
import { handleAvatarError, resolveAvatarSrc } from '../../lib/utils';
import {
  type StoryCreatorStep,
} from '../stories/StoryCreatorFlow';
import {
  STORY_OPEN_CREATE_EVENT,
  type StoryOpenCreateDetail,
} from '../../lib/storyCreateEvents';
import {
  AvatarStatusBadge,
  getAvatarStatusBadgeOutsidePosition,
} from '../common/AvatarStatusBadge';
import { getLiveRingClasses, LIVE_KIND_LABELS } from '../../lib/liveRing';
import { getStoryRingVisualState } from '../../lib/storySegments';
import { safeIndex, resolveUser } from '../../lib/safe';
import { useDB, useDbRevision } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { pauseAllPlayback, PLAYBACK_PRIORITY } from '../../lib/playbackAudio';
import { acquireMediaOverlayLock } from '../../lib/mediaOverlayLock';
import { useExclusivePlayback } from '../../lib/useExclusivePlayback';
import { isPlayableAudioUrl } from '../../lib/audioMedia';
import { StoryRingPortals } from './StoryRingPortals';
import { THOUGHT_NOTE_MAX_LENGTH, patchUserThoughtNote } from '../../lib/thoughtNote';
import { ThoughtViewOverlay } from '../common/ThoughtViewOverlay';
import { ThoughtBubbleShell, ThoughtComposerBubblePortal } from '../common/AvatarThoughtBubble';
import { ProfileStoryCardMedia } from './ProfileStoryCardMedia';
import {
  formatProfileHandle,
  getProfileDisplayName,
  shouldShowProfileHandle,
} from '../../lib/profileDisplay';

interface StoryRingProps {
  story: Story;
  isCurrentUser?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  hideRing?: boolean;
  prevUserId?: string | null;
  nextUserId?: string | null;
  onRequestOpenUser?: (userId: string) => void;
  storyScope?: 'feed' | 'profile';
  segmentsOverride?: StoryDraftMedia[];
  ringLabel?: string;
  profileDayKey?: string;
  /** Profile strip: Facebook-style vertical preview cards; header: large profile avatar only */
  presentation?: 'ring' | 'card' | 'header';
  ringSize?: 'feed' | 'compact' | 'lg' | 'profile';
  /** When set, replaces default ring tap handling (e.g. profile photo upload). */
  onRingClick?: () => void;
  /** Profile header: show ring when feed is empty but archive has segments */
  ringSegmentCount?: number;
  ringViewed?: boolean;
  /** Own profile archive strip — always show blue/green by segment count, not viewed gray */
  isOwnProfileArchive?: boolean;
}

export function StoryRing({
  story,
  isCurrentUser,
  isOpen = false,
  onClose,
  hideRing = false,
  prevUserId = null,
  nextUserId = null,
  onRequestOpenUser,
  storyScope = 'feed',
  segmentsOverride,
  ringLabel,
  profileDayKey,
  presentation = 'ring',
  ringSize = 'feed',
  onRingClick,
  ringSegmentCount,
  ringViewed,
  isOwnProfileArchive = false,
}: StoryRingProps) {
  const db = useDB();
  const dbRevision = useDbRevision();
  const { showToast } = useToast();
  const storyUser = React.useMemo(
    () => resolveUser(db.users, story?.user, db.currentUser),
    [story?.user, db.users, db.currentUser]
  );
  const [showStory, setShowStory] = useState(isOpen);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [storyCreateStep, setStoryCreateStep] = useState<StoryCreatorStep>('select');
  const storyCreatorBackRef = React.useRef<() => void>(() => {});
  const storyCreatorShareRef = React.useRef<() => void>(() => {});
  const [showStoryEmpty, setShowStoryEmpty] = useState(false);
  const [progress, setProgress] = useState(0);
  const controlledByParentRef = React.useRef(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const storySharePayload = React.useMemo(
    () => buildStorySharePayload(storyUser.username, currentSegmentIndex),
    [storyUser.username, currentSegmentIndex],
  );
  
  const [messageText, setMessageText] = useState('');
  const [isSent, setIsSent] = useState(false);
  const persistentSegments = React.useMemo(() => {
    if (segmentsOverride?.length) return segmentsOverride;
    return storyScope === 'profile'
      ? db.getProfileStorySegments(storyUser.id)
      : db.getFeedStorySegments(storyUser.id);
  }, [segmentsOverride, storyScope, storyUser.id, db, dbRevision]);
  const createdStory = persistentSegments.length > 0;
  const isMyStoryEmpty = isCurrentUser && !createdStory;

  const userFromDb = storyUser;
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [noteEditVal, setNoteEditVal] = useState('');
  const [showHeaderThoughtComposer, setShowHeaderThoughtComposer] = useState(false);
  const headerSlotRef = React.useRef<HTMLDivElement>(null);
  const ringShellRef = React.useRef<HTMLDivElement>(null);

  const openThoughtComposer = React.useCallback(() => {
    if (presentation === 'header') {
      setShowHeaderThoughtComposer(true);
    }
    setShowNoteModal(true);
  }, [presentation]);

  const closeThoughtComposer = React.useCallback(() => {
    setShowNoteModal(false);
    if (presentation === 'header') {
      setShowHeaderThoughtComposer(false);
    }
  }, [presentation]);

  useEffect(() => {
    if (showNoteModal) {
      setNoteEditVal(userFromDb.note || '');
    }
  }, [showNoteModal, userFromDb.note]);

  useEffect(() => {
    if (presentation !== 'header' || !showHeaderThoughtComposer) return;
    const onPointerDown = (event: PointerEvent) => {
      const slot = headerSlotRef.current;
      const modal = document.getElementById('story-ring-thought-modal');
      const composer = document.getElementById('story-thought-composer-portal');
      const target = event.target as Node;
      if (slot?.contains(target)) return;
      if (modal?.contains(target)) return;
      if (composer?.contains(target)) return;
      closeThoughtComposer();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [presentation, showHeaderThoughtComposer, closeThoughtComposer]);

  const viewScope = storyScope === 'profile' ? 'profile' : 'feed';

  const ring = getStoryRingVisualState(storyUser.id, {
    getUserStorySegments: (userId) =>
      storyScope === 'profile'
        ? db.getProfileStorySegments(userId)
        : db.getFeedStorySegments(userId),
    hasViewedStory: (userId) => {
      if (ringViewed !== undefined) return ringViewed;
      if (storyScope === 'profile' && profileDayKey) {
        return db.hasViewedProfileDay(userId, profileDayKey);
      }
      return db.hasViewedStory(userId, viewScope);
    },
    userStatus: storyUser.status,
    liveKind: storyUser.liveKind,
    segmentCountOverride: segmentsOverride?.length ?? ringSegmentCount,
  });

  const {
    isMultiStory,
    hasStoryContent,
    isViewed: isViewedForScope,
    isLive: isLiveUser,
    liveKind,
  } = ring;

  const isViewed =
    isCurrentUser && storyScope === 'feed'
      ? false
      : storyScope === 'profile' && profileDayKey
        ? db.hasViewedProfileDay(storyUser.id, profileDayKey)
        : isViewedForScope;

  const liveRingClasses = getLiveRingClasses(liveKind);

  /** Profile header / story cards always render the face; hideRing only suppresses strip chrome or ring animation. */
  const showAvatarChrome =
    !hideRing || presentation === 'header' || presentation === 'card';
  const suppressRingAnimation = hideRing && presentation === 'header';

  const showAnimatedLiveRing = !suppressRingAnimation && isLiveUser;
  const showAnimatedMultiStoryRing =
    !suppressRingAnimation &&
    !isMyStoryEmpty &&
    !isLiveUser &&
    hasStoryContent &&
    !isViewed &&
    isMultiStory;
  const showAnimatedStoryRing =
    !suppressRingAnimation &&
    !isMyStoryEmpty &&
    !isLiveUser &&
    hasStoryContent &&
    !isViewed &&
    !isMultiStory;
  const showViewedStoryRing =
    !suppressRingAnimation &&
    !isMyStoryEmpty &&
    !isLiveUser &&
    hasStoryContent &&
    isViewed;
  const showStoryStatusBadge =
    !isMyStoryEmpty && !isLiveUser && hasStoryContent && !isCurrentUser;

  const markStoryAsViewed = () => {
    if (!storyUser.id) return;
    if (storyScope === 'profile' && profileDayKey) {
      db.markProfileDayViewed(storyUser.id, profileDayKey);
      return;
    }
    if (!isCurrentUser) {
      db.markStoryViewed(storyUser.id, viewScope);
    }
  };

  const resetStoryPlayback = () => {
    setProgress(0);
    setCurrentSegmentIndex(0);
    setIsPaused(false);
  };

  useEffect(() => {
    if (isOpen) {
      controlledByParentRef.current = true;
      setShowStory(true);
      resetStoryPlayback();
      return;
    }
    if (controlledByParentRef.current) {
      controlledByParentRef.current = false;
      setShowStory(false);
      resetStoryPlayback();
    }
  }, [isOpen]);

  const closeStoryViewer = () => {
    markStoryAsViewed();
    setShowStory(false);
    resetStoryPlayback();
    if (isOpen && onClose) onClose();
  };

  const handoffToAdjacentStory = (targetId: string) => {
    markStoryAsViewed();
    setShowStory(false);
    resetStoryPlayback();
    onRequestOpenUser?.(targetId);
  };

  const openStoryViewer = () => {
    if (onRequestOpenUser) {
      if (presentation === 'card' && storyScope === 'profile' && story.id) {
        onRequestOpenUser(story.id);
      } else if (storyScope === 'feed' && storyUser.id) {
        onRequestOpenUser(storyUser.id);
      }
    }
    setShowStory(true);
    resetStoryPlayback();
  };
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const storyVideoRef = React.useRef<HTMLVideoElement>(null);

  const standaloneStoryCreatorOpen = showCreateStory || showStoryEmpty;

  // Pause feed/reels while this ring's story viewer or creator is open (not global create menu — that is per-Post via db.isCreatorEditingActive)
  useEffect(() => {
    const pauseBackground = showStory || standaloneStoryCreatorOpen;
    if (!pauseBackground) return;
    return acquireMediaOverlayLock();
  }, [showStory, standaloneStoryCreatorOpen]);

  useEffect(() => {
    if (!standaloneStoryCreatorOpen && !showStory) return;
    pauseAllPlayback();
  }, [standaloneStoryCreatorOpen, showStory]);
  
  const [likedSegments, setLikedSegments] = useState<Record<number, boolean>>({});
  
  const segments = persistentSegments;
  const safeSegmentIndex = safeIndex(currentSegmentIndex, segments.length, 0);
  const currentSegment = segments[safeSegmentIndex];
  const loopStoryVideo = segments.length <= 1;

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    setIsSent(true);
    setMessageText('');
    setIsPaused(false);
    setTimeout(() => setIsSent(false), 2000);
  };

  const segmentCount = segments.length;
  const activeSegment = segments[safeSegmentIndex];

  // Auto-progress still/text segments (~4s each). Video progress is driven in StoryRingPortals.
  useEffect(() => {
    if (!showStory || isPaused || segmentCount === 0) return;
    if (activeSegment?.isVideo === true) return;

    const interval = window.setInterval(() => {
      setProgress((p) => (p >= 100 ? 100 : p + 2.5));
    }, 100);
    return () => window.clearInterval(interval);
  }, [showStory, isPaused, safeSegmentIndex, segmentCount, activeSegment?.isVideo]);

  // Segment complete → next segment, adjacent profile day / feed user, or close.
  useEffect(() => {
    if (!showStory || progress < 100 || segmentCount === 0) return;

    if (currentSegmentIndex < segmentCount - 1) {
      setCurrentSegmentIndex((c) => c + 1);
      setProgress(0);
      setIsPaused(false);
      return;
    }

    if (nextUserId) {
      handoffToAdjacentStory(nextUserId);
      return;
    }

    closeStoryViewer();
  }, [progress, currentSegmentIndex, segmentCount, showStory, nextUserId]);

  const storyPlaybackId = `story:${storyUser.id}`;
  const segmentHasSoundtrack =
    !!currentSegment?.backgroundAudio?.url &&
    isPlayableAudioUrl(currentSegment.backgroundAudio.url);
  const storyVideoWantsPlay =
    showStory &&
    !isPaused &&
    currentSegment?.isVideo === true &&
    !segmentHasSoundtrack;

  useExclusivePlayback(
    storyPlaybackId,
    PLAYBACK_PRIORITY.STORY,
    storyVideoWantsPlay,
    storyVideoRef
  );

  // Muted preview loop only — audible playback goes through the coordinator.
  useEffect(() => {
    const video = storyVideoRef.current;
    if (!video) return;
    if (!showStory || isPaused || !currentSegment?.isVideo) {
      video.pause();
      return;
    }
    if (segmentHasSoundtrack || !storyVideoWantsPlay) {
      if (video.paused) {
        video.play().catch(() => {});
      }
    }
  }, [
    isPaused,
    currentSegmentIndex,
    showStory,
    currentSegment?.isVideo,
    segmentHasSoundtrack,
    storyVideoWantsPlay,
  ]);

  const openCreateStoryFlow = (skipEmpty = false) => {
    if (!skipEmpty && isMyStoryEmpty) {
      setShowStoryEmpty(true);
      setShowCreateStory(false);
      return;
    }
    setShowStoryEmpty(false);
    setShowCreateStory(true);
  };

  useEffect(() => {
    if (!isCurrentUser) return;
    const onOpenCreate = (event: Event) => {
      const detail = (event as CustomEvent<StoryOpenCreateDetail>).detail;
      if (detail?.viewSegmentIndex !== undefined) {
        setShowStoryEmpty(false);
        setShowCreateStory(false);
        setShowStory(true);
        setCurrentSegmentIndex(detail.viewSegmentIndex);
        setProgress(0);
        setIsPaused(false);
        return;
      }
      const skipEmpty = detail?.skipEmpty ?? createdStory;
      if (skipEmpty) {
        setShowStoryEmpty(false);
        setShowCreateStory(true);
      } else {
        openCreateStoryFlow(false);
      }
    };
    window.addEventListener(STORY_OPEN_CREATE_EVENT, onOpenCreate);
    return () => window.removeEventListener(STORY_OPEN_CREATE_EVENT, onOpenCreate);
  }, [isCurrentUser, createdStory, isMyStoryEmpty]);

  const emitProfileVisitRecord = (context: {
    surface: 'story' | 'live';
    previewUrl?: string;
    liveKind?: typeof liveKind;
  }) => {
    if (isCurrentUser || !storyUser.id) return;
    window.dispatchEvent(
      new CustomEvent('profile-visit-record', {
        detail: {
          profileUserId: storyUser.id,
          context,
        },
      })
    );
  };

  const ringShellSizeClass =
    ringSize === 'profile'
      ? 'avatar-ring-shell--profile'
      : ringSize === 'lg'
        ? 'avatar-ring-shell--lg'
        : ringSize === 'compact'
          ? 'avatar-ring-shell--compact'
          : 'avatar-ring-shell--feed';

  const ringHaloSizeClass =
    ringSize === 'profile'
      ? 'avatar-ring-halo--profile'
      : ringSize === 'lg'
        ? 'avatar-ring-halo--lg'
        : ringSize === 'compact'
          ? 'avatar-ring-halo--compact'
          : 'avatar-ring-halo--feed';

  const statusBadgeSize =
    ringSize === 'profile' ? 'md' : ringSize === 'lg' ? 'sm' : 'xs';

  const thoughtBubbleClass =
    presentation === 'header'
      ? 'absolute bottom-[76%] left-[66%] mb-3 z-30 pointer-events-auto origin-bottom-left scale-[1.35]'
      : 'absolute bottom-[85%] left-[70%] mb-[10px] z-30 pointer-events-auto';

  const sharedThoughtText = (userFromDb.note ?? '').trim();
  const hasSharedThought = sharedThoughtText.length > 0;
  const hideThoughtOnProfileStoryCard =
    presentation === 'card' && storyScope === 'profile';
  /** Posted thoughts stay visible on profile header; hidden on duplicate profile story cards. */
  const showPostedThoughtBubble = hasSharedThought && !hideThoughtOnProfileStoryCard;
  /** + composer — hidden on profile header until avatar click; always on feed strip. */
  const thoughtUiSuppressed = standaloneStoryCreatorOpen || showStory;
  const showThoughtCreationUi =
    isCurrentUser &&
    !hasSharedThought &&
    !hideThoughtOnProfileStoryCard &&
    !thoughtUiSuppressed &&
    (presentation !== 'header' || showHeaderThoughtComposer);
  /** Edit affordance — profile header only, toggled by avatar click (never auto-opens modal). */
  const showThoughtEditUi =
    isCurrentUser &&
    hasSharedThought &&
    presentation === 'header' &&
    showHeaderThoughtComposer &&
    !thoughtUiSuppressed;
  const canShowThoughtModal = showNoteModal;

  const stripPrimaryLabel =
    ringLabel ??
    (isCurrentUser
      ? createdStory
        ? 'Your story'
        : 'Add story'
      : getProfileDisplayName(storyUser));

  const stripLiveSublabel =
    showAnimatedLiveRing && liveKind ? LIVE_KIND_LABELS[liveKind] : '';
  const stripHandleSublabel =
    !stripLiveSublabel && shouldShowProfileHandle(storyUser)
      ? formatProfileHandle(storyUser)
      : '';
  const stripSublabel = stripLiveSublabel || stripHandleSublabel || '\u00a0';
  const showStripSublabel = !!(stripLiveSublabel || stripHandleSublabel);

  const isProfileCreateCard =
    presentation === 'card' && isCurrentUser && story.id === 'current' && !profileDayKey;
  const isProfileArchiveCard =
    presentation === 'card' && storyScope === 'profile' && !!profileDayKey;

  const profileCardSegmentCount = isProfileArchiveCard ? segments.length : 0;
  const profileCardIsMulti = profileCardSegmentCount > 1;
  const profileCardDayViewed =
    isProfileArchiveCard &&
    !isOwnProfileArchive &&
    (ringViewed ?? db.hasViewedProfileDay(storyUser.id, profileDayKey!));
  const showProfileCardStoryRing =
    isProfileArchiveCard && !profileCardDayViewed && profileCardSegmentCount === 1;
  const showProfileCardMultiRing =
    isProfileArchiveCard && !profileCardDayViewed && profileCardIsMulti;
  const showProfileCardViewedRing =
    isProfileArchiveCard && profileCardDayViewed;

  const handleRingClick = () => {
    if (onRingClick) {
      onRingClick();
      return;
    }
    if (isProfileCreateCard) {
      const hasAnyStories =
        db.getProfileStorySegments(storyUser.id).length > 0 ||
        db.getFeedStorySegments(storyUser.id).length > 0;
      openCreateStoryFlow(hasAnyStories);
      return;
    }
    if (isProfileArchiveCard) {
      if (segments.length === 0) {
        showToast('No story available');
        return;
      }
      openStoryViewer();
      return;
    }
    if (presentation === 'header' && isCurrentUser && !onRingClick) {
      if (isLiveUser) {
        window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'live' } }));
        return;
      }
      setShowHeaderThoughtComposer((open) => {
        const next = !open;
        if (next) {
          setShowNoteModal(true);
        } else {
          setShowNoteModal(false);
        }
        return next;
      });
      return;
    }
    if (isMyStoryEmpty && story.id === 'current') {
      setShowStoryEmpty(true);
      return;
    }
    if (isLiveUser) {
      emitProfileVisitRecord({
        surface: 'live',
        liveKind: liveKind ?? 'solo',
      });
      window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'live' } }));
      return;
    }
    if (!isCurrentUser && !hasStoryContent) {
      return;
    }
    if (segments.length === 0) {
      showToast('No story available');
      return;
    }
    if (!isCurrentUser) {
      const first = segments[0];
      emitProfileVisitRecord({
        surface: 'story',
        previewUrl: first?.url,
      });
    }
    openStoryViewer();
  };

  useEffect(() => {
    if (!showCreateStory) setStoryCreateStep('select');
  }, [showCreateStory]);

  const handleStoryShared = (newIndex: number) => {
    setStoryCreateStep('select');
    setShowCreateStory(false);
    setShowStory(true);
    setCurrentSegmentIndex(newIndex);
    setProgress(0);
    setIsPaused(false);
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
              setIsPaused(false);
            } else if (prevUserId) {
              handoffToAdjacentStory(prevUserId);
            } else {
              setProgress(0);
            }
          } else {
            if (currentSegmentIndex < segments.length - 1) {
              setCurrentSegmentIndex(i => i + 1);
              setProgress(0);
              setIsPaused(false);
            } else if (nextUserId) {
              handoffToAdjacentStory(nextUserId);
            } else {
              closeStoryViewer();
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

  const hasAnimatedRing =
    showAnimatedStoryRing || showAnimatedMultiStoryRing || showAnimatedLiveRing;

  const profileCardShell = isProfileCreateCard ? (
    <div className="profile-story-card profile-story-card--create">
      <div className="profile-story-card-create-top">
        <img
          src={resolveAvatarSrc(storyUser.avatarUrl)}
          alt={storyUser.username || 'Your profile'}
          className="profile-story-card-media-el"
          onError={handleAvatarError}
        />
      </div>
      <div className="profile-story-card-create-bottom">
        <span>Create Story</span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openCreateStoryFlow(createdStory);
        }}
        className="profile-story-card-create-plus"
        title={createdStory ? 'Add another story segment' : 'Create story'}
        aria-label={createdStory ? 'Add another story segment' : 'Create story'}
      >
        <Plus className="h-5 w-5" strokeWidth={3} />
      </button>
    </div>
  ) : (
    <div className="profile-story-card profile-story-card--archive">
      <div className="profile-story-card-media">
        <ProfileStoryCardMedia
          segments={segments}
          alt={ringLabel || storyUser.username || 'Story'}
        />
        <div className="profile-story-card-scrim" aria-hidden />
        <div className="profile-story-card-meta profile-story-card-meta--no-avatar">
          <span className="profile-story-card-title">
            {ringLabel ?? getProfileDisplayName(storyUser)}
          </span>
        </div>
      </div>
    </div>
  );

  const profileArchiveCardRingClass = isProfileArchiveCard
    ? showProfileCardMultiRing
      ? 'profile-story-card-ring-wrap profile-story-card-ring-wrap--multi'
      : showProfileCardStoryRing
        ? 'profile-story-card-ring-wrap profile-story-card-ring-wrap--story'
        : showProfileCardViewedRing
          ? 'profile-story-card-ring-wrap profile-story-card-ring-wrap--viewed'
          : 'profile-story-card-ring-wrap'
    : '';

  const profileCardPresentation = isProfileArchiveCard ? (
    <div className={profileArchiveCardRingClass}>
      {showProfileCardMultiRing && profileCardSegmentCount > 1 ? (
        <span
          className="profile-story-card-segment-badge"
          aria-label={`${profileCardSegmentCount} stories`}
        >
          {profileCardSegmentCount}
        </span>
      ) : null}
      <div className="profile-story-card-ring-inner">{profileCardShell}</div>
    </div>
  ) : (
    profileCardShell
  );

  const ringShell = (
    <div
      ref={ringShellRef}
      className={`avatar-ring-shell ${ringShellSizeClass} transition-transform group-hover:scale-105 active:scale-95 ${
        hasAnimatedRing
          ? ''
          : showViewedStoryRing
            ? 'avatar-ring-shell--viewed'
            : 'avatar-ring-shell--no-ring ' +
              (isMyStoryEmpty
                ? 'bg-secondary border border-dashed border-border'
                : 'bg-secondary')
      }`}
    >
      {showAnimatedMultiStoryRing && (
        <>
          <div className="avatar-ring-glow avatar-ring-glow--multi" />
          <div className="avatar-ring-spinner avatar-ring-spinner--multi" />
        </>
      )}
      {showAnimatedStoryRing && (
        <>
          <div className="avatar-ring-glow avatar-ring-glow--story" />
          <div className="avatar-ring-spinner avatar-ring-spinner--story" />
        </>
      )}
      {showAnimatedLiveRing && (
        <>
          <div className={`avatar-ring-glow ${liveRingClasses.glow}`} />
          <div className={`avatar-ring-spinner ${liveRingClasses.spinner}`} />
        </>
      )}
      <div className="avatar-ring-face">
        <img
          src={resolveAvatarSrc(storyUser.avatarUrl)}
          alt={storyUser.username}
          className="h-full w-full object-cover"
          onError={handleAvatarError}
        />
      </div>

      {(showAnimatedLiveRing ||
        showStoryStatusBadge ||
        (isCurrentUser && createdStory)) && (
        <div className={getAvatarStatusBadgeOutsidePosition(statusBadgeSize)}>
          {showAnimatedLiveRing && (
            <AvatarStatusBadge variant="live" size={statusBadgeSize} />
          )}
          {showStoryStatusBadge && !showAnimatedLiveRing && (
            <AvatarStatusBadge
              variant={
                showViewedStoryRing
                  ? 'story-viewed'
                  : isMultiStory
                    ? 'story-multi'
                    : 'story'
              }
              size={statusBadgeSize}
            />
          )}
          {isCurrentUser && createdStory && !showAnimatedLiveRing && (
            <AvatarStatusBadge
              variant={isMultiStory ? 'story-multi' : 'you'}
              size={statusBadgeSize}
            />
          )}
        </div>
      )}

      {isCurrentUser && presentation !== 'header' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openCreateStoryFlow(createdStory);
          }}
          className="absolute -bottom-0.5 -right-0.5 z-30 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110 active:scale-90"
          title={createdStory ? 'Add another story segment' : 'Add your first story'}
          aria-label={createdStory ? 'Add another story segment' : 'Add your first story'}
        >
          <Plus className="h-3 w-3" strokeWidth={3} />
        </button>
      )}

      {/* Posted thought — always visible once shared (profile header + feed) */}
      {showPostedThoughtBubble ? (
        <ThoughtBubbleShell
          noteText={sharedThoughtText}
          onOpen={() => setShowPreviewModal(true)}
          className={thoughtBubbleClass}
        />
      ) : null}

    </div>
  );

  return (
    <>
      {showAvatarChrome &&
        (presentation === 'header' ? (
          <div
            ref={headerSlotRef}
            className="profile-header-avatar-slot cursor-pointer group overflow-visible"
            onClick={handleRingClick}
          >
            <div
              className={`avatar-ring-halo ${ringHaloSizeClass} avatar-ring-halo--contained`}
            >
              {ringShell}
            </div>
          </div>
        ) : presentation === 'card' ? (
          <div
            className="story-strip-item story-strip-item--card cursor-pointer group"
            onClick={handleRingClick}
          >
            {profileCardPresentation}
          </div>
        ) : (
          <div
            className="story-strip-item cursor-pointer group overflow-visible"
            onClick={handleRingClick}
          >
            <div className="story-strip-ring-slot">
              <div className={`avatar-ring-halo ${ringHaloSizeClass}`}>{ringShell}</div>
            </div>
            <div className="story-strip-labels">
              <span className="story-strip-username text-muted-foreground group-hover:text-foreground transition-colors">
                {stripPrimaryLabel}
              </span>
              <span
                className={`story-strip-sublabel text-muted-foreground/90 ${
                  showStripSublabel ? '' : 'story-strip-sublabel--hidden'
                }`}
              >
                {stripSublabel}
              </span>
            </div>
          </div>
        ))}

      <StoryRingPortals
        storyUser={storyUser}
        db={db}
        showStoryEmpty={showStoryEmpty}
        setShowStoryEmpty={setShowStoryEmpty}
        showCreateStory={showCreateStory}
        setShowCreateStory={setShowCreateStory}
        storyCreateStep={storyCreateStep}
        setStoryCreateStep={setStoryCreateStep}
        storyCreatorBackRef={storyCreatorBackRef}
        storyCreatorShareRef={storyCreatorShareRef}
        showStory={showStory}
        currentSegment={currentSegment}
        currentSegmentIndex={currentSegmentIndex}
        segments={segments}
        progress={progress}
        setProgress={setProgress}
        setCurrentSegmentIndex={setCurrentSegmentIndex}
        isPaused={isPaused}
        setIsPaused={setIsPaused}
        storyVideoRef={storyVideoRef}
        playbackSpeed={playbackSpeed}
        setPlaybackSpeed={setPlaybackSpeed}
        loopStoryVideo={loopStoryVideo}
        likedSegments={likedSegments}
        handleTap={handleTap}
        toggleLike={toggleLike}
        closeStoryViewer={closeStoryViewer}
        handoffToAdjacentStory={handoffToAdjacentStory}
        messageText={messageText}
        setMessageText={setMessageText}
        isSent={isSent}
        sendMessage={sendMessage}
        setShowShareModal={setShowShareModal}
        handleStoryShared={handleStoryShared}
        storyPlaybackId={storyPlaybackId}
        prevUserId={prevUserId}
        nextUserId={nextUserId}
        onRequestOpenUser={onRequestOpenUser}
      />

      <ShareModal
        isOpen={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setIsPaused(false);
        }}
        shareUrl={storySharePayload.shareUrl}
        itemTitle={storySharePayload.itemTitle}
        shareText={storySharePayload.shareText}
        kind={storySharePayload.kind}
        notificationText={storySharePayload.notificationText}
      />

      <ThoughtComposerBubblePortal
        anchorRef={ringShellRef}
        visible={!!showThoughtCreationUi}
        mode="add"
        variant={presentation === 'header' ? 'profile' : 'feed'}
        onOpen={openThoughtComposer}
      />
      <ThoughtComposerBubblePortal
        anchorRef={ringShellRef}
        visible={!!showThoughtEditUi}
        mode="edit"
        variant="profile"
        onOpen={openThoughtComposer}
      />

      {canShowThoughtModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id="story-ring-thought-modal"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 pointer-events-auto"
          >
            <motion.div
              key="story-thought-composer-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card w-full max-w-[320px] rounded-[24px] border border-border shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <span className="font-bold text-lg">Thinking</span>
                <button
                  onClick={closeThoughtComposer}
                  className="p-1 hover:bg-secondary rounded-full transition-colors"
                >
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
                          db.updateUser(userFromDb.id, u => ({ ...u, ...patchUserThoughtNote(noteEditVal.trim()) }));
                          closeThoughtComposer();
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
                    <img src={resolveAvatarSrc(userFromDb.avatarUrl)} className="w-full h-full rounded-full object-cover" onError={handleAvatarError} />
                  </div>
                </div>
              </div>
              
              <div className="p-4 flex gap-2">
                {userFromDb.note && (
                  <button 
                    onClick={() => {
                      db.updateUser(userFromDb.id, u => ({ ...u, ...patchUserThoughtNote('') }));
                      closeThoughtComposer();
                      showToast('Note deleted');
                    }}
                    className="flex-1 py-3 text-red-500 font-bold bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors"
                  >
                    Delete
                  </button>
                )}
                <button 
                  onClick={() => {
                    db.updateUser(userFromDb.id, u => ({ ...u, ...patchUserThoughtNote(noteEditVal.trim()) }));
                    closeThoughtComposer();
                    showToast('Note updated');
                  }}
                  className="flex-[2] py-3 text-primary-foreground font-bold bg-primary hover:bg-primary/90 rounded-xl transition-colors disabled:opacity-50"
                  disabled={!noteEditVal.trim() && !userFromDb.note}
                >
                  Share Thought
                </button>
              </div>
            </motion.div>
            </div>,
            document.body,
          )}

      {showPreviewModal && userFromDb.note ? (
        <ThoughtViewOverlay
          user={userFromDb}
          thought={userFromDb.note}
          onClose={() => setShowPreviewModal(false)}
        />
      ) : null}
    </>
  );
}

