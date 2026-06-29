import React from 'react';
import { Users, Plus, ArrowLeft, X, Play, Music, Search, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { User, ChatGroup, ChatMessage } from '../../types';
import { handleAvatarError, handleMediaError } from '../../lib/utils';
import { PLAYBACK_SCOPE } from '../../lib/playbackScope';
import { ChatInlineVideo } from './ChatInlineVideo';
import type { FullscreenMediaState } from './messages/types';

export type MessagesScreenOverlaysProps = {
  currentUser: User;
  selectedUser: User | ChatGroup | null;
  selectedGroup: ChatGroup | null;
  selectedGroupAdminSet: Set<string>;
  showNewMessageModal: boolean;
  setShowNewMessageModal: (open: boolean) => void;
  newMessageSearchQuery: string;
  setNewMessageSearchQuery: (query: string) => void;
  filteredNewMessageUsers: User[];
  setSelectedChatId: (chatId: string | null) => void;
  showNewGroupModal: boolean;
  setShowNewGroupModal: (open: boolean) => void;
  resetNewGroupForm: () => void;
  newGroupName: string;
  setNewGroupName: (name: string) => void;
  newGroupSearchQuery: string;
  setNewGroupSearchQuery: (query: string) => void;
  newGroupAvatar: string;
  groupAvatarInputRef: React.RefObject<HTMLInputElement | null>;
  handleGroupAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  selectedGroupMemberIds: string[];
  filteredNewGroupUsers: User[];
  toggleGroupMemberSelection: (userId: string) => void;
  onCreateGroup: () => void;
  showInfoPanel: boolean;
  setShowInfoPanel: (open: boolean) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  setShowGroupSettingsScreen: (open: boolean) => void;
  setShowPinnedMessagesScreen: (open: boolean) => void;
  pinnedMessages: ChatMessage[];
  chatWallpaper: string;
  setChatWallpaper: (id: string) => void;
  customWallpapers: Array<{ id: string; kind: 'image' | 'video'; value: string; label: string }>;
  wallpaperInputRef: React.RefObject<HTMLInputElement | null>;
  handleWallpaperUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  removeCustomWallpaper: (wallpaperId: string) => void;
  galleryItems: Array<{ url: string; isVideo: boolean; isAudio?: boolean }>;
  setShowGalleryScreen: (open: boolean) => void;
  handleLeaveGroup: () => void;
  handleDeleteGroup: () => void;
  showToast: (message: string) => void;
  blockUser: (userId: string) => boolean;
  showGroupSettingsScreen: boolean;
  setShowGroupModerationScreen: (open: boolean) => void;
  setShowGroupAddUsersScreen: (open: boolean) => void;
  groupSettingsAvatarInputRef: React.RefObject<HTMLInputElement | null>;
  handleGroupSettingsAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  groupNameDraft: string;
  setGroupNameDraft: (name: string) => void;
  handleSaveGroupName: () => void;
  groupManageSearchQuery: string;
  setGroupManageSearchQuery: (query: string) => void;
  filteredGroupMembers: User[];
  handleRemoveGroupMember: (memberId: string) => void;
  showGroupAddUsersScreen: boolean;
  groupAddUsersSearchQuery: string;
  setGroupAddUsersSearchQuery: (query: string) => void;
  filteredAddableGroupUsers: User[];
  handleAddGroupMember: (userId: string) => void;
  showGroupModerationScreen: boolean;
  groupModerationSearchQuery: string;
  setGroupModerationSearchQuery: (query: string) => void;
  filteredModerationMembers: User[];
  toggleGroupModerationSetting: (key: 'adminOnlyPosting' | 'requireApprovalToJoin') => void;
  toggleGroupAdminMember: (userId: string) => void;
  toggleMuteGroupMember: (userId: string) => void;
  showPinnedMessagesScreen: boolean;
  showPinnedSearch: boolean;
  setShowPinnedSearch: React.Dispatch<React.SetStateAction<boolean>>;
  pinnedSearchQuery: string;
  setPinnedSearchQuery: (query: string) => void;
  filteredPinnedMessages: ChatMessage[];
  jumpToOriginalMessage: (sourceMessageId?: string) => void;
  showGalleryScreen: boolean;
  showGallerySearch: boolean;
  setShowGallerySearch: React.Dispatch<React.SetStateAction<boolean>>;
  gallerySearchQuery: string;
  setGallerySearchQuery: (query: string) => void;
  filteredGalleryItems: Array<{ url: string; isVideo: boolean; isAudio?: boolean }>;
  tryOpenMediaFullscreen: (
    items: FullscreenMediaState['items'],
    mediaIndex: number,
    videoRefKey?: string
  ) => void;
  inlineVideoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>;
};

export function MessagesScreenOverlays(props: MessagesScreenOverlaysProps) {
  const {
    currentUser,
    selectedUser,
    selectedGroup,
    selectedGroupAdminSet,
    showNewMessageModal,
    setShowNewMessageModal,
    newMessageSearchQuery,
    setNewMessageSearchQuery,
    filteredNewMessageUsers,
    setSelectedChatId,
    showNewGroupModal,
    setShowNewGroupModal,
    resetNewGroupForm,
    newGroupName,
    setNewGroupName,
    newGroupSearchQuery,
    setNewGroupSearchQuery,
    newGroupAvatar,
    groupAvatarInputRef,
    handleGroupAvatarUpload,
    selectedGroupMemberIds,
    filteredNewGroupUsers,
    toggleGroupMemberSelection,
    onCreateGroup,
    showInfoPanel,
    setShowInfoPanel,
    isMuted,
    setIsMuted,
    setShowGroupSettingsScreen,
    setShowPinnedMessagesScreen,
    pinnedMessages,
    chatWallpaper,
    setChatWallpaper,
    customWallpapers,
    wallpaperInputRef,
    handleWallpaperUpload,
    removeCustomWallpaper,
    galleryItems,
    setShowGalleryScreen,
    handleLeaveGroup,
    handleDeleteGroup,
    showToast,
    blockUser,
    showGroupSettingsScreen,
    setShowGroupModerationScreen,
    setShowGroupAddUsersScreen,
    groupSettingsAvatarInputRef,
    handleGroupSettingsAvatarUpload,
    groupNameDraft,
    setGroupNameDraft,
    handleSaveGroupName,
    groupManageSearchQuery,
    setGroupManageSearchQuery,
    filteredGroupMembers,
    handleRemoveGroupMember,
    showGroupAddUsersScreen,
    groupAddUsersSearchQuery,
    setGroupAddUsersSearchQuery,
    filteredAddableGroupUsers,
    handleAddGroupMember,
    showGroupModerationScreen,
    groupModerationSearchQuery,
    setGroupModerationSearchQuery,
    filteredModerationMembers,
    toggleGroupModerationSetting,
    toggleGroupAdminMember,
    toggleMuteGroupMember,
    showPinnedMessagesScreen,
    showPinnedSearch,
    setShowPinnedSearch,
    pinnedSearchQuery,
    setPinnedSearchQuery,
    filteredPinnedMessages,
    jumpToOriginalMessage,
    showGalleryScreen,
    showGallerySearch,
    setShowGallerySearch,
    gallerySearchQuery,
    setGallerySearchQuery,
    filteredGalleryItems,
    tryOpenMediaFullscreen,
    inlineVideoRefs,
  } = props;

  return (
    <AnimatePresence>
        {showNewMessageModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background p-4">
            <div className="absolute inset-0" onClick={() => setShowNewMessageModal(false)}></div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background w-full max-w-[400px] h-[60vh] max-h-[500px] flex flex-col rounded-[24px] overflow-hidden shadow-2xl border border-border relative z-10">
              <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
                 <h2 className="font-bold text-lg">New Message</h2>
                 <button onClick={() => { setShowNewMessageModal(false); setNewMessageSearchQuery(''); }} className="hover:bg-background p-1.5 rounded-full"><Plus className="w-6 h-6 rotate-45" /></button>
              </div>
              <div className="p-4 border-b border-border">
                <input
                  type="text"
                  value={newMessageSearchQuery}
                  onChange={(e) => setNewMessageSearchQuery(e.target.value)}
                  placeholder="Filter by user name, @username, or ID..."
                  className="w-full bg-secondary outline-none px-4 py-2 rounded-xl text-sm font-medium"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                 {filteredNewMessageUsers.map(u => (
                   <div key={u.id} onClick={() => { setSelectedChatId(u.id); setShowNewMessageModal(false); setNewMessageSearchQuery(''); }} className="flex items-center gap-3 p-3 hover:bg-secondary/50 rounded-xl cursor-pointer transition-colors">
                     <img src={u.avatarUrl || undefined} alt="avatar" className="w-12 h-12 rounded-full border border-border" onError={handleAvatarError} />
                     <div className="flex flex-col">
                       <span className="font-bold text-[14px]">{u.displayName}</span>
                       <span className="text-xs text-muted-foreground">{u.username} · {u.id}</span>
                     </div>
                   </div>
                 ))}
                 {filteredNewMessageUsers.length === 0 && (
                   <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                     No users match this filter.
                   </div>
                 )}
              </div>
            </motion.div>
          </div>
        )}

        {showNewGroupModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background p-4">
            <div className="absolute inset-0" onClick={() => { setShowNewGroupModal(false); resetNewGroupForm(); }}></div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background w-full max-w-[400px] h-[72vh] max-h-[640px] flex flex-col rounded-[24px] overflow-hidden shadow-2xl border border-border relative z-10">
              <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
                 <h2 className="font-bold text-lg">Create Group</h2>
                 <button onClick={() => { setShowNewGroupModal(false); resetNewGroupForm(); }} className="hover:bg-background p-1.5 rounded-full"><Plus className="w-6 h-6 rotate-45" /></button>
              </div>
              <div className="p-4 border-b border-border flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <input
                    ref={groupAvatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleGroupAvatarUpload}
                  />
                  <button
                    type="button"
                    onClick={() => groupAvatarInputRef.current?.click()}
                    className="w-14 h-14 rounded-2xl border border-border overflow-hidden bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0"
                  >
                    {newGroupAvatar ? (
                      <img src={newGroupAvatar} alt="Group profile" className="w-full h-full object-cover" />
                    ) : (
                      'Profile'
                    )}
                  </button>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold">Group Profile</span>
                    <span className="text-xs text-muted-foreground truncate">Upload group photo</span>
                  </div>
                </div>
                <input 
                  type="text" 
                  value={newGroupName} 
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Group Name"
                  className="w-full bg-secondary outline-none px-4 py-3 rounded-xl text-sm font-medium" 
                />
                <input
                  type="text"
                  value={newGroupSearchQuery}
                  onChange={(e) => setNewGroupSearchQuery(e.target.value)}
                  placeholder="Search users by name, @username, or ID..."
                  className="w-full bg-secondary outline-none px-4 py-2.5 rounded-xl text-sm font-medium"
                />
                <div className="text-xs text-muted-foreground font-medium">
                  Selected members: {selectedGroupMemberIds.length}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {filteredNewGroupUsers.map((user) => {
                  const isSelected = selectedGroupMemberIds.includes(user.id);
                  return (
                    <button
                      key={`group-user-${user.id}`}
                      type="button"
                      onClick={() => toggleGroupMemberSelection(user.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors border ${isSelected ? 'bg-primary/10 border-primary/40' : 'hover:bg-secondary/50 border-transparent'}`}
                    >
                      <div className="w-11 h-11 rounded-full overflow-hidden border border-border shrink-0">
                        <img src={user.avatarUrl || undefined} alt={user.username} className="w-full h-full object-cover" onError={handleAvatarError} />
                      </div>
                      <div className="flex flex-col items-start min-w-0 flex-1">
                        <span className="font-bold text-[14px] truncate w-full text-left">{user.displayName}</span>
                        <span className="text-xs text-muted-foreground truncate w-full text-left">{user.username} · {user.id}</span>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                        {isSelected ? '✓' : ''}
                      </div>
                    </button>
                  );
                })}
                {filteredNewGroupUsers.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No users match this filter.
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-border bg-card/70">
                <button 
                  disabled={!newGroupName.trim() || selectedGroupMemberIds.length === 0}
                  onClick={onCreateGroup} 
                  className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:bg-primary/90 disabled:opacity-50"
                >
                  Create Group
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showInfoPanel && selectedUser && (
          <div className="fixed inset-0 z-[300] flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowInfoPanel(false)}></div>
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-[350px] bg-card h-full flex flex-col shadow-2xl z-10 border-l border-border relative overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-bold text-lg">Details</h2>
                <button onClick={() => setShowInfoPanel(false)} className="hover:bg-secondary p-1.5 rounded-full"><Plus className="w-6 h-6 rotate-45" /></button>
              </div>
              <div className="p-6 flex flex-col items-center border-b border-border">
                <img src={selectedUser.avatarUrl || undefined} alt="avatar" className={`w-24 h-24 mb-4 object-cover ${'isGroup' in selectedUser ? 'rounded-2xl' : 'rounded-full'}`} onError={handleAvatarError} />
                <span className="font-bold text-xl">{selectedUser.displayName}</span>
                <span className="text-muted-foreground font-medium text-sm">{selectedUser.username}</span>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <button onClick={() => setIsMuted(!isMuted)} className="flex items-center justify-between w-full p-3 hover:bg-secondary/50 rounded-xl font-bold transition-colors">
                  Mute Messages <input type="checkbox" checked={isMuted} readOnly className="w-5 h-5 pointer-events-none" />
                </button>
                {('isGroup' in selectedUser) && selectedGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowInfoPanel(false);
                      setShowGroupSettingsScreen(true);
                    }}
                    className="rounded-xl border border-border p-3 text-left hover:bg-secondary/50 transition-colors"
                  >
                    <div className="text-sm font-bold">Group Settings</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Manage name, members, and group actions
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowInfoPanel(false);
                    setShowPinnedMessagesScreen(true);
                  }}
                  className="rounded-xl border border-border p-3 text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="text-sm font-bold">Pinned Messages</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {pinnedMessages.length === 0 ? 'No pinned messages yet.' : `${pinnedMessages.length} pinned message${pinnedMessages.length > 1 ? 's' : ''}`}
                  </div>
                </button>
                <div className="rounded-xl border border-border p-3">
                  <div className="text-sm font-bold mb-2">Wallpaper</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setChatWallpaper('default')} className={`px-2 py-2 rounded-lg text-xs font-semibold border transition-colors ${chatWallpaper === 'default' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-secondary/50'}`}>
                      Default
                    </button>
                    <button type="button" onClick={() => setChatWallpaper('ocean')} className={`px-2 py-2 rounded-lg text-xs font-semibold border transition-colors ${chatWallpaper === 'ocean' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-secondary/50'}`}>
                      Ocean
                    </button>
                    <button type="button" onClick={() => setChatWallpaper('sunset')} className={`px-2 py-2 rounded-lg text-xs font-semibold border transition-colors ${chatWallpaper === 'sunset' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-secondary/50'}`}>
                      Sunset
                    </button>
                    <button type="button" onClick={() => setChatWallpaper('forest')} className={`px-2 py-2 rounded-lg text-xs font-semibold border transition-colors ${chatWallpaper === 'forest' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-secondary/50'}`}>
                      Forest
                    </button>
                  </div>
                  <div className="mt-3">
                    <input
                      ref={wallpaperInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handleWallpaperUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => wallpaperInputRef.current?.click()}
                      className="w-full px-3 py-2 rounded-lg text-xs font-semibold border bg-background border-border hover:bg-secondary/50 transition-colors"
                    >
                      Upload Photo/Video Wallpaper
                    </button>
                  </div>
                  {customWallpapers.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {customWallpapers.map((item) => (
                        <div
                          key={item.id}
                          className={`relative rounded-lg border overflow-hidden ${chatWallpaper === item.id ? 'border-primary ring-1 ring-primary/40' : 'border-border'}`}
                        >
                          <button
                            type="button"
                            onClick={() => setChatWallpaper(item.id)}
                            className="w-full text-left"
                          >
                            <div className="h-20 bg-black/5">
                              {item.kind === 'video' ? (
                                <video
                                  data-playback-scope={PLAYBACK_SCOPE.AMBIENT}
                                  src={item.value}
                                  className="w-full h-full object-cover"
                                  muted
                                  loop
                                  autoPlay
                                  playsInline
                                  preload="metadata"
                                />
                              ) : (
                                <img src={item.value} alt={item.label} className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="px-2 py-1 text-[10px] font-semibold truncate bg-card">
                              {item.kind === 'video' ? 'Video' : 'Image'} · {item.label}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCustomWallpaper(item.id)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                            title="Remove wallpaper"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowInfoPanel(false);
                    setShowGalleryScreen(true);
                  }}
                  className="rounded-xl border border-border p-3 text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="text-sm font-bold">Gallery</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {galleryItems.length === 0 ? 'No shared media yet.' : `${galleryItems.length} shared item${galleryItems.length > 1 ? 's' : ''}`}
                  </div>
                </button>
                {('isGroup' in selectedUser) ? (
                  <>
                    <button onClick={handleLeaveGroup} className="text-red-500 font-bold p-3 text-left hover:bg-secondary/50 rounded-xl transition-colors">Leave Group</button>
                    <button onClick={handleDeleteGroup} className="text-red-500 font-bold p-3 text-left hover:bg-secondary/50 rounded-xl transition-colors">Delete Group</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setShowInfoPanel(false); showToast('Reported'); }} className="text-red-500 font-bold p-3 text-left hover:bg-secondary/50 rounded-xl transition-colors">Report...</button>
                    <button
                      onClick={() => {
                        const peerId = selectedUser?.id;
                        if (peerId && blockUser(peerId)) {
                          showToast(`Blocked @${selectedUser.username || 'user'}`);
                        }
                        setShowInfoPanel(false);
                        setSelectedChatId(null);
                      }}
                      className="text-red-500 font-bold p-3 text-left hover:bg-secondary/50 rounded-xl transition-colors"
                    >
                      Block Contact
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {showGroupSettingsScreen && selectedUser && selectedGroup && (
          <div className="absolute inset-0 z-[120] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm">
            <div className="h-full w-full border-t border-border bg-card dark:bg-zinc-900 flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => {
                    setShowGroupSettingsScreen(false);
                    setShowInfoPanel(true);
                  }}
                  className="hover:bg-secondary p-1.5 rounded-full"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="font-bold text-lg">Group Settings</h2>
                <div className="flex items-center gap-2">
                  {(selectedGroup.createdBy || currentUser.id) === currentUser.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setGroupModerationSearchQuery('');
                        setShowGroupSettingsScreen(false);
                        setShowGroupModerationScreen(true);
                      }}
                      className="hover:bg-secondary p-1.5 rounded-full"
                      title="Admin Moderation"
                    >
                      <Shield className="w-5 h-5" />
                    </button>
                  )}
                  {(selectedGroup.createdBy || currentUser.id) === currentUser.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setGroupAddUsersSearchQuery('');
                        setShowGroupSettingsScreen(false);
                        setShowGroupAddUsersScreen(true);
                      }}
                      className="hover:bg-secondary p-1.5 rounded-full"
                      title="Add users"
                    >
                      <Users className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowGroupSettingsScreen(false)}
                    className="hover:bg-secondary p-1.5 rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
                <div className="rounded-xl border border-border p-2.5 flex flex-col gap-2 flex-1 min-h-[320px]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold">Group Profile</div>
                    <div className="text-[11px] text-muted-foreground">
                      Owner: {(selectedGroup.createdBy || currentUser.id) === currentUser.id ? 'You' : (selectedGroup.createdBy || 'Unknown')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={groupSettingsAvatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleGroupSettingsAvatarUpload}
                    />
                    <button
                      type="button"
                      onClick={() => groupSettingsAvatarInputRef.current?.click()}
                      disabled={(selectedGroup.createdBy || currentUser.id) !== currentUser.id}
                      className="w-10 h-10 rounded-xl border border-border overflow-hidden bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 disabled:opacity-60"
                    >
                      <img
                        src={selectedGroup.avatarUrl || undefined}
                        alt={selectedGroup.displayName}
                        className="w-full h-full object-cover"
                        onError={handleAvatarError}
                      />
                    </button>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold">Profile Picker</span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {(selectedGroup.createdBy || currentUser.id) === currentUser.id ? 'Tap image to change group profile' : 'Only owner can change profile'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={groupNameDraft}
                      onChange={(e) => setGroupNameDraft(e.target.value)}
                      placeholder="Group name"
                      className="flex-1 bg-secondary outline-none px-2.5 py-2 rounded-lg text-sm font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleSaveGroupName}
                      className="px-2.5 py-2 rounded-lg text-[11px] font-semibold border border-border bg-background hover:bg-secondary/50 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                  <div className="h-px bg-border my-1" />
                  <input
                    type="text"
                    value={groupManageSearchQuery}
                    onChange={(e) => setGroupManageSearchQuery(e.target.value)}
                    placeholder="Search by name, username, ID..."
                    className="w-full bg-secondary outline-none px-3 py-2 rounded-lg text-sm font-medium"
                  />
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Members</div>
                  <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1 min-h-[300px]">
                    {filteredGroupMembers.map((member) => (
                      <div key={`group-member-full-${member.id}`} className="flex items-center gap-2 rounded-lg border border-border p-1.5 bg-background/60">
                        <img src={member.avatarUrl || undefined} alt={member.username} className="w-8 h-8 rounded-full object-cover border border-border" onError={handleAvatarError} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">{member.displayName}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{member.username} · {member.id}</div>
                        </div>
                        {((selectedGroup.createdBy || currentUser.id) === member.id || selectedGroupAdminSet.has(member.id)) && (
                          <span className="px-2 py-1 rounded-md text-[10px] font-semibold border border-border bg-secondary/60 shrink-0">
                            {(selectedGroup.createdBy || currentUser.id) === member.id ? 'Owner' : 'Admin'}
                          </span>
                        )}
                        {member.id !== currentUser.id && (selectedGroup.createdBy || currentUser.id) === currentUser.id && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGroupMember(member.id)}
                            className="px-2 py-1 rounded-md text-[10px] font-semibold border border-border hover:bg-secondary/50 transition-colors shrink-0"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    {filteredGroupMembers.length === 0 && (
                      <div className="text-xs text-muted-foreground py-2 text-center">No members match search.</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t border-border p-4 sm:p-6 pt-4 bg-card/90">
                <div className="rounded-xl border border-border p-3 grid grid-cols-2 gap-2">
                  <button onClick={handleLeaveGroup} className="text-red-500 font-bold p-2 text-center hover:bg-secondary/50 rounded-lg transition-colors">Leave Group</button>
                  <button onClick={handleDeleteGroup} className="text-red-500 font-bold p-2 text-center hover:bg-secondary/50 rounded-lg transition-colors">Delete Group</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showGroupAddUsersScreen && selectedUser && selectedGroup && (
          <div className="absolute inset-0 z-[120] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm">
            <div className="h-full w-full border-t border-border bg-card dark:bg-zinc-900 flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => {
                    setShowGroupAddUsersScreen(false);
                    setShowGroupSettingsScreen(true);
                  }}
                  className="hover:bg-secondary p-1.5 rounded-full"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="font-bold text-lg">Add Users</h2>
                <button
                  type="button"
                  onClick={() => setShowGroupAddUsersScreen(false)}
                  className="hover:bg-secondary p-1.5 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-3">
                <input
                  type="text"
                  value={groupAddUsersSearchQuery}
                  onChange={(e) => setGroupAddUsersSearchQuery(e.target.value)}
                  placeholder="Search users by name, username, ID..."
                  className="w-full bg-secondary outline-none px-3 py-2 rounded-lg text-sm font-medium"
                />
                <div className="rounded-xl border border-border p-3 flex flex-col gap-3">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Available Users</div>
                  <div className="max-h-[56vh] overflow-y-auto flex flex-col gap-2 pr-1">
                    {filteredAddableGroupUsers.map((user) => (
                      <div key={`group-add-fullscreen-${user.id}`} className="flex items-center gap-2 rounded-lg border border-border p-2 bg-background/60">
                        <img src={user.avatarUrl || undefined} alt={user.username} className="w-9 h-9 rounded-full object-cover border border-border" onError={handleAvatarError} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">{user.displayName}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{user.username} · {user.id}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddGroupMember(user.id)}
                          className="px-2 py-1 rounded-md text-[10px] font-semibold border border-border hover:bg-secondary/50 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                    {filteredAddableGroupUsers.length === 0 && (
                      <div className="text-xs text-muted-foreground py-2 text-center">No users available to add.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showGroupModerationScreen && selectedUser && selectedGroup && (
          <div className="absolute inset-0 z-[120] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm">
            <div className="h-full w-full border-t border-border bg-card dark:bg-zinc-900 flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => {
                    setShowGroupModerationScreen(false);
                    setShowGroupSettingsScreen(true);
                  }}
                  className="hover:bg-secondary p-1.5 rounded-full"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="font-bold text-lg">Admin Moderation</h2>
                <button
                  type="button"
                  onClick={() => setShowGroupModerationScreen(false)}
                  className="hover:bg-secondary p-1.5 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
                <div className="rounded-xl border border-border p-3 flex flex-col gap-3">
                  <div className="text-sm font-bold">Group Safety Controls</div>
                  <button
                    type="button"
                    onClick={() => toggleGroupModerationSetting('adminOnlyPosting')}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <span className="text-sm font-medium">Admin-only posting</span>
                    <input type="checkbox" readOnly checked={!!selectedGroup.adminOnlyPosting} className="w-4 h-4 pointer-events-none" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleGroupModerationSetting('requireApprovalToJoin')}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <span className="text-sm font-medium">Require approval to join</span>
                    <input type="checkbox" readOnly checked={!!selectedGroup.requireApprovalToJoin} className="w-4 h-4 pointer-events-none" />
                  </button>
                </div>
                <div className="rounded-xl border border-border p-3 flex flex-col gap-3">
                  <input
                    type="text"
                    value={groupModerationSearchQuery}
                    onChange={(e) => setGroupModerationSearchQuery(e.target.value)}
                    placeholder="Search members by name, username, ID..."
                    className="w-full bg-secondary outline-none px-3 py-2 rounded-lg text-sm font-medium"
                  />
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Moderate Members</div>
                  <div className="max-h-[56vh] overflow-y-auto flex flex-col gap-2 pr-1">
                    {filteredModerationMembers.map((member) => {
                      const isMuted = Array.isArray(selectedGroup.mutedMemberIds) && selectedGroup.mutedMemberIds.includes(member.id);
                      const isOwner = (selectedGroup.createdBy || currentUser.id) === member.id;
                      const isAdmin = selectedGroupAdminSet.has(member.id);
                      return (
                        <div key={`moderation-member-${member.id}`} className="flex items-center gap-2 rounded-lg border border-border p-2 bg-background/60">
                          <img src={member.avatarUrl || undefined} alt={member.username} className="w-9 h-9 rounded-full object-cover border border-border" onError={handleAvatarError} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate">{member.displayName}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{member.username} · {member.id}</div>
                          </div>
                          {isOwner ? (
                            <span className="px-2 py-1 rounded-md text-[10px] font-semibold border border-border bg-secondary/60">Owner</span>
                          ) : (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleGroupAdminMember(member.id)}
                                className={`px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors ${isAdmin ? 'border-blue-500/40 text-blue-600 hover:bg-blue-500/10' : 'border-border hover:bg-secondary/50'}`}
                              >
                                {isAdmin ? 'Remove admin' : 'Make admin'}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleMuteGroupMember(member.id)}
                                className={`px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors ${isMuted ? 'border-amber-500/40 text-amber-600 hover:bg-amber-500/10' : 'border-border hover:bg-secondary/50'}`}
                              >
                                {isMuted ? 'Unmute' : 'Mute'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredModerationMembers.length === 0 && (
                      <div className="text-xs text-muted-foreground py-2 text-center">No members match search.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPinnedMessagesScreen && selectedUser && (
          <div className="absolute inset-0 z-[120] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm">
            <div className="h-full w-full border-t border-border bg-card dark:bg-zinc-900 flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinnedMessagesScreen(false);
                    setShowInfoPanel(true);
                  }}
                  className="hover:bg-secondary p-1.5 rounded-full"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="font-bold text-lg">Pinned Messages</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPinnedSearch((prev) => !prev)}
                    className="hover:bg-secondary p-1.5 rounded-full"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPinnedMessagesScreen(false)}
                    className="hover:bg-secondary p-1.5 rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {showPinnedSearch && (
                <div className="px-4 sm:px-6 py-2 border-b border-border bg-card/80 backdrop-blur-sm">
                  <input
                    type="text"
                    value={pinnedSearchQuery}
                    onChange={(e) => setPinnedSearchQuery(e.target.value)}
                    placeholder="Search with #, @, name..."
                    className="w-full bg-secondary outline-none px-3 py-2 rounded-xl text-sm font-medium"
                  />
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {filteredPinnedMessages.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No pinned messages yet.</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {filteredPinnedMessages.map((message: ChatMessage, pinnedIdx: number) => (
                      <button
                        key={`pinned-screen-${message.id || pinnedIdx}`}
                        type="button"
                        onClick={() => {
                          setShowPinnedMessagesScreen(false);
                          jumpToOriginalMessage(message.id);
                        }}
                        className="w-full text-left rounded-xl border border-border p-3 hover:bg-secondary/40 transition-colors"
                      >
                        <div className="text-[11px] font-bold text-primary mb-1">Pinned</div>
                        <div className="text-sm font-medium leading-relaxed">
                          {(typeof message?.text === 'string' && message.text.trim()) ? message.text : 'Voice/Media message'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showGalleryScreen && selectedUser && (
          <div className="absolute inset-0 z-[120] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm">
            <div className="h-full w-full border-t border-border bg-card dark:bg-zinc-900 flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => {
                    setShowGalleryScreen(false);
                    setShowInfoPanel(true);
                  }}
                  className="hover:bg-secondary p-1.5 rounded-full"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="font-bold text-lg">Gallery</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGallerySearch((prev) => !prev)}
                    className="hover:bg-secondary p-1.5 rounded-full"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGalleryScreen(false)}
                    className="hover:bg-secondary p-1.5 rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {showGallerySearch && (
                <div className="px-4 sm:px-6 py-2 border-b border-border bg-card/80 backdrop-blur-sm">
                  <input
                    type="text"
                    value={gallerySearchQuery}
                    onChange={(e) => setGallerySearchQuery(e.target.value)}
                    placeholder="Search with #, @, name..."
                    className="w-full bg-secondary outline-none px-3 py-2 rounded-xl text-sm font-medium"
                  />
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {filteredGalleryItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No shared media yet.</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {filteredGalleryItems.map((item, galleryIndex) => (
                      <button
                        key={`gallery-screen-${galleryIndex}`}
                        type="button"
                        onClick={() =>
                          tryOpenMediaFullscreen(filteredGalleryItems, galleryIndex, `gallery-${galleryIndex}`)
                        }
                        className="relative aspect-square rounded-xl overflow-hidden border border-border/70"
                      >
                        {item.isAudio ? (
                          <div className="w-full h-full bg-secondary flex items-center justify-center">
                            <Music className="w-6 h-6 text-primary" />
                          </div>
                        ) : item.isVideo ? (
                          <>
                            <ChatInlineVideo
                              src={item.url || ''}
                              className="w-full h-full"
                              videoClassName="w-full h-full object-cover"
                              onError={handleMediaError}
                              visibilityAutoplay={false}
                              onRegisterRef={(el) => {
                                const key = `gallery-${galleryIndex}`;
                                if (el) inlineVideoRefs.current.set(key, el);
                                else inlineVideoRefs.current.delete(key);
                              }}
                            />
                            <div className="pointer-events-none absolute inset-0 bg-black/20 flex items-center justify-center">
                              <Play className="w-5 h-5 text-white fill-white" />
                            </div>
                          </>
                        ) : (
                          <img src={item.url || undefined} className="w-full h-full object-cover" onError={handleMediaError} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
    </AnimatePresence>
  );
}
