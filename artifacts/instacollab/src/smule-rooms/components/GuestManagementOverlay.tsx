import React, { useMemo, useState } from "react";
import { isRoomAdminOrOwner, type RoomMemberRole } from '../utils/roles';
import { sortGuestRequestsByPriority } from '../utils/roomJoinPolicy';
import { useRoomSelf } from '../context/RoomSelfContext';
import { isRoomSelfName } from '../utils/selfIdentity';
import {
  formatGuestSeatNumber,
  formatStaffSeatLabel,
  getGuestSeatKeysForRoomMode,
  guestSeatGridClass,
  type PartySeatMap,
  type RoomSeatKey,
} from '../utils/roomSeats';
import { X, Users, Mic, MicOff, Crown, Shield, UserMinus, Check, AlertCircle, Settings, Lock, Unlock, Sofa, Sparkles } from "lucide-react";

interface Guest {
  userId?: string;
  name: string;
  avatar: string;
  stars: number;
  isSpeaking: boolean;
  frameStyle: string;
  isAdminMuted?: boolean;
}

interface GuestRequest {
  id: string;
  userId?: string;
  name: string;
  avatar: string;
  isElite?: boolean;
}

interface GuestManagementOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  activeSeats: PartySeatMap;
  onRemoveGuest: (seatKey: string) => void;
  onMuteGuest: (seatKey: string) => void;
  guestRequests: GuestRequest[];
  onAcceptRequest: (reqId: string) => void;
  onDeclineRequest: (reqId: string) => void;
  currentUserRole: RoomMemberRole;
  isAllGuestMuted: boolean;
  onToggleAllMics: () => void;
  joinWithoutRequest: boolean;
  onToggleJoinMode: () => void;
  lockedSeats: Record<string, boolean>;
  onToggleSeatLock: (seatKey: string) => void;
  isUserSeated?: boolean;
  onJoinSeat?: (seatKey: string) => void;
  hasPendingJoinRequest?: boolean;
  whoCanJoin?: string;
  whoCanBeSeated?: string;
  roomPriority?: string;
  joinPolicySummary?: string;
  guestSeatKeys?: RoomSeatKey[];
}

