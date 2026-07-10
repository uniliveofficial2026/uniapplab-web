import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, Globe, Lock, Music2, Radio, MessageSquare, Users2, Video, ShoppingBag, Swords, Gamepad2 } from 'lucide-react';
import { CreateRoomModePreview } from '../components/CreateRoomModePreview';
import { CreateRoomSeatMockup } from '../components/CreateRoomSeatMockup';
import { useNavigate } from 'react-router-dom';
import { useRoomSettingsNavigateBack } from '../context/RoomFlowContext';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { getProfileDisplayName } from '../../lib/profileDisplay';
import { saveRoomSettings, type RoomMode } from '../utils/storage';
import { assignOwnerToSettings } from '../utils/roomRoleUsers';
import { roomPrivacyPatch, validateRoomKeyInput, MAX_ROOM_KEY_LENGTH, MIN_ROOM_KEY_LENGTH } from '../utils/roomPrivacy';
import { upsertManagedRoom } from '../utils/managedRooms';
import { initRoomExp } from '../utils/roomExp';
import { initRoomGifts } from '../utils/roomGifts';
import { resolveLocalOwnerPartyRoomId, reconcileOwnerPartyRoomIdFromCloud, getStoredOwnerPartyRoomId, setStoredOwnerPartyRoomId } from '../utils/ownerPartyRoomId';
import { syncPartyRoomToCloud } from '../utils/syncPartyRoomCloud';
import { getRoomSettings } from '../utils/storage';
import { useAppCamera } from '../../contexts/AppCameraContext';

const MODE_LABELS: Record<string, string> = {
  Chat: 'Chat',
  Party: 'PK',
  Karaoke: 'Karaoke',
  Radio: 'Watch',
  'Game-Live': 'Game',
  'Multi-Guest': 'Multi',
  'Solo-Live': 'Solo',
  'Commerce-Live': 'Shop',
};

