import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Camera, Globe, Lock, Music2, Radio, MessageSquare, Users2, Video, ShoppingBag, PartyPopper, Gamepad2 } from 'lucide-react';
import { CreateRoomSeatMockup } from '../components/CreateRoomSeatMockup';
import { useNavigate } from 'react-router-dom';
import { useRoomSettingsNavigateBack } from '../context/RoomFlowContext';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { getProfileDisplayName } from '../../lib/profileDisplay';
import { saveRoomSettings, type RoomMode } from '../utils/storage';
import { resolveMultiGuestSeatCount } from '../utils/roomSeats';
import { assignOwnerToSettings } from '../utils/roomRoleUsers';
import { roomPrivacyPatch, validateRoomKeyInput, MAX_ROOM_KEY_LENGTH, MIN_ROOM_KEY_LENGTH } from '../utils/roomPrivacy';
import { upsertManagedRoom } from '../utils/managedRooms';
import { initRoomExp } from '../utils/roomExp';
import { initRoomGifts } from '../utils/roomGifts';
import { resolveLocalOwnerPartyRoomId, reconcileOwnerPartyRoomIdFromCloud, getStoredOwnerPartyRoomId, setStoredOwnerPartyRoomId } from '../utils/ownerPartyRoomId';
import { syncPartyRoomToCloudAsync } from '../utils/syncPartyRoomCloud';
import { clearHostLiveEnded } from '../../lib/live/hostLiveEndedRegistry';
import { getRoomSettings } from '../utils/storage';
import { useAppCamera } from '../../contexts/AppCameraContext';
import { EMPTY_BODY_SHAPE } from '../../lib/ar/bodyShape';
import { EMPTY_TENCENT_EFFECT_SELECTION } from '../../lib/webar/webarTypes';
import {
  stashPendingCreateRoomBeauty,
  type PendingCreateRoomBeauty,
} from '../utils/pendingCreateRoomBeauty';

const LIVE_CAMERA_MODES = new Set(['Solo-Live', 'Commerce-Live', 'Multi-Guest']);

type CreateRoomHint = { roomName?: string; mode?: string; autoLaunch?: boolean };

type LaunchTransition =
  | 'IDLE'
  | 'CREATE_ROOM_CLICKED'
  | 'CREATE_ROOM_VALIDATING'
  | 'CREATE_ROOM_VALIDATION_PASS'
  | 'CREATE_ROOM_VALIDATION_BLOCKED'
  | 'CREATE_ROOM_REQUEST_START'
  | 'CREATE_ROOM_REQUEST_OK'
  | 'CREATE_ROOM_REQUEST_FAIL'
  | 'COUNTDOWN_START'
  | 'ROOM_CREATING'
  | 'ROOM_CREATED';

/** Survives CreateRoom effect re-runs when auth id hydrates after first paint. */
let retainedGoLiveHint: CreateRoomHint | null = null;

function readCreateRoomHint(consume: boolean): CreateRoomHint | null {
  try {
    const raw = sessionStorage.getItem('uni.createRoom.hint');
    if (!raw) return retainedGoLiveHint;
    const parsed = JSON.parse(raw) as CreateRoomHint;
    retainedGoLiveHint = parsed;
    if (consume) sessionStorage.removeItem('uni.createRoom.hint');
    return parsed;
  } catch {
    return retainedGoLiveHint;
  }
}

function clearRetainedGoLiveHint(): void {
  retainedGoLiveHint = null;
  try {
    sessionStorage.removeItem('uni.createRoom.hint');
  } catch {
    /* ignore */
  }
}

function emitCreateRoomTransition(step: LaunchTransition, detail?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = { step, at: Date.now(), ...detail };
    (window as Window & { __UNILIVE_CREATE_ROOM_DEBUG__?: unknown }).__UNILIVE_CREATE_ROOM_DEBUG__ =
      payload;
    if (import.meta.env.DEV || import.meta.env.MODE === 'production') {
      console.info('[CreateRoom]', step, detail ?? {});
    }
  } catch {
    /* ignore */
  }
}

/** Advance InstantRoomEntryHost MemoryRouter to the live room (not CreateRoom). */
function goToHostLiveRoom(roomId: string, options?: { mode?: string; roomName?: string }): void {
  emitCreateRoomTransition('ROOM_CREATED', { roomId });
  // InstantRoomEntryHost owns a MemoryRouter keyed by flowKey. Plain navigate() can
  // leave CreateRoom mounted (AX still shows go-live-entry + ROOM_CREATED). Re-open
  // the shell at /room/:id so Room → SoloLiveView mounts.
  try {
    window.dispatchEvent(
      new CustomEvent('instant-room-open', {
        detail: {
          path: `/room/${roomId}`,
          roomId,
          entry: 'karaoke-party',
          roomName: options?.roomName,
          roomMode: options?.mode,
        },
      }),
    );
  } catch {
    /* ignore */
  }
}

