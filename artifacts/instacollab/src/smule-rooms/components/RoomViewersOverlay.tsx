import React from "react";
import { isRoomAdminOrOwner, isRoomOwner, type RoomMemberRole } from '../utils/roles';
import { useRoomSelf } from '../context/RoomSelfContext';
import { isRoomSelfName, isRoomSelfGuest } from '../utils/selfIdentity';
import { X, Eye, UserPlus, Shield, ShieldAlert, Crown, UserX } from "lucide-react";

interface Viewer {
  id: string;
  name: string;
  avatar: string;
  isFollowing: boolean;
  isAdmin: boolean;
  isCoOwner?: boolean;
  isOwner?: boolean;
}

interface RoomViewersOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  viewers: Viewer[];
  currentUserRole: RoomMemberRole;
  onToggleAdmin: (viewerId: string) => void;
  onToggleCoOwner?: (viewerId: string) => void;
  onToggleFollow?: (viewerId: string) => void;
  onSelectViewer?: (viewer: Viewer) => void;
  onKickUser?: (viewerId: string, viewerName: string) => void;
}

export function RoomViewersOverlay({ isOpen, onClose, viewers, currentUserRole, onToggleAdmin, onToggleCoOwner, onToggleFollow, onSelectViewer, onKickUser }: RoomViewersOverlayProps) {
  const self = useRoomSelf();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex flex-col justify-end pointer-events-auto">
      <div className="bg-[#1a0f2e] w-full max-h-[75vh] rounded-t-3xl border-t border-purple-500/30 flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(168,85,247,0.15)] animate-fade-in-up">
        {/* Header */}
        <div className="flex justify-between items-center px-5 sm:px-6 py-4 sm:py-5 border-b border-white/5">
          <div className="flex items-center space-x-2.5">
            <Eye size={22} className="text-purple-400" />
            <h2 className="text-base sm:text-lg font-bold text-gray-100 uppercase tracking-widest textShadow">Room Viewers</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition active:scale-95">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-3.5 border-b border-white/5 bg-white/5">
          <span className="text-sm sm:text-base text-gray-200 font-semibold">Total Viewers: {viewers.length + 339}</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-2.5 pb-10 scrollbar-hide mt-1">
          {viewers.map(viewer => {
            const isSelfViewer =
              viewer.id === self.id ||
              isRoomSelfName(viewer.name, self) ||
              isRoomSelfGuest({ userId: viewer.id, name: viewer.name }, self);

            return (
            <div key={viewer.id} className="flex justify-between items-center bg-black/40 border border-white/5 rounded-2xl p-3.5 sm:p-4 animate-fade-in">
              <div 
                className="flex items-center space-x-3.5 cursor-pointer hover:opacity-90 group min-w-0"
                onClick={() => onSelectViewer?.(viewer)}
              >
                <img src={viewer.avatar} alt={viewer.name} className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-purple-500/50 group-hover:scale-105 transition-transform shrink-0" />
                <div className="flex flex-col space-y-1 min-w-0">
                  <div className="flex items-center space-x-1">
                    <h3 className="text-sm sm:text-base font-bold text-gray-100 truncate group-hover:text-purple-300 transition-colors">{viewer.name}</h3>
                  </div>
                  <div className="flex items-center space-x-1">
                    {viewer.isOwner && (
                      <span className="bg-gradient-to-r from-purple-600 to-pink-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center space-x-0.5 shadow-sm shadow-purple-500/20">
                        <Crown size={8} /> <span>Owner</span>
                      </span>
                    )}
                    {viewer.isCoOwner && (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center space-x-0.5 shadow-sm shadow-amber-500/10">
                        <Crown size={8} /> <span>Co-owner</span>
                      </span>
                    )}
                    {viewer.isAdmin && (
                      <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center space-x-0.5 shadow-sm shadow-yellow-500/10">
                        <Shield size={8} /> <span>Admin</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {isRoomOwner(currentUserRole) && !viewer.isOwner && !isSelfViewer && (
                  <button
                    className={`p-1.5 rounded-full transition active:scale-95 ${
                      viewer.isCoOwner
                        ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                        : 'bg-white/5 text-gray-400 hover:text-amber-200 hover:bg-white/10'
                    }`}
                    onClick={() => onToggleCoOwner?.(viewer.id)}
                    title={viewer.isCoOwner ? 'Revoke Co-owner' : 'Make Co-owner'}
                  >
                    <Crown size={14} />
                  </button>
                )}
                {isRoomOwner(currentUserRole) && (
                  <button
                    className={`p-1.5 rounded-full transition active:scale-95 ${
                      viewer.isAdmin ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    onClick={() => onToggleAdmin(viewer.id)}
                    title={viewer.isAdmin ? "Revoke Admin" : "Make Admin"}
                  >
                    {viewer.isAdmin ? <ShieldAlert size={14} /> : <Shield size={14} />}
                  </button>
                )}
                
                {/* Kick Button */}
                {((isRoomOwner(currentUserRole) && !isRoomSelfName(viewer.name, self)) ||
                  (currentUserRole === 'admin' && !isRoomSelfName(viewer.name, self) && !viewer.isOwner && !viewer.isCoOwner && !viewer.isAdmin)) && (
                  <button
                    className="p-1.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition active:scale-95 duration-200 cursor-pointer"
                    onClick={() => onKickUser?.(viewer.id, viewer.name)}
                    title={`Kick ${viewer.name}`}
                  >
                    <UserX size={14} />
                  </button>
                )}

                {!isSelfViewer ? (
                <button 
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center space-x-1 transition active:scale-95 cursor-pointer ${
                    viewer.isFollowing 
                    ? 'bg-white/10 text-gray-300 border border-white/10' 
                    : 'bg-[#FF3B70] text-white hover:bg-pink-400'
                  }`}
                  onClick={() => onToggleFollow?.(viewer.id)}
                >
                  {!viewer.isFollowing && <UserPlus size={10} />}
                  <span>{viewer.isFollowing ? 'Following' : 'Follow'}</span>
                </button>
                ) : null}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