const CreateRoom = () => {
  const navigate = useNavigate();
  const navigateSettingsBack = useRoomSettingsNavigateBack();
  const currentUser = useCurrentUser();
  const hostDisplayName = getProfileDisplayName(currentUser, 'Host');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isAvailable: cameraAvailable, openCamera } = useAppCamera();
  
  const [roomName, setRoomName] = useState("");
  const [privacy, setPrivacy] = useState<"Public" | "Private">("Public");
  const [privateRoomKey, setPrivateRoomKey] = useState("");
  const [privateKeyError, setPrivateKeyError] = useState<string | null>(null);
  const [mode, setMode] = useState("Chat");
  const [previewFocused, setPreviewFocused] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [canonicalRoomId, setCanonicalRoomId] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromRoom = (roomId: string) => {
      setCanonicalRoomId(roomId);
      const settings = getRoomSettings(roomId);
      if (settings.roomName?.trim()) setRoomName(settings.roomName);
      if (settings.roomMode) setMode(String(settings.roomMode));
      if (settings.privacy === 'Private' || settings.privacy === 'Public') {
        setPrivacy(settings.privacy);
      }
    };

    const local =
      getStoredOwnerPartyRoomId(currentUser?.id) ??
      resolveLocalOwnerPartyRoomId(currentUser?.id);
    if (local) hydrateFromRoom(local);

    void reconcileOwnerPartyRoomIdFromCloud(currentUser?.id).then((cloudId) => {
      if (cancelled || !cloudId || cloudId === local) return;
      hydrateFromRoom(cloudId);
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

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

  const handleCreate = () => {
    if (!roomName.trim() || launching) {
      return;
    }

    if (privacy === 'Private') {
      const validation = validateRoomKeyInput(privateRoomKey);
      if (!validation.valid) {
        setPrivateKeyError(validation.message ?? 'Enter a valid room key.');
        return;
      }
    }
    setPrivateKeyError(null);
    setLaunching(true);

    try {
      const roomIdString =
        resolveLocalOwnerPartyRoomId(currentUser?.id, { createIfMissing: true }) ??
        canonicalRoomId;
      if (!roomIdString) {
        return;
      }

      const privacyPatch = roomPrivacyPatch(privacy, privateRoomKey);
      const ownerSettings = assignOwnerToSettings(
        {
          roomName,
          roomId: roomIdString,
          roomMode: mode as RoomMode,
          coverPhoto: coverPreview ?? 'Default',
          ...privacyPatch,
        },
        currentUser,
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
        name: roomName,
        roomMode: mode as RoomMode,
        role: 'owner',
        hostName: hostDisplayName,
      });

      localStorage.setItem('currentUserRole', 'owner');
      localStorage.setItem('activeRoomId', roomIdString);
      if (currentUser?.id) {
        setStoredOwnerPartyRoomId(currentUser.id, roomIdString);
      }

      navigate(`/room/${roomIdString}`);

      syncPartyRoomToCloud(roomIdString, currentUser?.id, {
        roomName,
        roomMode: mode as RoomMode,
        privacy,
        whoCanJoin: privacyPatch.whoCanJoin,
        coverPhoto: coverPreview ?? 'Default',
      });
      void reconcileOwnerPartyRoomIdFromCloud(currentUser?.id);
    } finally {
      setLaunching(false);
    }
  };

  const handleModeSelect = (modeId: string) => {
    setMode(modeId);
  };

  const openModePreview = () => {
    setPreviewFocused(true);
  };

  const handleHeaderBack = () => {
    if (previewFocused) {
      setPreviewFocused(false);
      return;
    }
    navigateSettingsBack();
  };

  const privateKeyValidation = validateRoomKeyInput(privateRoomKey);
  const canLaunch =
    roomName.trim().length > 0 &&
    (privacy === 'Public' || privateKeyValidation.valid);

  const modes = [
    { id: 'Chat', icon: MessageSquare, label: 'Chat' },
    { id: 'Radio', icon: Radio, label: 'Watch' },
    { id: 'Game-Live', icon: Gamepad2, label: 'Game' },
    { id: 'Karaoke', icon: Music2, label: 'Karaoke' },
    { id: 'Multi-Guest', icon: Users2, label: 'Multi' },
    { id: 'Solo-Live', icon: Video, label: 'Solo' },
    { id: 'Party', icon: Swords, label: 'PK' },
    { id: 'Commerce-Live', icon: ShoppingBag, label: 'Shop' },
  ] as const;

  const privacyOptions = [
    { id: 'Public' as const, icon: Globe, label: 'Public' },
    { id: 'Private' as const, icon: Lock, label: 'Private' },
  ];

  const modeLabel = MODE_LABELS[mode] ?? 'Room';

  return (
    <div className="h-full bg-slate-950 flex flex-col text-white font-sans">
      <header className="sticky top-0 z-20 flex items-center p-4">
        <button 
          onClick={handleHeaderBack}
          className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition"
          aria-label={previewFocused ? 'Back to room setup' : 'Go back'}
        >
          <ArrowLeft size={24} />
        </button>
        <div className="mr-10 flex min-w-0 flex-1 flex-col items-center gap-0.5">
          <h1 className="text-center font-black text-lg tracking-tight uppercase">
            {previewFocused ? `${modeLabel} preview` : canonicalRoomId ? 'Your Room' : 'Create Room'}
          </h1>
          {previewFocused ? (
            <p className="max-w-full px-1 text-center text-[10px] font-semibold leading-snug text-indigo-300/90 sm:text-[11px]">
              Demo layout only — tap back to name your room and open it
            </p>
          ) : canonicalRoomId ? (
            <p className="max-w-full px-1 text-center text-[10px] font-semibold leading-snug text-blue-300/90 sm:text-[11px]">
              Your permanent room ID is{' '}
              <span className="font-mono text-blue-200">ID:{canonicalRoomId}</span>
              {' '}— it stays the same when you change mode.
            </p>
          ) : null}
        </div>
      </header>

      {previewFocused ? (
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-1">
          <CreateRoomModePreview mode={mode} fill />
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
                  className={`relative h-20 w-20 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all group ${
                    coverPreview
                      ? 'border-transparent'
                      : 'border-slate-700 hover:border-blue-500 bg-slate-950'
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
                      <Camera size={22} className="text-slate-500 group-hover:text-blue-400 transition" />
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
                  Room Name
                </label>
                <input
                  id="create-room-name"
                  type="text"
                  placeholder="What's the vibe?"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="h-20 w-full rounded-2xl border border-white/5 bg-slate-950 px-4 text-sm font-medium text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
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

            <CreateRoomSeatMockup mode={mode} />
          </div>
        </div>
      )}

      <div className="sticky bottom-0 left-0 right-0 z-30 px-5 pb-5 pt-4">
        <section className="mb-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Mode
            </label>
            {!previewFocused ? (
              <button
                type="button"
                onClick={openModePreview}
                className="rounded-full border border-indigo-400/35 bg-indigo-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-200 transition hover:bg-indigo-500/25"
              >
                Preview {modeLabel}
              </button>
            ) : null}
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

        {!previewFocused ? (
          <button
            onClick={handleCreate}
            disabled={!canLaunch || launching}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-[0.98] ${
              !canLaunch || launching
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50' 
                : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20 border border-white/10'
            }`}
          >
            {launching ? 'Opening…' : canonicalRoomId ? 'Open Room' : 'Launch Room'}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default CreateRoom;