const CreateRoom = () => {
  const navigate = useNavigate();
  const navigateSettingsBack = useRoomSettingsNavigateBack();
  const currentUser = useCurrentUser();
  const hostDisplayName = getProfileDisplayName(currentUser, 'Host');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isAvailable: cameraAvailable, openCamera } = useAppCamera();
  const liveSetupRef = useRef<PendingCreateRoomBeauty | null>(null);

  const [roomName, setRoomName] = useState('');
  const [privacy, setPrivacy] = useState<'Public' | 'Private'>('Public');
  const [privateRoomKey, setPrivateRoomKey] = useState('');
  const [privateKeyError, setPrivateKeyError] = useState<string | null>(null);
  const [mode, setMode] = useState('Chat');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [canonicalRoomId, setCanonicalRoomId] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [goLiveCountdown, setGoLiveCountdown] = useState<number | null>(null);
  const [launchBlockReason, setLaunchBlockReason] = useState<string | null>(null);
  const [launchTransition, setLaunchTransition] = useState<LaunchTransition>('IDLE');
  const pendingNavigateRef = useRef<string | null>(null);
  const launchLockRef = useRef(false);
  const handleCreateRef = useRef<(source: string) => void>(() => {});
  const launchBtnRef = useRef<HTMLButtonElement | null>(null);
  const pendingAutoLaunchRef = useRef(false);
  const autoLaunchAttemptedRef = useRef(false);
  const snapRef = useRef({
    mode,
    roomName,
    privacy,
    privateRoomKey,
    launching,
    goLiveCountdown,
    canonicalRoomId,
    coverPreview,
    currentUserId: currentUser?.id ?? '',
    hostDisplayName,
  });
  snapRef.current = {
    mode,
    roomName,
    privacy,
    privateRoomKey,
    launching,
    goLiveCountdown,
    canonicalRoomId,
    coverPreview,
    currentUserId: currentUser?.id ?? '',
    hostDisplayName,
  };

  useEffect(() => {
    void import('../../lib/webar/tencentWebARWarm').then((m) => {
      m.warmTencentWebARPipelineNow();
    });
  }, []);

  // Keep TRTC warm whenever Solo/Shop is selected so beauty applies on first tap.
  useEffect(() => {
    if (!LIVE_CAMERA_MODES.has(mode)) return;
    void import('../../lib/webar/tencentWebARWarm').then((m) => {
      void m.ensureTencentWebARPipelineWarm();
    });
  }, [mode]);

  const handleLiveSetupChange = useCallback((setup: PendingCreateRoomBeauty) => {
    liveSetupRef.current = setup;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromRoom = (roomId: string) => {
      setCanonicalRoomId(roomId);
      const settings = getRoomSettings(roomId);
      // Do not overwrite an active Go Live hint (Solo + caption) with stale Chat settings.
      const hint = retainedGoLiveHint;
      if (!hint?.mode?.trim() && settings.roomName?.trim()) setRoomName(settings.roomName);
      if (!hint?.mode?.trim() && settings.roomMode) setMode(String(settings.roomMode));
      if (hint?.roomName?.trim()) setRoomName(hint.roomName.trim());
      if (hint?.mode?.trim()) setMode(hint.mode.trim());
      if (settings.privacy === 'Private' || settings.privacy === 'Public') {
        setPrivacy(settings.privacy);
      }
    };

    const applyHint = (hint: CreateRoomHint | null) => {
      if (!hint) return;
      if (hint.roomName?.trim()) {
        const next = hint.roomName.trim();
        snapRef.current.roomName = next;
        setRoomName(next);
      }
      if (hint.mode?.trim()) {
        const next = hint.mode.trim();
        snapRef.current.mode = next;
        setMode(next);
      }
      if (hint.autoLaunch) {
        pendingAutoLaunchRef.current = true;
        autoLaunchAttemptedRef.current = false;
      }
    };

    const tryAutoLaunchFromHint = (source: string) => {
      if (!pendingAutoLaunchRef.current || autoLaunchAttemptedRef.current) return;
      const snap = snapRef.current;
      if (!LIVE_CAMERA_MODES.has(snap.mode) || !snap.roomName.trim() || !snap.currentUserId.trim()) {
        return;
      }
      autoLaunchAttemptedRef.current = true;
      pendingAutoLaunchRef.current = false;
      window.setTimeout(() => handleCreateRef.current(source), 50);
    };

    const hint = readCreateRoomHint(false);
    applyHint(hint);

    const onCreateRoomHint = (event: Event) => {
      const detail = (event as CustomEvent<CreateRoomHint>).detail;
      if (!detail) return;
      retainedGoLiveHint = detail;
      applyHint(detail);
      try {
        sessionStorage.setItem('uni.createRoom.hint', JSON.stringify(detail));
      } catch {
        /* ignore */
      }
      tryAutoLaunchFromHint('hint-event');
    };
    window.addEventListener('uni:create-room-hint', onCreateRoomHint as EventListener);

    const local =
      getStoredOwnerPartyRoomId(currentUser?.id) ??
      resolveLocalOwnerPartyRoomId(currentUser?.id);
    if (local) hydrateFromRoom(local);
    applyHint(retainedGoLiveHint ?? hint);
    tryAutoLaunchFromHint('hint-hydrate');

    void reconcileOwnerPartyRoomIdFromCloud(currentUser?.id).then((cloudId) => {
      if (cancelled || !cloudId || cloudId === local) return;
      hydrateFromRoom(cloudId);
      applyHint(retainedGoLiveHint);
      tryAutoLaunchFromHint('hint-cloud');
    });

    return () => {
      cancelled = true;
      window.removeEventListener('uni:create-room-hint', onCreateRoomHint as EventListener);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (goLiveCountdown === null) return undefined;
    if (goLiveCountdown <= 0) {
      const timer = window.setTimeout(() => {
        const roomId = pendingNavigateRef.current;
        pendingNavigateRef.current = null;
        setGoLiveCountdown(null);
        setLaunching(false);
        launchLockRef.current = false;
        setLaunchTransition('ROOM_CREATED');
        if (roomId) {
          goToHostLiveRoom(roomId, {
            mode: snapRef.current.mode,
            roomName: snapRef.current.roomName,
          });
          navigate(`/room/${roomId}`, { replace: true });
        }
      }, 700);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setGoLiveCountdown((value) => (value === null ? null : value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [goLiveCountdown, navigate]);

  const handleImageClick = () => {
    if (cameraAvailable) {
      openCamera({
        title: 'Room cover',
        onCaptured: ({ kind, url }) => {
          if (kind === 'photo') setCoverPreview(url);
        },
      });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async (source: string) => {
    const snap = snapRef.current;
    emitCreateRoomTransition('CREATE_ROOM_CLICKED', {
      source,
      mode: snap.mode,
      roomName: snap.roomName,
      lock: launchLockRef.current,
      userIdPresent: Boolean(snap.currentUserId.trim()),
    });
    setLaunchTransition('CREATE_ROOM_CLICKED');

    // Never leave a prior failed attempt in permanent lock. Countdown is the only hard busy.
    if (snap.goLiveCountdown !== null) {
      setLaunchBlockReason('live-launch-blocked-busy');
      setLaunchTransition('CREATE_ROOM_VALIDATION_BLOCKED');
      emitCreateRoomTransition('CREATE_ROOM_VALIDATION_BLOCKED', {
        reason: 'countdown-active',
        source,
      });
      return;
    }
    launchLockRef.current = false;
    if (snap.launching) {
      // Stale launching without countdown — recover to IDLE so retry works.
      setLaunching(false);
      snapRef.current.launching = false;
    }

    setLaunchTransition('CREATE_ROOM_VALIDATING');
    emitCreateRoomTransition('CREATE_ROOM_VALIDATING', { source });

    if (!snap.roomName.trim()) {
      setLaunchBlockReason('live-launch-blocked-caption');
      setLaunchTransition('CREATE_ROOM_VALIDATION_BLOCKED');
      emitCreateRoomTransition('CREATE_ROOM_VALIDATION_BLOCKED', { reason: 'caption', source });
      return;
    }

    if (snap.privacy === 'Private') {
      const validation = validateRoomKeyInput(snap.privateRoomKey);
      if (!validation.valid) {
        setPrivateKeyError(validation.message ?? 'Enter a valid room key.');
        setLaunchBlockReason('live-launch-blocked-privacy');
        setLaunchTransition('CREATE_ROOM_VALIDATION_BLOCKED');
        emitCreateRoomTransition('CREATE_ROOM_VALIDATION_BLOCKED', { reason: 'privacy', source });
        return;
      }
    }

    if (!snap.currentUserId.trim()) {
      setLaunchBlockReason('live-launch-blocked-auth');
      setLaunchTransition('CREATE_ROOM_VALIDATION_BLOCKED');
      emitCreateRoomTransition('CREATE_ROOM_VALIDATION_BLOCKED', { reason: 'auth', source });
      return;
    }

    setPrivateKeyError(null);
    setLaunchBlockReason(null);
    setLaunchTransition('CREATE_ROOM_VALIDATION_PASS');
    emitCreateRoomTransition('CREATE_ROOM_VALIDATION_PASS', {
      source,
      mode: snap.mode,
      roomName: snap.roomName,
    });

    launchLockRef.current = true;
    setLaunching(true);
    setLaunchTransition('CREATE_ROOM_REQUEST_START');
    emitCreateRoomTransition('CREATE_ROOM_REQUEST_START', { source });

    const isLiveCameraMode = LIVE_CAMERA_MODES.has(snap.mode);

    try {
      const roomIdString =
        resolveLocalOwnerPartyRoomId(snap.currentUserId, { createIfMissing: true }) ??
        snap.canonicalRoomId;
      if (!roomIdString) {
        launchLockRef.current = false;
        setLaunching(false);
        setLaunchBlockReason('live-launch-blocked-room-id');
        setLaunchTransition('CREATE_ROOM_REQUEST_FAIL');
        emitCreateRoomTransition('CREATE_ROOM_REQUEST_FAIL', { reason: 'room-id', source });
        return;
      }

      const privacyPatch = roomPrivacyPatch(snap.privacy, snap.privateRoomKey);
      const ownerSettings = assignOwnerToSettings(
        {
          roomName: snap.roomName,
          roomId: roomIdString,
          roomMode: snap.mode as RoomMode,
          coverPhoto: snap.coverPreview ?? 'Default',
          whoCanBeSeated: 'Anyone',
          seatJoinMode: 'free',
          ...(snap.mode === 'Multi-Guest'
            ? {
                multiGuestSeatCount: resolveMultiGuestSeatCount(
                  liveSetupRef.current?.multiGuestSeatCount,
                ),
              }
            : {}),
          ...privacyPatch,
        },
        {
          id: snap.currentUserId,
          displayName: snap.hostDisplayName,
          username: snap.hostDisplayName,
        },
      );

      saveRoomSettings(roomIdString, ownerSettings);

      initRoomExp(roomIdString, {
        totalExp: 0,
        todayExp: 0,
        todayEmptyRoomFreeExp: 0,
        todaySeatedFreeExp: 0,
        todayGoldExp: 0,
      });
      initRoomGifts(roomIdString, { totalStars: 0, todayStars: 0, giftCount: 0, recentGifts: [] });

      upsertManagedRoom({
        id: roomIdString,
        name: snap.roomName,
        roomMode: snap.mode as RoomMode,
        role: 'owner',
        hostName: snap.hostDisplayName,
      });

      localStorage.setItem('currentUserRole', 'owner');
      localStorage.setItem('activeRoomId', roomIdString);
      setStoredOwnerPartyRoomId(snap.currentUserId, roomIdString);
      clearHostLiveEnded({ roomId: roomIdString, hostUserId: snap.currentUserId });

      setLaunchTransition('CREATE_ROOM_REQUEST_OK');
      emitCreateRoomTransition('CREATE_ROOM_REQUEST_OK', {
        roomId: roomIdString,
        mode: snap.mode,
        source,
      });

      await syncPartyRoomToCloudAsync(roomIdString, snap.currentUserId, {
        roomName: snap.roomName,
        roomMode: snap.mode as RoomMode,
        privacy: snap.privacy,
        whoCanJoin: privacyPatch.whoCanJoin,
        roomKey: privacyPatch.roomKey,
        whoCanBeSeated: 'Anyone',
        seatJoinMode: 'free',
        coverPhoto: snap.coverPreview ?? 'Default',
        ...(snap.mode === 'Multi-Guest'
          ? {
              multiGuestSeatCount: resolveMultiGuestSeatCount(
                liveSetupRef.current?.multiGuestSeatCount,
              ),
            }
          : {}),
      });
      void reconcileOwnerPartyRoomIdFromCloud(snap.currentUserId);

      if (isLiveCameraMode) {
        const setup = liveSetupRef.current ?? {
          beautyId: 'none' as const,
          beautyEffects: { ...EMPTY_TENCENT_EFFECT_SELECTION },
          bodyShape: { ...EMPTY_BODY_SHAPE },
          beautifyOverride: null,
          roomMode: snap.mode as 'Solo-Live' | 'Commerce-Live' | 'Multi-Guest',
        };
        stashPendingCreateRoomBeauty({
          ...setup,
          roomMode: snap.mode as 'Solo-Live' | 'Commerce-Live' | 'Multi-Guest',
        });
        pendingNavigateRef.current = roomIdString;
        clearRetainedGoLiveHint();
        pendingAutoLaunchRef.current = false;
        setLaunchTransition('COUNTDOWN_START');
        emitCreateRoomTransition('COUNTDOWN_START', { roomId: roomIdString, source });
        setGoLiveCountdown(1);
        return;
      }

      clearRetainedGoLiveHint();
      pendingAutoLaunchRef.current = false;
      setLaunchTransition('ROOM_CREATING');
      emitCreateRoomTransition('ROOM_CREATING', { roomId: roomIdString, source });
      goToHostLiveRoom(roomIdString, { mode: snap.mode, roomName: snap.roomName });
      navigate(`/room/${roomIdString}`, { replace: true });
    } catch (err) {
      console.error('[CreateRoom] launch failed', err);
      launchLockRef.current = false;
      setLaunching(false);
      setLaunchBlockReason('live-error-state');
      setLaunchTransition('CREATE_ROOM_REQUEST_FAIL');
      emitCreateRoomTransition('CREATE_ROOM_REQUEST_FAIL', {
        reason: 'exception',
        message: err instanceof Error ? err.message : 'unknown',
        source,
      });
    } finally {
      if (!isLiveCameraMode) {
        launchLockRef.current = false;
        setLaunching(false);
      }
    }
  };
  handleCreateRef.current = handleCreate;

  // Bridge for Cap/WK diagnostics — no secrets.
  useEffect(() => {
    const w = window as Window & { __UNILIVE_CREATE_ROOM_LAUNCH__?: () => void };
    w.__UNILIVE_CREATE_ROOM_LAUNCH__ = () => handleCreateRef.current('bridge');
    return () => {
      if (w.__UNILIVE_CREATE_ROOM_LAUNCH__) delete w.__UNILIVE_CREATE_ROOM_LAUNCH__;
    };
  }, []);

  // Single-shot auto-launch when React state catches up (hint path may already have fired).
  useEffect(() => {
    if (!pendingAutoLaunchRef.current || autoLaunchAttemptedRef.current) return;
    if (!currentUser?.id?.trim()) return;
    if (!LIVE_CAMERA_MODES.has(mode) || !roomName.trim()) return;
    autoLaunchAttemptedRef.current = true;
    pendingAutoLaunchRef.current = false;
    window.setTimeout(() => handleCreateRef.current('auto-launch'), 50);
  }, [mode, roomName, currentUser?.id]);

  const handleModeSelect = (modeId: string) => {
    if (goLiveCountdown !== null) return;
    setMode(modeId);
    snapRef.current.mode = modeId;
  };

  const handleHeaderBack = () => {
    if (goLiveCountdown !== null) return;
    navigateSettingsBack();
  };

  const privateKeyValidation = validateRoomKeyInput(privateRoomKey);
  const canLaunch =
    roomName.trim().length > 0 &&
    (privacy === 'Public' || privateKeyValidation.valid) &&
    Boolean(currentUser?.id?.trim());
  const isLiveCameraMode = LIVE_CAMERA_MODES.has(mode);

  // Native DOM listeners (capture) — Cap AX often skips React synthetic click on this CTA
  // while mode-chip onClick still works. Match chip semantics + guarantee one DOM path.
  useEffect(() => {
    const el = launchBtnRef.current;
    if (!el) return undefined;
    const onNative = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      handleCreateRef.current('native-dom');
    };
    el.addEventListener('click', onNative, true);
    el.addEventListener('pointerup', onNative, true);
    return () => {
      el.removeEventListener('click', onNative, true);
      el.removeEventListener('pointerup', onNative, true);
    };
  }, [isLiveCameraMode, launching, goLiveCountdown]);

  const initialMultiSeatCount = resolveMultiGuestSeatCount(
    canonicalRoomId ? getRoomSettings(canonicalRoomId).multiGuestSeatCount : 16,
  );
  const launchLabel = launching
    ? goLiveCountdown !== null
      ? 'Going live…'
      : 'Opening…'
    : isLiveCameraMode
      ? 'Go Live'
      : canonicalRoomId
        ? 'Open Room'
        : 'Launch Room';

  const modes = [
    { id: 'Chat', icon: MessageSquare, label: 'Chat' },
    { id: 'Radio', icon: Radio, label: 'Watch' },
    { id: 'Game-Live', icon: Gamepad2, label: 'Game' },
    { id: 'Karaoke', icon: Music2, label: 'Karaoke' },
    { id: 'Multi-Guest', icon: Users2, label: 'Multi' },
    { id: 'Solo-Live', icon: Video, label: 'Solo' },
    { id: 'Party', icon: PartyPopper, label: 'Party' },
    { id: 'Commerce-Live', icon: ShoppingBag, label: 'Shop' },
  ] as const;

  const privacyOptions = [
    { id: 'Public' as const, icon: Globe, label: 'Public' },
    { id: 'Private' as const, icon: Lock, label: 'Private' },
  ];

  const liveQaState =
    launchBlockReason === 'live-error-state'
      ? 'live-error-state'
      : goLiveCountdown !== null
        ? 'live-countdown'
        : launching
          ? 'live-room-creating'
          : launchBlockReason || 'go-live-entry';

  return (
    <div
      className="relative flex h-full flex-col bg-slate-950 font-sans text-white"
      data-live-qa-state={liveQaState}
      data-live-qa-mode={mode}
      data-live-qa-transition={launchTransition}
      aria-label={liveQaState}
    >
      {launchTransition !== 'IDLE' ? (
        <span className="sr-only" aria-label={launchTransition} data-live-qa-transition={launchTransition} />
      ) : null}
      {goLiveCountdown !== null ? (
        <button
          type="button"
          className="absolute inset-0 z-[80] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => {
            const roomId = pendingNavigateRef.current;
            pendingNavigateRef.current = null;
            setGoLiveCountdown(null);
            setLaunching(false);
            launchLockRef.current = false;
            if (roomId) {
              goToHostLiveRoom(roomId, { mode, roomName });
              navigate(`/room/${roomId}`, { replace: true });
            }
          }}
          aria-label="Skip countdown and go live"
          data-live-qa-state="live-countdown"
        >
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.28em] text-white/70">
            Starting stream
          </p>
          <div
            key={goLiveCountdown}
            className="text-7xl font-black tabular-nums text-white drop-shadow-[0_0_28px_rgba(59,130,246,0.55)]"
          >
            {goLiveCountdown > 0 ? goLiveCountdown : 'GO'}
          </div>
          <p className="mt-4 text-sm font-semibold text-white/80">
            Beauty effects stay on when you go live
          </p>
          <p className="mt-2 text-[11px] font-semibold text-white/50">Tap to skip</p>
        </button>
      ) : null}

      <header className="sticky top-0 z-40 flex shrink-0 items-center bg-slate-950/95 p-4 backdrop-blur-md">
        <button
          onClick={handleHeaderBack}
          className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10"
          aria-label="Go back"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="mr-10 flex min-w-0 flex-1 flex-col items-center gap-0.5">
          <h1 className="text-center text-lg font-black uppercase tracking-tight">
            {canonicalRoomId ? 'Your Room' : 'Create Room'}
          </h1>
          {canonicalRoomId ? (
            <p className="max-w-full px-1 text-center text-[10px] font-semibold leading-snug text-blue-300/90 sm:text-[11px]">
              Your permanent room ID is{' '}
              <span className="font-mono text-blue-200">ID:{canonicalRoomId}</span>
              {' '}— it stays the same when you change mode.
            </p>
          ) : null}
        </div>
      </header>

      {isLiveCameraMode ? (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-black">
          <div
            className={
              isLiveCameraMode
                ? 'shrink-0 px-3 pb-2 pt-3'
                : 'pointer-events-none absolute inset-x-0 top-3 z-20 px-3'
            }
          >
            <div className="pointer-events-auto flex min-w-0 items-end gap-3 rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur-md">
              <div className="flex shrink-0 flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-[0.18em] text-white/55">
                  Cover
                </label>
                <button
                  type="button"
                  onClick={handleImageClick}
                  className={`group relative flex h-14 w-14 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed transition-all ${
                    coverPreview
                      ? 'border-transparent'
                      : 'border-white/25 bg-black/40 hover:border-blue-400'
                  }`}
                  aria-label="Add room cover"
                >
                  {coverPreview ? (
                    <>
                      <img src={coverPreview} className="absolute inset-0 h-full w-full object-cover" alt="Cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                        <Camera size={16} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <>
                      <Camera size={16} className="text-white/60 transition group-hover:text-blue-300" />
                      <span className="mt-0.5 text-[7px] font-bold uppercase tracking-wide text-white/50">
                        Add
                      </span>
                    </>
                  )}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label
                  htmlFor="create-room-name-live"
                  className="text-[9px] font-black uppercase tracking-[0.18em] text-white/55"
                >
                  Caption
                </label>
                <input
                  id="create-room-name-live"
                  type="text"
                  placeholder="Welcome to the room!"
                  value={roomName}
                  onChange={(e) => {
                    const next = e.target.value;
                    snapRef.current.roomName = next;
                    setRoomName(next);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreate('caption-enter');
                    }
                  }}
                  aria-label="create-room-name"
                  data-testid="create-room-name"
                  className="h-14 w-full rounded-xl border border-white/15 bg-black/45 px-3 text-sm font-medium text-white outline-none transition placeholder:text-white/35 focus:border-blue-400"
                />
              </div>

              <div className="flex shrink-0 flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-[0.18em] text-white/55">
                  Privacy
                </label>
                <div className="flex h-14 items-center gap-2.5">
                  {privacyOptions.map((option) => {
                    const Icon = option.icon;
                    const selected = privacy === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setPrivacy(option.id);
                          setPrivateKeyError(null);
                        }}
                        title={option.id === 'Public' ? 'Everyone can join' : 'Key required to enter'}
                        className="flex flex-col items-center gap-0.5"
                      >
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all active:scale-95 ${
                            selected
                              ? option.id === 'Public'
                                ? 'border-blue-400 bg-blue-600/30 text-blue-200'
                                : 'border-amber-400 bg-amber-600/30 text-amber-200'
                              : 'border-white/20 bg-black/40 text-white/50 hover:text-white'
                          }`}
                        >
                          <Icon size={16} strokeWidth={2.25} />
                        </span>
                        <span
                          className={`text-[8px] font-bold uppercase tracking-wide ${
                            selected ? 'text-white' : 'text-white/45'
                          }`}
                        >
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {privacy === 'Private' ? (
              <div className="pointer-events-auto mt-2 rounded-xl border border-amber-400/30 bg-black/55 p-3 backdrop-blur-md">
                <label
                  htmlFor="create-room-key-live"
                  className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300/90"
                >
                  Room Key
                </label>
                <input
                  id="create-room-key-live"
                  type="text"
                  value={privateRoomKey}
                  onChange={(event) => {
                    setPrivateRoomKey(event.target.value);
                    if (privateKeyError) setPrivateKeyError(null);
                  }}
                  placeholder={`Choose a key (${MIN_ROOM_KEY_LENGTH}-${MAX_ROOM_KEY_LENGTH} characters)`}
                  maxLength={MAX_ROOM_KEY_LENGTH}
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-amber-400/60"
                />
                {privateKeyError ? (
                  <p className="mt-1 text-xs font-medium text-red-300">{privateKeyError}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <CreateRoomSeatMockup
              mode={mode}
              livePreviewEnabled
              initialSeatCount={initialMultiSeatCount}
              onLiveSetupChange={handleLiveSetupChange}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2 scrollbar-hide">
          <div className="flex flex-col gap-4">
            <div className="flex min-w-0 items-end gap-4">
              <div className="flex shrink-0 flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Cover
                </label>
                <button
                  type="button"
                  onClick={handleImageClick}
                  className={`group relative flex h-20 w-20 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all ${
                    coverPreview
                      ? 'border-transparent'
                      : 'border-slate-700 bg-slate-950 hover:border-blue-500'
                  }`}
                  aria-label="Add room cover"
                >
                  {coverPreview ? (
                    <>
                      <img src={coverPreview} className="absolute inset-0 h-full w-full object-cover" alt="Cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                        <Camera size={20} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <>
                      <Camera size={22} className="text-slate-500 transition group-hover:text-blue-400" />
                      <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-500 group-hover:text-blue-400">
                        Add
                      </span>
                    </>
                  )}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <label
                  htmlFor="create-room-name"
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500"
                >
                  Caption
                </label>
                <input
                  id="create-room-name"
                  type="text"
                  placeholder="Welcome to the room!"
                  value={roomName}
                  onChange={(e) => {
                    const next = e.target.value;
                    snapRef.current.roomName = next;
                    setRoomName(next);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreate('caption-enter');
                    }
                  }}
                  aria-label="create-room-name"
                  data-testid="create-room-name"
                  className="h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-[13px] font-medium text-white transition-all placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex shrink-0 flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Privacy
                </label>
                <div className="flex h-20 items-center gap-4">
                  {privacyOptions.map((option) => {
                    const Icon = option.icon;
                    const selected = privacy === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setPrivacy(option.id);
                          setPrivateKeyError(null);
                        }}
                        title={option.id === 'Public' ? 'Everyone can join' : 'Key required to enter'}
                        className="flex flex-col items-center gap-1"
                      >
                        <span
                          className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all active:scale-95 ${
                            selected
                              ? option.id === 'Public'
                                ? 'border-blue-500 bg-blue-600/20 text-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.25)]'
                                : 'border-amber-500 bg-amber-600/20 text-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.25)]'
                              : 'border-white/10 bg-slate-900 text-slate-500 hover:border-white/20 hover:text-slate-300'
                          }`}
                        >
                          <Icon size={20} strokeWidth={2.25} />
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wide ${
                            selected ? 'text-white' : 'text-slate-500'
                          }`}
                        >
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {privacy === 'Private' ? (
              <div className="flex flex-col gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                <label
                  htmlFor="create-room-key"
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/90"
                >
                  Room Key
                </label>
                <input
                  id="create-room-key"
                  type="text"
                  value={privateRoomKey}
                  onChange={(event) => {
                    setPrivateRoomKey(event.target.value);
                    if (privateKeyError) setPrivateKeyError(null);
                  }}
                  placeholder={`Choose a key (${MIN_ROOM_KEY_LENGTH}-${MAX_ROOM_KEY_LENGTH} characters)`}
                  maxLength={MAX_ROOM_KEY_LENGTH}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-amber-500/50"
                />
                <p className="text-[10px] leading-relaxed text-slate-400">
                  You choose the key. It stays the same until you change it in room settings.
                </p>
                {privateKeyError ? (
                  <p className="text-xs font-medium text-red-400">{privateKeyError}</p>
                ) : null}
              </div>
            ) : null}

            <CreateRoomSeatMockup
              mode={mode}
              livePreviewEnabled={false}
              initialSeatCount={initialMultiSeatCount}
              onLiveSetupChange={handleLiveSetupChange}
            />
          </div>
        </div>
      )}

      <div
        className={
          isLiveCameraMode
            ? 'relative z-[60] shrink-0 bg-transparent px-5 pb-[max(1rem,var(--app-composer-bottom-inset))] pt-2 pointer-events-auto'
            : 'sticky bottom-0 left-0 right-0 z-40 shrink-0 bg-slate-950/95 px-5 pb-[max(1.25rem,var(--app-composer-bottom-inset))] pt-4 backdrop-blur-md'
        }
      >
        {/*
          Match mode-chip button semantics (type=button + onClick). Cap/WK AX activates
          those reliably; form submit did not fire CREATE_ROOM_CLICKED on device.
          Native capture listeners are attached via launchBtnRef.
        */}
        <button
          ref={launchBtnRef}
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleCreate('user');
          }}
          aria-label="live-go-live-launch"
          data-testid="live-go-live-launch"
          data-live-qa-launch={launchLabel}
          data-live-qa-launch-enabled={canLaunch && !launching && goLiveCountdown === null ? '1' : '0'}
          data-live-qa-transition={launchTransition}
          className={`mb-3 w-full rounded-2xl py-4 text-sm font-black uppercase tracking-widest shadow-2xl transition-all active:scale-[0.98] ${
            !canLaunch || launching || goLiveCountdown !== null
              ? 'cursor-not-allowed bg-slate-800 text-slate-600 opacity-50'
              : 'border border-white/10 bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-500'
          }`}
        >
          {launchLabel}
        </button>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Mode
            </label>
          </div>
          <div className="grid grid-cols-8 gap-x-0.5 gap-y-0 sm:gap-x-1.5">
            {modes.map((m) => {
              const Icon = m.icon;
              const selected = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleModeSelect(m.id);
                  }}
                  title={m.label}
                  aria-label={m.id === 'Solo-Live' ? 'go-live-solo-option' : `go-live-mode-${m.id}`}
                  aria-pressed={selected}
                  data-live-qa-mode-option={m.id}
                  className="flex min-w-0 flex-col items-center gap-1"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95 sm:h-11 sm:w-11 sm:rounded-2xl ${
                      selected
                        ? 'border-indigo-500 bg-indigo-600/25 text-indigo-100 shadow-[0_0_16px_rgba(99,102,241,0.3)]'
                        : 'border-white/10 bg-slate-900 text-slate-500 hover:border-white/20 hover:text-slate-300'
                    }`}
                  >
                    <Icon size={17} strokeWidth={2.25} />
                  </span>
                  <span
                    className={`w-full truncate text-center text-[7px] font-bold uppercase tracking-wide sm:text-[9px] ${
                      selected ? 'text-indigo-200' : 'text-slate-500'
                    }`}
                  >
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CreateRoom;