export function GuestManagementOverlay({ 
  isOpen, onClose, activeSeats, onRemoveGuest, onMuteGuest, 
  guestRequests, onAcceptRequest, onDeclineRequest,
  currentUserRole, isAllGuestMuted, onToggleAllMics,
  joinWithoutRequest, onToggleJoinMode, lockedSeats, onToggleSeatLock,
  isUserSeated = true, onJoinSeat, hasPendingJoinRequest = false,
  whoCanJoin = 'Anyone', whoCanBeSeated = 'Anyone', roomPriority = 'NO',
  joinPolicySummary,
  guestSeatKeys: guestSeatKeysProp,
}: GuestManagementOverlayProps) {
  const self = useRoomSelf();
  const [activeTab, setActiveTab] = useState<"seated" | "requests" | "settings">("seated");
  const guestSeatKeys = guestSeatKeysProp ?? getGuestSeatKeysForRoomMode('Party');
  const joinSeatGridClass = guestSeatGridClass(guestSeatKeys.length);
  const seatedGuests = useMemo(
    () =>
      Object.entries(activeSeats).filter(([seatKey, guest]) => {
        if (!guest) return false;
        if (seatKey === 'host' || seatKey === 'coowner' || seatKey === 'admin') return true;
        return guestSeatKeys.includes(seatKey as RoomSeatKey);
      }),
    [activeSeats, guestSeatKeys],
  );
  const sortedGuestRequests = useMemo(
    () => sortGuestRequestsByPriority(guestRequests, roomPriority),
    [guestRequests, roomPriority],
  );
  
  if (!isOpen) return null;

  const isAdminOrHost = isRoomAdminOrOwner(currentUserRole);

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex flex-col justify-end pointer-events-auto">
      <div className="bg-[#1a0f2e] w-full max-h-[70vh] rounded-t-3xl border-t border-purple-500/30 flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(168,85,247,0.15)] animate-fade-in-up">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/5">
          <div className="flex items-center space-x-2">
            <Users size={20} className="text-purple-400" />
            <h2 className="text-sm font-bold text-gray-100 uppercase tracking-widest textShadow">Guest Management</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition active:scale-95">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          <button 
            className={`flex-1 py-3 text-xs font-bold transition ${activeTab === 'seated' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500'}`}
            onClick={() => setActiveTab('seated')}
          >
            Seated
          </button>
          <button 
            className={`flex-1 py-3 text-xs font-bold transition flex justify-center items-center space-x-1 ${activeTab === 'requests' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500'}`}
            onClick={() => setActiveTab('requests')}
          >
            <span>Requests</span>
            {guestRequests.length > 0 && (
              <span className="bg-red-500 text-white text-[9px] px-1.5 rounded-full">{guestRequests.length}</span>
            )}
          </button>
          {isAdminOrHost && (
            <button 
              className={`flex-1 py-3 text-xs font-bold transition flex justify-center items-center space-x-1.5 ${activeTab === 'settings' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500'}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={13} />
              <span>Room Rules</span>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 pb-8 scrollbar-hide">
          {activeTab === 'seated' && (
            <>
              {!isUserSeated && onJoinSeat && (
                <div className="bg-purple-950/20 border border-purple-500/20 rounded-2xl p-3.5 mb-2.5 animate-fade-in">
                  <div className="flex items-center space-x-2 mb-2">
                    <Sofa size={14} className="text-purple-400" />
                    <h3 className="text-xs font-bold text-gray-200">Join a Seat</h3>
                  </div>
                  {hasPendingJoinRequest ? (
                    <p className="text-[10px] text-purple-300 flex items-center gap-1.5">
                      <AlertCircle size={12} />
                      Your join request is pending host approval.
                    </p>
                  ) : (
                    <>
                      <p className="text-[10px] text-gray-500 mb-2.5">
                        {joinWithoutRequest || isAdminOrHost
                          ? "Tap an open guest seat to sit down."
                          : "Tap a seat to send a join request."}
                      </p>
                      <div className={`grid ${joinSeatGridClass} gap-1.5`}>
                        {guestSeatKeys.map((seatKey) => {
                          const seatNumber = formatGuestSeatNumber(seatKey);
                          const isOccupied = activeSeats[seatKey] !== null;
                          const isLocked = lockedSeats[seatKey] || false;
                          const isDisabled = isOccupied || isLocked;

                          return (
                            <button
                              key={seatKey}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => onJoinSeat(seatKey)}
                              className={`rounded-xl py-2 text-[11px] font-bold border transition active:scale-95 flex flex-col items-center justify-center gap-0.5 ${
                                isDisabled
                                  ? "bg-black/20 border-white/5 text-gray-600 cursor-not-allowed"
                                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                              }`}
                              title={
                                isLocked
                                  ? `Seat ${seatNumber} is locked`
                                  : isOccupied
                                    ? `Seat ${seatNumber} is taken`
                                    : `Join seat ${seatNumber}`
                              }
                            >
                              {isLocked ? <Lock size={11} /> : <span>{seatNumber}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Mute/Unmute All Mics for Hosts and Admins inside Guest Management */}
              {isAdminOrHost && (
                <div className="flex justify-between items-center bg-purple-950/20 border border-purple-500/20 rounded-2xl p-3.5 mb-2.5">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                      <Mic size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-gray-200">All Guest Mics</h3>
                      <p className="text-[10px] text-gray-500">Mute/Unmute all active guest seats</p>
                    </div>
                  </div>
                  <button 
                    onClick={onToggleAllMics}
                    className={`flex items-center space-x-1.5 text-xs font-black px-4 py-2 rounded-full border transition active:scale-95 cursor-pointer duration-150 ${
                      isAllGuestMuted 
                        ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.2)]" 
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                    }`}
                  >
                    {isAllGuestMuted ? <MicOff size={11} /> : <Mic size={11} />}
                    <span>{isAllGuestMuted ? "Unmute All" : "Mute All"}</span>
                  </button>
                </div>
              )}

              {seatedGuests.map(([seatKey, guest]) => {
                const isHost = seatKey === "host";
                const isCoOwner = seatKey === "coowner";
                const isAdminSeat = seatKey === "admin";
                if (!guest) return null;

                const isSelf = isRoomSelfName(guest.name, self);
                const canMute = isSelf || isAdminOrHost;
                const canRemove = !isHost && isAdminOrHost;

                return (
                  <div key={seatKey} className="flex justify-between items-center bg-black/40 border border-white/5 rounded-2xl p-3 animate-fade-in">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <img src={guest.avatar} alt={guest.name} className="w-10 h-10 rounded-full object-cover border border-purple-500/50" />
                        {isHost && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                            <Crown size={12} className="text-yellow-400 fill-yellow-400 drop-shadow-[0_0_2px_#eab308]" />
                          </div>
                        )}
                        {isCoOwner && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                            <Crown size={12} className="text-amber-400 fill-amber-400 drop-shadow-[0_0_2px_#f59e0b]" />
                          </div>
                        )}
                        {isAdminSeat && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                            <Shield size={12} className="text-violet-400 drop-shadow-[0_0_2px_#a855f7]" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-gray-100 max-w-[120px] truncate">{guest.name}</h3>
                        <p className="text-[10px] text-gray-500">
                          {isHost ? "Host Room" : isCoOwner ? "Co-owner" : isAdminSeat ? (formatStaffSeatLabel('admin') ?? 'Boss') : `Seat ${formatGuestSeatNumber(seatKey)}`}
                          {guest.isAdminMuted && (
                            <span className="text-red-400 font-medium ml-1.5 inline-flex items-center">
                              <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full mr-1 animate-pulse" />
                              Muted by Room Admin
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {canMute ? (
                        <button 
                          onClick={() => onMuteGuest(seatKey)}
                          className={`w-8 h-8 rounded-full border transition active:scale-95 flex flex-col items-center justify-center duration-150 ${
                            guest.isSpeaking 
                              ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20" 
                              : "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                          }`}
                          title={guest.isSpeaking ? "Mute Microphone" : "Unmute Microphone"}
                        >
                          {guest.isSpeaking ? <Mic size={14} /> : <MicOff size={14} />}
                        </button>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-gray-600 cursor-default" title="Locked">
                          {guest.isSpeaking ? <Mic size={14} /> : <MicOff size={14} />}
                        </div>
                      )}
                      
                      {canRemove && (
                        <button 
                          onClick={() => onRemoveGuest(seatKey)}
                          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:border-red-400/50 hover:bg-red-500/20 flex flex-col items-center justify-center text-gray-400 hover:text-red-400 transition active:scale-95"
                          title="Remove from seat"
                        >
                          <UserMinus size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {seatedGuests.length === 0 && (
                <div className="text-center text-gray-500 py-10 text-sm">
                  No guests are currently seated.
                </div>
              )}
            </>
          )}

          {activeTab === 'requests' && (
            <>
              {/* Request instructions warning for normal users */}
              {!isAdminOrHost && (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3.5 mb-2.5 flex items-start space-x-2.5">
                  <AlertCircle size={15} className="text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-[10.5px] text-amber-300/80 leading-normal">
                    You are in guest mode. Only **Room Owners and Admins** have permissions to accept or decline guest requests.
                  </p>
                </div>
              )}

              {guestRequests.length === 0 ? (
                <div className="text-center text-gray-500 py-10 text-sm flex flex-col items-center">
                  <AlertCircle size={24} className="mb-2 opacity-50" />
                  <p>No new requests.</p>
                </div>
              ) : (
                sortedGuestRequests.map(req => (
                  <div key={req.id} className="flex justify-between items-center bg-black/40 border border-white/5 rounded-2xl p-3 animate-fade-in">
                    <div className="flex items-center space-x-3">
                      <img src={req.avatar} alt={req.name} className="w-10 h-10 rounded-full object-cover border border-gray-600" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-bold text-gray-100 max-w-[120px] truncate">{req.name}</h3>
                          {req.isElite ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
                              <Sparkles size={9} /> Elite
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[10px] text-gray-500">Wants to join</p>
                      </div>
                    </div>

                    {isAdminOrHost ? (
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => onDeclineRequest(req.id)}
                          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:border-red-400/50 hover:bg-red-500/20 flex flex-col items-center justify-center text-gray-400 hover:text-red-400 transition active:scale-95"
                          title="Decline"
                        >
                          <X size={14} />
                        </button>
                        <button 
                          onClick={() => onAcceptRequest(req.id)}
                          className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/50 flex flex-col items-center justify-center text-purple-200 hover:bg-purple-600/55 transition active:scale-95"
                          title="Accept"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-white/5 px-2.5 py-1 rounded-full">
                        Pending
                      </span>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'settings' && isAdminOrHost && (
            <div className="space-y-4 py-1 animate-fade-in">
              <div className="rounded-2xl border border-purple-500/20 bg-purple-950/20 p-4">
                <h3 className="text-xs font-bold text-purple-200">Saved room rules</h3>
                <p className="mt-1 text-[10px] leading-relaxed text-gray-400">
                  {joinPolicySummary ?? `Join: ${whoCanJoin} · Seats: ${whoCanBeSeated}`}
                </p>
                <p className="mt-2 text-[10px] text-gray-500">
                  Edit Room settings sync here. Quick toggle below updates who can be seated.
                </p>
              </div>

              {/* Join mode configuration box */}
              <div className="bg-black/30 border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-bold text-gray-100">Guest Seats Entry Policy</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">Control how audience members join empty seats</p>
                  </div>
                  <button 
                    onClick={onToggleJoinMode}
                    className={`text-xs font-black px-4 py-2 rounded-full border transition active:scale-95 duration-150 cursor-pointer ${
                      joinWithoutRequest 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                        : "bg-purple-500/10 border-purple-500/30 text-purple-400"
                    }`}
                  >
                    {joinWithoutRequest ? "Freely Join (No Request)" : "Require Request Approval"}
                  </button>
                </div>
              </div>

              {/* Seats Locking List */}
              <div className="bg-[#10091d]/85 border border-purple-950/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <Lock size={14} className="text-purple-400" />
                  <h3 className="text-xs font-black text-gray-100 uppercase tracking-widest">Lock Guest Seats</h3>
                </div>
                <p className="text-[10px] text-gray-500">Lock individual seats to prevent any users from sitting on them.</p>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  {guestSeatKeys.map((seatKey) => {
                    const sNum = formatGuestSeatNumber(seatKey);
                    const isLocked = lockedSeats[seatKey] || false;
                    const isSeated = activeSeats[seatKey] !== null;

                    return (
                      <div 
                        key={seatKey} 
                        className={`flex justify-between items-center rounded-xl p-2.5 border transition-all duration-150 ${
                          isLocked 
                            ? "bg-red-500/5 border-red-500/20 text-red-300"
                            : "bg-black/20 border-white/5 text-gray-300"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          {isLocked ? <Lock size={11} className="text-red-400" /> : <Unlock size={11} className="text-gray-500" />}
                          <span className="text-[11px] font-bold">Seat {sNum}</span>
                        </div>
                        
                        <button
                          onClick={() => onToggleSeatLock(seatKey)}
                          className={`text-[10px] font-black px-2.5 py-1 rounded-lg border transition active:scale-95 cursor-pointer flex items-center space-x-1 ${
                            isLocked 
                              ? "bg-red-600/20 border-red-500/30 text-red-400 hover:bg-red-600/30" 
                              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                          }`}
                        >
                          {isLocked ? (
                            <>
                              <Unlock size={10} />
                              <span>Unlock</span>
                            </>
                          ) : (
                            <>
                              <Lock size={10} />
                              <span>Lock</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

