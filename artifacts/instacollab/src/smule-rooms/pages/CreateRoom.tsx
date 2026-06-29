import React, { useState, useRef } from 'react';
import { ArrowLeft, Camera, Globe, Lock, Music2, Radio, MessageSquare, Users2, CheckCircle2 } from 'lucide-react';
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

const CreateRoom = () => {
  const navigate = useNavigate();
  const navigateSettingsBack = useRoomSettingsNavigateBack();
  const currentUser = useCurrentUser();
  const hostDisplayName = getProfileDisplayName(currentUser, 'Host');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [roomName, setRoomName] = useState("");
  const [privacy, setPrivacy] = useState<"Public" | "Private">("Public");
  const [privateRoomKey, setPrivateRoomKey] = useState("");
  const [privateKeyError, setPrivateKeyError] = useState<string | null>(null);
  const [mode, setMode] = useState("Chat");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const handleImageClick = () => {
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
    if (!roomName.trim()) {
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

    // Generate a unique ID for the new room
    const newRoomId = Math.floor(1000000 + Math.random() * 9000000);
    
    // Save settings
    const roomIdString = newRoomId.toString();
    const privacyPatch = roomPrivacyPatch(privacy, privateRoomKey);
    saveRoomSettings(roomIdString, {
      ...assignOwnerToSettings(
        {
          roomName,
          roomId: roomIdString,
          roomMode: mode as RoomMode,
          coverPhoto: coverPreview ?? 'Default',
          ...privacyPatch,
        },
        currentUser,
      ),
    });

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
    
    // Set identity as Host/Owner
    localStorage.setItem('currentUserRole', 'owner');
    localStorage.setItem('activeRoomId', roomIdString);

    navigate(`/room/${newRoomId}`);
  };

  const privateKeyValidation = validateRoomKeyInput(privateRoomKey);
  const canLaunch =
    roomName.trim().length > 0 &&
    (privacy === 'Public' || privateKeyValidation.valid);

  const modes = [
    { id: 'Chat', icon: <MessageSquare size={18} />, label: 'Chat', desc: 'Classic Party Layout' },
    { id: 'Radio', icon: <Radio size={18} />, label: 'Watch Together', desc: 'Broadcast audio & video' },
    { id: 'Karaoke', icon: <Music2 size={18} />, label: 'Karaoke', desc: 'New Chorus Layout' },
    { id: 'Multi-Guest', icon: <Users2 size={18} />, label: 'Multi-Guest', desc: 'Up to 12 guests' },
  ];

  return (
    <div className="h-full bg-slate-950 flex flex-col text-white font-sans">
      {/* Header */}
      <header className="p-4 flex items-center bg-slate-950/80 backdrop-blur-md sticky top-0 z-20 border-b border-white/5">
        <button 
          onClick={navigateSettingsBack} 
          className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="flex-1 text-center font-black text-lg tracking-tight uppercase mr-10">Create Room</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-hide pb-32">
        {/* 1. Room Cover */}
        <section className="flex flex-col items-center">
          <div 
            onClick={handleImageClick}
            className={`w-32 h-32 rounded-[32px] border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer group relative overflow-hidden ${
              coverPreview ? 'border-transparent' : 'border-slate-800 hover:border-blue-500 bg-slate-900 shadow-xl'
            }`}
          >
            {coverPreview ? (
              <>
                <img src={coverPreview} className="w-full h-full object-cover" alt="Cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <Camera size={24} />
                </div>
              </>
            ) : (
              <>
                <Camera size={32} className="text-slate-600 mb-1 group-hover:text-blue-500 group-hover:scale-110 transition" />
                <span className="text-[10px] font-black uppercase text-slate-500 group-hover:text-blue-400">Add Cover</span>
              </>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*"
          />
        </section>

        {/* 2. Room Name */}
        <section className="space-y-3">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Room Name</label>
          <input 
            type="text" 
            placeholder="What's the vibe?"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-600"
          />
        </section>

        {/* 3. Privacy */}
        <section className="space-y-3">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Privacy Level</label>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => {
                setPrivacy("Public");
                setPrivateKeyError(null);
              }}
              className={`relative overflow-hidden group p-4 rounded-2xl border transition-all ${
                privacy === 'Public' 
                  ? 'bg-blue-600/10 border-blue-500 text-blue-400' 
                  : 'bg-slate-900 border-white/5 text-slate-500 grayscale'
              }`}
            >
              <Globe size={20} className={`mb-2 transition ${privacy === 'Public' ? 'scale-110' : ''}`} />
              <div className="text-sm font-black text-left">Public</div>
              <div className="text-[10px] opacity-60 text-left">Everyone can join</div>
              {privacy === 'Public' && <CheckCircle2 size={16} className="absolute top-3 right-3 text-blue-500" />}
            </button>
            <button 
              onClick={() => {
                setPrivacy("Private");
                setPrivateKeyError(null);
              }}
              className={`relative overflow-hidden group p-4 rounded-2xl border transition-all ${
                privacy === 'Private' 
                  ? 'bg-amber-600/10 border-amber-500 text-amber-400' 
                  : 'bg-slate-900 border-white/5 text-slate-500 grayscale'
              }`}
            >
              <Lock size={20} className={`mb-2 transition ${privacy === 'Private' ? 'scale-110' : ''}`} />
              <div className="text-sm font-black text-left">Private</div>
              <div className="text-[10px] opacity-60 text-left">Key required to enter</div>
              {privacy === 'Private' && <CheckCircle2 size={16} className="absolute top-3 right-3 text-amber-500" />}
            </button>
          </div>
          {privacy === 'Private' ? (
            <div className="space-y-2 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/90">
                Room Key
              </label>
              <input
                type="text"
                value={privateRoomKey}
                onChange={(event) => {
                  setPrivateRoomKey(event.target.value);
                  if (privateKeyError) setPrivateKeyError(null);
                }}
                placeholder={`Choose a key (${MIN_ROOM_KEY_LENGTH}-${MAX_ROOM_KEY_LENGTH} characters)`}
                maxLength={MAX_ROOM_KEY_LENGTH}
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-amber-500/50"
              />
              <p className="text-[10px] leading-relaxed text-slate-400">
                You choose the key. It stays the same until you change it in room settings.
              </p>
              {privateKeyError ? (
                <p className="text-xs font-medium text-red-400">{privateKeyError}</p>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* 4. Room Mode */}
        <section className="space-y-3">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Select Mode</label>
          <div className="grid grid-cols-2 gap-3">
            {modes.map((m) => (
              <button 
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`p-4 rounded-2xl border transition-all flex flex-col items-start ${
                  mode === m.id 
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-100' 
                    : 'bg-slate-900 border-white/5 text-slate-500'
                }`}
              >
                <div className={`p-2 rounded-xl mb-3 transition-colors ${mode === m.id ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                  {m.icon}
                </div>
                <div className="text-xs font-black uppercase tracking-wider">{m.label}</div>
                <div className="text-[9px] opacity-50 font-medium">{m.desc}</div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Action Footer */}
      <div className="sticky bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pt-10 z-30">
        <button 
          onClick={handleCreate}
          disabled={!canLaunch}
          className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-[0.98] ${
            !canLaunch
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50' 
              : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20 border border-white/10'
          }`}
        >
          Launch Room
        </button>
      </div>
    </div>
  );
};

export default CreateRoom;
