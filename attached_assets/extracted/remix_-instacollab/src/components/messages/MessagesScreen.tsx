import React, { useState, useEffect } from 'react';
import { useDB } from '../../lib/useDB';
import { Edit, Video, Phone, Info, Send, Users, Plus, ArrowLeft, Image, X, ChevronLeft, ChevronRight, Play, Pause, Mic, FileText, Music, MapPin, Loader2 } from 'lucide-react';
import { useVoice } from '../../lib/useVoice';
import { Waveform } from './Waveform';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { MusicDiscPlayer } from './MusicDiscPlayer';
import { createPortal } from 'react-dom';
import { User } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../../lib/ToastContext';
import { handleAvatarError, handleMediaError, fileToBase64 } from '../../lib/utils';
import { LocationPickerModal } from '../common/LocationPickerModal';

export function MessagesScreen({ onBack, initialChatId, onClearInitialChatId }: { onBack?: () => void, initialChatId?: string | null, onClearInitialChatId?: () => void }) {
  const db = useDB();
  const USERS = db.users;
  const currentUser = db.currentUser;
  const { showToast } = useToast();

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  useEffect(() => {
    if (initialChatId) {
      setSelectedChatId(initialChatId);
      onClearInitialChatId?.();
    }
  }, [initialChatId, onClearInitialChatId]);

  const [activeCall, setActiveCall] = useState<'video' | 'audio' | null>(null);
  const [messageText, setMessageText] = useState('');
  
  // --- MEDIA ---
  const [chatMedia, setChatMedia] = useState<{ url: string; isVideo: boolean; isAudio?: boolean; name?: string }[]>([]);
  const [fullscreenMedia, setFullscreenMedia] = useState<{
    items: { 
      url: string; 
      isVideo: boolean; 
      isAudio?: boolean; 
      name?: string;
      title?: string;
      caption?: string;
      avatarUrl?: string;
      post?: any;
      reel?: any;
      story?: any;
      musicUrl?: string;
    }[];
    mediaIndex: number;
  } | null>(null);

  const handleSharedItemClick = (msgText: string) => {
    // 1. Check if Post
    if (msgText.includes('instacollab.app/p/')) {
      const match = msgText.match(/\/p\/([^?\s]+)/);
      const postId = match ? match[1] : null;
      const post = postId ? db.posts.find((p: any) => p.id === postId) : null;
      if (post) {
        setFullscreenMedia({
          items: [{
            url: post.videoUrl || post.imageUrl || undefined,
            isVideo: !!post.videoUrl,
            isAudio: !!post.audioUrl,
            name: post.audioUrl,
            title: `@${post.user.username}`,
            caption: post.caption,
            avatarUrl: post.user.avatarUrl,
            post: post
          }],
          mediaIndex: 0
        });
        return;
      }
    }

    // 2. Check if Reel
    if (msgText.includes('instacollab.app/r/')) {
      const match = msgText.match(/\/r\/([^?\s]+)/);
      const reelId = match ? match[1] : null;
      const reel = reelId ? db.reels.find((r: any) => r.id === reelId) : null;
      if (reel) {
        setFullscreenMedia({
          items: [{
            url: reel.videoUrl || undefined,
            isVideo: true,
            title: `@${reel.user.username}`,
            caption: reel.caption,
            avatarUrl: reel.user.avatarUrl,
            reel: reel
          }],
          mediaIndex: 0
        });
        return;
      }
    }

    // 3. Check if Story
    if (msgText.includes('instacollab.app/s/')) {
      const match = msgText.match(/\/s\/([^?\s]+)/);
      const username = match ? match[1] : null;
      const storyUser = username ? db.users.find((u: any) => u.username === username) : null;
      if (storyUser) {
        const persistentSegments = db.getUserStorySegments(storyUser.id);
        const storySegments = persistentSegments.length > 0 
          ? persistentSegments 
          : [
              { url: `https://images.unsplash.com/photo-1621252179027-94459d278660?w=400&fit=crop&sig=${storyUser.id}-1`, isVideo: false },
              { url: `https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&fit=crop&sig=${storyUser.id}-2`, isVideo: false },
              { url: `https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&fit=crop&sig=${storyUser.id}-3`, isVideo: false },
            ];
        
        const matchSeg = msgText.match(/[?&]seg=(\d+)/);
        const segIdxForClick = matchSeg ? parseInt(matchSeg[1], 10) : 0;
        const clampIdx = Math.max(0, Math.min(segIdxForClick, storySegments.length - 1));

        setFullscreenMedia({
          items: storySegments.map((seg: any) => ({
            url: seg.url,
            isVideo: !!seg.isVideo,
            title: `@${storyUser.username}`,
            caption: seg.caption || 'Story segment',
            avatarUrl: storyUser.avatarUrl,
            story: { user: storyUser }
          })),
          mediaIndex: clampIdx
        });
        return;
      }
    }

    // Fallback: Open URL in a new tab
    const splitArr = msgText.split(' ');
    const lastItem = splitArr[splitArr.length - 1];
    if (lastItem.startsWith('http')) {
      window.open(lastItem, '_blank');
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        try {
          const files = Array.from(e.target.files);
          const newMedia = await Promise.all(files.map(async (file) => {
            const base64 = await fileToBase64(file);
            return {
              url: base64,
              isVideo: file.type.startsWith("video/") || /\.(mp4|mov|webm|ogg|m4v|avi|wmv)$/i.test(file.name),
            };
          }));
          setChatMedia((prev) => [...prev, ...newMedia]);
        } catch (err) {
          showToast('Error processing media');
        }
      }
  };
  
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  const [groups, setGroups] = useState([
    { id: 'group1', displayName: 'Design Team UI/UX', username: '3 members', avatarUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100', isGroup: true }
  ]);

  const [newGroupName, setNewGroupName] = useState('');

  const selectedUser = USERS.find(u => u.id === selectedChatId) ||
                       groups.find(g => g.id === selectedChatId) || null;

  const messages = db.messages;
  const [isTyping, setIsTyping] = useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, selectedChatId, isTyping]);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageText.trim() && chatMedia.length === 0 && !recordedVoice) || !selectedUser) return;

    db.addMessage(selectedUser.id, { 
      text: messageText, 
      isAuthor: true, 
      media: recordedVoice ? [{ url: recordedVoice, isAudio: true }] : (chatMedia.length > 0 ? chatMedia : undefined)
    });
    
    setMessageText('');
    setChatMedia([]);
    clearRecording();
    
    // Simulate real-time replies
    if (!('isGroup' in selectedUser)) {
      setIsTyping(selectedUser.id);
      setTimeout(() => {
         const responses = [
           "That sounds amazing!",
           "I completely agree.",
           "Let's sync up about this tomorrow.",
           "Interesting perspective! Tell me more.",
           "Wow, didn't know that. 🚀",
           "Regarding that, I'm on it."
         ];
         const randomResponse = responses[Math.floor(Math.random() * responses.length)];
         db.addMessage(selectedUser.id, { text: randomResponse, isAuthor: false });
         setIsTyping(null);
      }, 1500 + Math.random() * 2000);
    }
  };

  const handleFileUploadMenu = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && selectedUser) {
      db.addMessage(selectedUser.id, { text: `📎 Sent file: ${e.target.files[0].name}`, isAuthor: true });
      showToast('File sent');
    }
  };

  const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      try {
        const file = e.target.files[0];
        const base64 = await fileToBase64(file);
        const newAudio = {
          url: base64,
          isVideo: false,
          isAudio: true,
          name: file.name
        };
        setChatMedia((prev) => [...prev, newAudio]);
        setShowAttachmentMenu(false);
        if (!messageText.trim()) {
          setMessageText(`🎵 Sent audio: ${file.name}`);
        }
      } catch (err) {
        showToast('Error processing audio');
      }
    }
  };

  const handleLocationShare = () => {
    setShowAttachmentMenu(false);
    setShowLocationPicker(true);
  };

  const handleLocationSelected = (locationUrl: string, locationName?: string) => {
    setShowLocationPicker(false);
    if (selectedUser) {
      db.addMessage(selectedUser.id, { 
        text: `📍 Shared location: ${locationName ? locationName + ' - ' : ''}${locationUrl}`, 
        isAuthor: true 
      });
      showToast('Location shared');
    }
  };

  const handleViewProfile = () => {
    if (selectedUser && !('isGroup' in selectedUser)) {
      window.dispatchEvent(new CustomEvent('navigate', { 
        detail: { 
          tab: 'profile', 
          userId: selectedUser.id 
        } 
      }));
    }
  };

  const currentMessages = selectedUser ? messages[selectedUser.id] || [] : [];

  const { 
    isListening, 
    isRecording, 
    recordedVoice, 
    toggleListening, 
    startRecording, 
    stopRecording,
    playRecording,
    clearRecording
  } = useVoice((text) => setMessageText(text));
  const pressTimer = React.useRef<NodeJS.Timeout | null>(null);

  const handleMicDown = () => {
    pressTimer.current = setTimeout(() => {
      startRecording();
      pressTimer.current = null;
    }, 500);
  };

  const handleMicUp = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
      toggleListening();
    } else if (isRecording) {
      stopRecording();
    }
  };

  return (
    <div className={`w-full h-full md:h-[calc(100%-2rem)] flex max-w-[935px] mx-auto md:border border-border bg-background md:my-4 rounded-none md:rounded-[32px] overflow-hidden shadow-sm relative z-10 min-h-0`}>
      
      {/* Sidebar: Message List */}
      <div className={`w-full md:w-[250px] lg:w-[350px] border-r border-border flex flex-col bg-card shrink-0 min-h-0 overflow-hidden ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="h-[75px] border-b border-border flex items-center justify-between px-4 sm:px-6 shrink-0 z-[60]">
          <div className="flex items-center gap-3">
            {onBack && (
              <button 
                onClick={onBack}
                className="md:hidden p-2 rounded-full hover:bg-secondary transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <span className="font-black text-[20px] tracking-tight">Messages</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowNewGroupModal(true)} className="hover:bg-secondary p-2.5 rounded-full transition-colors group" title="New Group">
              <Users className="w-5 h-5 group-hover:text-primary transition-colors" />
            </button>
            <button onClick={() => setShowNewMessageModal(true)} className="hover:bg-secondary p-2.5 rounded-full transition-colors group" title="New Message">
              <Edit className="w-5 h-5 group-hover:text-primary transition-colors" />
            </button>
          </div>
        </div>
        
        {/* list */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          
          <div className="px-6 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Groups</div>
          {groups.map((group) => (
            <div 
              key={group.id} 
              onClick={() => setSelectedChatId(group.id)}
              className={`flex items-center gap-4 px-6 py-3 cursor-pointer transition-colors ${selectedChatId === group.id ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
            >
              <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-border">
                <img src={group.avatarUrl || undefined} alt={group.displayName} className="w-full h-full object-cover" onError={handleAvatarError} />
              </div>
              <div className="flex flex-col flex-1 overflow-hidden">
                 <span className="text-[15px] font-bold truncate">{group.displayName}</span>
                 <span className="text-[13px] text-muted-foreground truncate font-medium">
                   {messages[group.id]?.length ? messages[group.id][messages[group.id].length-1]?.text : 'Start chatting'}
                 </span>
              </div>
            </div>
          ))}

          <div className="px-6 mt-4 mb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Direct Messages</div>
          {USERS.map((user) => (
            <div 
              key={user.id} 
              onClick={() => setSelectedChatId(user.id)}
              className={`flex items-center gap-4 px-6 py-3 cursor-pointer transition-colors ${selectedChatId === user.id ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
            >
              <div className="relative shrink-0">
                <div className="w-14 h-14 rounded-full overflow-hidden border border-border">
                  <img src={user.avatarUrl || undefined} alt={user.username} className="w-full h-full object-cover" onError={handleAvatarError} />
                </div>
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-card rounded-full shadow-sm"></div>
              </div>
              <div className="flex flex-col flex-1 overflow-hidden">
                 <span className="text-[15px] font-bold truncate">{user.displayName}</span>
                 <span className="text-[13px] text-muted-foreground truncate font-medium">
                   {messages[user.id]?.length ? messages[user.id][messages[user.id].length-1]?.text : 'Active now'}
                 </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main: Chat View */}
      {!selectedUser ? (
        <div className="hidden md:flex flex-col flex-1 items-center justify-center bg-background">
          <div className="w-24 h-24 border-2 border-foreground rounded-full flex items-center justify-center mb-4">
            <Send className="w-12 h-12 text-foreground -translate-x-1 translate-y-1" />
          </div>
          <h2 className="text-xl font-bold">Your Messages</h2>
          <p className="text-muted-foreground mb-6">Send private photos and messages to a friend or group.</p>
          <button onClick={() => setShowNewMessageModal(true)} className="px-6 py-2 bg-primary text-primary-foreground font-bold rounded-full">Send Message</button>
        </div>
      ) : (
        <div className="flex flex-col flex-1 bg-background min-h-0 overflow-hidden">
           {/* Chat Header */}
           <div className="h-[75px] border-b border-border flex items-center px-4 shrink-0 bg-card/50 backdrop-blur-sm z-10 w-full gap-2 sm:gap-4">
              <button 
                className="md:hidden p-2 -ml-2 rounded-full hover:bg-secondary transition-colors shrink-0" 
                onClick={() => setSelectedChatId(null)}
              >
                 <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 overflow-hidden border border-border shrink-0 mb-0 ${'isGroup' in selectedUser ? 'rounded-xl' : 'rounded-full'}`}>
                     <img src={selectedUser.avatarUrl || undefined} alt="user" className="w-full h-full object-cover" onError={handleAvatarError} />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-bold text-[15px] sm:text-[16px] leading-tight flex items-center gap-2 truncate">
                      <span className="truncate">{selectedUser.displayName}</span>
                      {'isGroup' in selectedUser && <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-md hidden sm:inline-block shrink-0">TEAM</span>}
                    </span>
                    <span className="text-xs text-muted-foreground leading-tight font-medium truncate">{'isGroup' in selectedUser ? selectedUser.username : 'Active recently'}</span>
                  </div>
              </div>
              <div className="flex items-center gap-3 sm:gap-6 text-foreground shrink-0">
                  <Phone onClick={() => setActiveCall('audio')} className="w-5 h-5 sm:w-6 sm:h-6 cursor-pointer hover:text-primary transition-colors shrink-0" />
                  <Video onClick={() => setActiveCall('video')} className="w-5 h-5 sm:w-6 sm:h-6 cursor-pointer hover:text-primary transition-colors shrink-0" />
                  <div className="w-px h-5 sm:h-6 bg-border mx-0 sm:mx-1 shrink-0"></div>
                  <Info onClick={() => setShowInfoPanel(true)} className="w-5 h-5 sm:w-6 sm:h-6 cursor-pointer hover:text-primary transition-colors shrink-0" />
              </div>
           </div>
           
           {/* Chat Messages */}
           <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 w-full">
               <div className="flex flex-col items-center justify-center py-6 sm:py-10 opacity-80">
                   <div className={`w-24 h-24 sm:w-28 sm:h-28 overflow-hidden mb-4 border-2 border-border shadow-sm ${'isGroup' in selectedUser ? 'rounded-2xl' : 'rounded-full'}`}>
                       <img src={selectedUser.avatarUrl || undefined} alt="user" className="w-full h-full object-cover" onError={handleAvatarError} />
                   </div>
                   <h2 className="text-[20px] sm:text-[22px] font-black text-center">{selectedUser.displayName}</h2>
                   <span className="text-muted-foreground text-[13px] sm:text-[14px] font-medium text-center px-4">{selectedUser.username} · InstaCollab End-to-End Encrypted</span>
                   {!('isGroup' in selectedUser) && <button onClick={handleViewProfile} className="mt-4 sm:mt-5 px-6 py-2 bg-secondary hover:bg-foreground hover:text-background rounded-full text-[14px] font-bold transition-all shadow-sm">View Profile</button>}
               </div>
               
               <AnimatePresence>
               {currentMessages.map((msg, idx) => (
                 <motion.div 
                   initial={{ opacity: 0, y: 10, scale: 0.95 }}
                   animate={{ opacity: 1, y: 0, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   key={idx} 
                   className={`flex gap-2 sm:gap-3 justify-start items-end mt-2 ${msg.isAuthor ? 'flex-row-reverse' : ''}`}
                 >
                   {!msg.isAuthor && (
                     <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-border shadow-sm">
                       <img src={selectedUser.avatarUrl || undefined} alt="user" className="w-full h-full object-cover" onError={handleAvatarError} />
                     </div>
                   )}
                   <div className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-[20px] max-w-[80%] sm:max-w-[70%] shadow-md backdrop-blur-sm ${msg.isAuthor ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-secondary/70 text-foreground rounded-bl-sm border border-border/50'}`}>
                      {msg.text.includes('instacollab.app/p/') || msg.text.includes('instacollab.app/r/') || msg.text.includes('instacollab.app/s/') ? (
                        <div 
                          className="flex flex-col gap-2.5 cursor-pointer max-w-[280px] sm:max-w-[320px] bg-secondary/80 hover:bg-secondary p-3 rounded-2xl border border-border transition-all shadow-sm active:scale-[0.98]" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSharedItemClick(msg.text);
                          }}
                        >
                          {/* Header of the shared card */}
                          {(() => {
                            let user: any = null;
                            let typeText = '';
                            if (msg.text.includes('/p/')) {
                              const match = msg.text.match(/\/p\/([^?\s]+)/);
                              const post = match ? db.posts.find((p: any) => p.id === match[1]) : null;
                              user = post?.user;
                              typeText = post?.videoUrl ? 'Video Post' : post?.audioUrl ? 'Audio Post' : 'Post';
                            } else if (msg.text.includes('/r/')) {
                              const match = msg.text.match(/\/r\/([^?\s]+)/);
                              const reel = match ? db.reels.find((r: any) => r.id === match[1]) : null;
                              user = reel?.user;
                              typeText = 'Reel';
                            } else {
                              const match = msg.text.match(/\/s\/([^?\s]+)/);
                              user = db.users.find((u: any) => match && u.username === match[1]);
                              typeText = 'Story';
                            }

                            return user ? (
                              <div className="flex items-center justify-between border-b border-border pb-2 w-full gap-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full overflow-hidden border border-border shrink-0">
                                    <img src={user.avatarUrl || undefined} alt="avatar" className="w-[100%] h-[100%] object-cover" onError={handleAvatarError} />
                                  </div>
                                  <div className="flex flex-col leading-none">
                                    <span className="font-bold text-xs hover:underline text-foreground drop-shadow-sm truncate">@{user.username}</span>
                                    <span className="text-[9px] text-muted-foreground font-medium tracking-wide leading-none mt-0.5">{typeText}</span>
                                  </div>
                                </div>
                                <div className="text-[9px] font-bold uppercase tracking-wider text-foreground bg-secondary px-2.5 py-1 rounded-[6px] border border-border shrink-0 select-none">
                                  View
                                </div>
                              </div>
                            ) : null;
                          })()}

                          {/* Message Text split */}
                          {msg.text.replaceAll(/https?:\/\/instacollab\.app\/\S+/g, '').replace(/[:Shared\s]+/g, '').trim() && (
                            <span className="text-[13px] sm:text-[14px] leading-relaxed font-semibold text-foreground drop-shadow-sm px-1">
                              {msg.text.replaceAll(/https?:\/\/instacollab\.app\/\S+/g, '').replace(':', '').trim()}
                            </span>
                          )}

                          {/* Thumbnail / Video Body */}
                          <div className="rounded-xl overflow-hidden bg-black/40 aspect-video w-full relative shadow-inner border border-zinc-900 group">
                              {(() => {
                               if (msg.text.includes('/p/')) {
                                 const match = msg.text.match(/\/p\/([^?\s]+)/);
                                 const post = match ? db.posts.find((p: any) => p.id === match[1]) : null;
                                 if (post?.videoUrl) {
                                   return (
                                     <div className="w-full h-full relative bg-black">
                                       <video src={post.videoUrl || undefined} className="w-full h-full object-cover" autoPlay loop muted playsInline preload="auto" onError={handleMediaError as any} poster={post?.imageUrl || undefined} ref={(el) => { if (el) { el.muted = true; el.defaultMuted = true; } }} onCanPlay={(e) => { try { e.currentTarget.play().catch(() => {}); } catch(err) {} }} style={post?.imageUrl ? { backgroundImage: `url(${post.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundSize: 'cover', backgroundPosition: 'center' }} />
                                       <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                                         <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white scale-100 hover:scale-110 transition-transform">
                                           <Play className="w-4 h-4 fill-white text-white translate-x-[1px]" />
                                         </div>
                                       </div>
                                     </div>
                                   );
                                 }
                                 return (
                                   <div className="w-full h-full relative">
                                     <img src={post?.imageUrl || 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=100'} className="w-[100%] h-[100%] object-cover" onError={handleMediaError} />
                                     {post?.audioUrl && (
                                       <div className="absolute bottom-2 right-2 bg-black/65 backdrop-blur-sm py-1 px-2 rounded-full border border-white/10 flex items-center gap-1.5 text-[9px] text-zinc-100 font-bold max-w-[85%]">
                                         <Music className="w-3 h-3 text-primary shrink-0 animate-spin" />
                                         <span className="truncate leading-none">{post.audioUrl}</span>
                                       </div>
                                     )}
                                   </div>
                                 );
                               } else if (msg.text.includes('/r/')) {
                                 const match = msg.text.match(/\/r\/([^?\s]+)/);
                                 const reel = match ? db.reels.find((r: any) => r.id === match[1]) : null;
                                 return (
                                   <div className="w-full h-full relative bg-black">
                                     {reel?.videoUrl && <video src={reel.videoUrl || undefined} className="w-full h-full object-cover" autoPlay loop muted playsInline preload="auto" onError={handleMediaError as any} poster="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&fit=crop" ref={(el) => { if (el) { el.muted = true; el.defaultMuted = true; } }} onCanPlay={(e) => { try { e.currentTarget.play().catch(() => {}); } catch(err) {} }} style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&fit=crop')", backgroundSize: 'cover', backgroundPosition: 'center' }} />}
                                     <div className="absolute inset-0 flex items-center justify-center bg-black/40 flex-col gap-1 text-white">
                                       <Video className="w-6 h-6 shadow-sm" />
                                       <span className="text-xs font-bold uppercase tracking-wider drop-shadow-md">Reel</span>
                                     </div>
                                   </div>
                                 );
                               } else {
                                 const match = msg.text.match(/\/s\/([^?\s]+)/);
                                 const storyUser = db.users.find((u: any) => match && u.username?.toLowerCase() === match[1]?.toLowerCase());
                                 const persistentSegments = storyUser ? db.getUserStorySegments(storyUser.id) : [];
                                 const storySegments = persistentSegments.length > 0 
                                   ? persistentSegments 
                                   : [
                                       { url: 'https://images.unsplash.com/photo-1621252179027-94459d278660?w=400', isVideo: false },
                                     ];
                                 const matchSeg = msg.text.match(/[?&]seg=(\d+)/);
                                 const segIdx = matchSeg ? parseInt(matchSeg[1], 10) : 0;
                                 const segment = storySegments[segIdx] || storySegments[0];

                                 return (
                                   <div className="w-full h-full relative bg-zinc-950" style={{ backgroundImage: `url(${segment?.url || 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                                     {segment?.isVideo ? (
                                       <video src={segment.url || undefined} className="w-full h-full object-cover" style={{ backgroundImage: `url(${segment?.url || 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400'})`, backgroundSize: 'cover', backgroundPosition: 'center' }} autoPlay loop muted playsInline preload="auto" onError={handleMediaError as any} poster="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400" ref={(el) => { if (el) { el.muted = true; el.defaultMuted = true; } }} onCanPlay={(e) => { try { e.currentTarget.play().catch(() => {}); } catch(err) {} }} />
                                     ) : (
                                       <img src={segment?.url || undefined} className="w-full h-full object-cover" onError={handleMediaError} />
                                     )}
                                     <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-1.5 text-white">
                                       <div className="w-7 h-7 rounded-full border border-primary overflow-hidden shadow-sm shrink-0 scale-100 group-hover:scale-110 transition-transform">
                                         {storyUser && <img src={storyUser.avatarUrl || undefined} className="w-[100%] h-[100%] object-cover" onError={handleAvatarError} />}
                                       </div>
                                       <span className="text-[9px] uppercase font-bold tracking-widest text-primary leading-none">View Story</span>
                                     </div>
                                   </div>
                                 );
                               }
                             })()}
                       </div>
                        </div>
                     ) : msg.text.includes('📍 Shared location:') ? (() => {
                       const cleanText = msg.text.replace("📍 Shared location:", "").trim();
                       const lastDashIndex = cleanText.lastIndexOf(" - http");
                       let address = "";
                       let gUrl = "";
                       if (lastDashIndex !== -1) {
                         address = cleanText.substring(0, lastDashIndex).trim();
                         gUrl = cleanText.substring(lastDashIndex + 3).trim();
                       } else {
                         const urlMatch = cleanText.match(/(https?:\/\/\S+)/);
                         if (urlMatch) {
                           gUrl = urlMatch[0];
                           address = cleanText.replace(gUrl, "").trim();
                         } else {
                           address = cleanText;
                         }
                       }
                       
                       // Clean trailing dashes
                       address = address.replace(/\s*-\s*$/, "").trim();

                       // Get lat lng
                       const matchCoords = gUrl.match(/[?&]q=([-\d.]+),([-\d.]+)/) || gUrl.match(/query=([-\d.]+),([-\d.]+)/) || gUrl.match(/@([-\d.]+),([-\d.]+)/);
                       const lat = matchCoords ? matchCoords[1] : "";
                       const lng = matchCoords ? matchCoords[2] : "";

                       // Define Google / Apple Maps redirect URLs
                       const finalGoogleUrl = gUrl || (lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : "https://www.google.com/maps");
                       const finalAppleUrl = lat && lng 
                         ? `https://maps.apple.com/?q=${encodeURIComponent(address || "Shared Location")}&ll=${lat},${lng}` 
                         : `https://maps.apple.com/?q=${encodeURIComponent(address || "Shared Location")}`;

                       return (
                         <div className="flex flex-col gap-3 min-w-[210px] sm:min-w-[270px] py-1 text-card-foreground">
                           <div className="flex items-start gap-2.5">
                             <div className="p-2 bg-primary/15 rounded-full text-primary shrink-0">
                               <MapPin className="w-5 h-5 stroke-[2.5px]" />
                             </div>
                             <div className="flex flex-col gap-0.5 min-w-0">
                               <span className={`text-[10px] font-bold uppercase tracking-wider ${msg.isAuthor ? 'text-primary-foreground/90' : 'text-primary'}`}>Shared Location</span>
                               <span className={`text-[13px] sm:text-[14px] font-medium leading-normal break-words ${msg.isAuthor ? 'text-primary-foreground' : 'text-foreground'}`}>{address || "Selected Coordinates"}</span>
                             </div>
                           </div>
                           
                           <div className="flex flex-col xs:flex-row gap-2 mt-1">
                             <a 
                               href={finalGoogleUrl} 
                               target="_blank" 
                               rel="noreferrer noopener"
                               className={`flex-1 px-3 py-2 text-xs font-bold rounded-xl border text-center flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer select-none ${msg.isAuthor ? 'bg-white/15 border-white/20 hover:bg-white/25 text-white' : 'bg-background hover:bg-secondary text-foreground border-border'}`}
                             >
                               <img src="https://www.google.com/images/branding/product/ico/maps15_bkr_24dp.png" alt="Google Maps" className="w-3.5 h-3.5 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                               <span>Google Maps</span>
                             </a>
                             <a 
                               href={finalAppleUrl} 
                               target="_blank" 
                               rel="noreferrer noopener"
                               className={`flex-1 px-3 py-2 text-xs font-bold rounded-xl border text-center flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer select-none ${msg.isAuthor ? 'bg-white/15 border-white/20 hover:bg-white/25 text-white' : 'bg-background hover:bg-secondary text-foreground border-border'}`}
                             >
                               <svg viewBox="0 0 170 170" className="w-3.5 h-3.5" fill="currentColor">
                                 <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.34.13-9.13-1.92-14.37-6.15-3.41-2.73-7.39-7.51-11.94-14.33-4.96-7.44-9.15-16-12.56-25.68-3.41-9.68-5.12-18.9-5.12-27.65 0-13.53 3.49-24.57 10.45-33.1 6.97-8.54 15.6-12.82 25.9-12.82 5.02 0 10.14 1.25 15.37 3.75 5.23 2.5 8.94 3.75 11.13 3.75 1.95 0 5.73-1.29 11.34-3.87 5.61-2.58 10.43-3.81 14.46-3.69 15.15.5 26.68 5.78 34.62 15.82-12.5 7.56-18.63 17.61-18.42 30.13.2 10.15 4.13 18.57 11.78 25.26 7.64 6.69 16.66 10.21 27.05 10.57.12.38.25.76.38 1.13zM119.53 19.1c0 8.01-2.88 15.17-8.65 21.46-5.77 6.3-12.85 9.87-21.22 10.72-.12-.88-.18-1.63-.18-2.25 0-7.76 3.01-14.93 9.04-21.5 6.03-6.58 13.06-10.09 21.01-10.55.13.72.19 1.43.19 2.12z" />
                               </svg>
                               <span>Apple Maps</span>
                             </a>
                           </div>
                         </div>
                       );
                     })() : (
                       <span className="text-[14px] sm:text-[15px] leading-relaxed font-medium">{msg.text}</span>
                     )}
                     {msg.media && msg.media.length > 0 && (
                        <div className="mt-2 flex flex-col gap-2 w-full">
                          {msg.media.map((media: any, mIdx: number) => {
                            if (media.isAudio) {
                              return (
                                <div key={mIdx} className="py-1">
                                  {msg.text?.includes('🎵') ? (
                                    <MusicDiscPlayer url={media.url} name={msg.text} color={msg.isAuthor ? 'primary' : 'secondary'} />
                                  ) : (
                                    <VoiceMessagePlayer url={media.url} color={msg.isAuthor ? 'primary' : 'secondary'} />
                                  )}
                                </div>
                              );
                            }
                            return (
                              <div key={mIdx} className={`relative aspect-square rounded-lg overflow-hidden border border-[rgba(255,255,255,0.1)] shadow-sm group ${msg.media.length > 1 ? 'w-[48%] inline-block' : 'max-w-[300px]'}`}>
                                {media.isVideo ? (
                                  <>
                                    <video src={media.url || undefined} className="w-full h-full object-cover" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400')", backgroundSize: 'cover', backgroundPosition: 'center' }} preload="auto" autoPlay loop muted playsInline onError={handleMediaError as any} poster="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400" ref={(el) => { if (el) { el.muted = true; el.defaultMuted = true; } }} onCanPlay={(e) => { try { e.currentTarget.play().catch(() => {}); } catch(err) {} }} />
                                    <button type="button" onClick={() => setFullscreenMedia({ items: msg.media, mediaIndex: mIdx })} className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors">
                                      <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center shadow-lg">
                                        <div className="text-white translate-x-[2px] text-lg">▶</div>
                                      </div>
                                    </button>
                                  </>
                                ) : (
                                  <img src={media.url || undefined} className="w-full h-full object-cover cursor-pointer" onError={handleMediaError} onClick={() => setFullscreenMedia({ items: msg.media, mediaIndex: mIdx })} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                     )}
                   </div>
                 </motion.div>
               ))}
               {isTyping === selectedUser.id && (
                 <motion.div 
                   initial={{ opacity: 0, y: 10, scale: 0.95 }}
                   animate={{ opacity: 1, y: 0, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   className="flex gap-2 justify-start items-end mt-2"
                 >
                   <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-border shadow-sm">
                     <img src={selectedUser.avatarUrl || undefined} alt="user" className="w-full h-full object-cover" onError={handleAvatarError} />
                   </div>
                   <div className="px-5 py-3 rounded-[20px] shadow-sm bg-secondary/70 rounded-bl-sm border border-border/50 flex items-center justify-center gap-1.5 h-11">
                     <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                     <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                     <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                   </div>
                 </motion.div>
               )}
               </AnimatePresence>
               <div ref={messagesEndRef} className="h-2 w-full shrink-0" />
           </div>
           
           {/* Chat Input */}
           <div className="p-4 pb-[calc(1.2rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2 shrink-0 bg-background w-full z-20">
              <div className="flex flex-col gap-2">
                 {chatMedia.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto py-2">
                      {chatMedia.map((media, idx) => (
                        <div
                          key={idx}
                          className="relative inline-block border border-border rounded-lg max-w-[100px] h-20 group shrink-0 overflow-hidden"
                        >
                          {media.isVideo ? (
                            <>
                              <video
                                src={media.url || undefined}
                                className="w-full h-full object-cover bg-black/10" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150')", backgroundSize: 'cover', backgroundPosition: 'center' }} onError={handleMediaError as any} poster="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150" ref={(el) => { if (el) { el.muted = true; el.defaultMuted = true; } }} onCanPlay={(e) => { try { e.currentTarget.play().catch(() => {}); } catch(err) {} }}
                                preload="auto"
                                autoPlay
                                loop
                                muted
                                playsInline
                              />
                              <button type="button" onClick={() => setFullscreenMedia({ items: chatMedia, mediaIndex: idx })} className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors">
                                  <div className="w-8 h-8 rounded-full bg-white/50 backdrop-blur-md flex items-center justify-center shadow-lg">
                                     <div className="text-white translate-x-[1px] text-sm drop-shadow-md">▶</div>
                                  </div>
                              </button>
                            </>
                          ) : media.isAudio ? (
                             <div className="w-full h-full bg-secondary flex items-center justify-center p-2">
                               <div className="w-full h-full rounded-lg bg-primary/20 flex items-center justify-center relative overflow-hidden group-hover:scale-110 transition-transform">
                                  <Music className="w-8 h-8 text-primary animate-pulse" />
                               </div>
                             </div>
                           ) : (
                            <img
                              src={media.url || undefined}
                              className="w-full h-full object-cover cursor-pointer"
                              onError={handleMediaError}
                              onClick={() => setFullscreenMedia({ items: chatMedia, mediaIndex: idx })}
                            />
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setChatMedia((prev) =>
                                prev.filter((_, i) => i !== idx),
                              );
                            }}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm hover:bg-black/80 transition-colors z-20"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                 )}
                 <form onSubmit={handleSendMessage} className="flex items-center border border-border/60 rounded-full px-4 py-2.5 sm:px-5 sm:py-3.5 gap-2 sm:gap-4 bg-background/80 backdrop-blur-md focus-within:bg-card focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20 transition-all shadow-[0_-4px_20_rgba(0,0,0,0.03)] relative">
                      <div className="relative shrink-0">
                        <button 
                          type="button"
                          onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                          className={`cursor-pointer text-foreground hover:scale-110 transition-transform w-8 h-8 flex items-center justify-center shrink-0 bg-secondary/50 rounded-full hover:bg-secondary ${showAttachmentMenu ? 'bg-primary text-primary-foreground' : ''}`}
                        >
                          {isSharingLocation ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className={`w-5 h-5 sm:w-5 sm:h-5 transition-transform ${showAttachmentMenu ? 'rotate-45' : ''}`} />}
                        </button>
                        
                        <AnimatePresence>
                          {showAttachmentMenu && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setShowAttachmentMenu(false)}></div>
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                                className="absolute bottom-full left-0 mb-4 w-52 bg-card border border-border rounded-3xl shadow-2xl overflow-hidden z-20"
                              >
                                <div className="p-2 flex flex-col gap-1">
                                  <button 
                                    type="button" 
                                    onClick={() => { document.getElementById('chat-media-photo')?.click(); setShowAttachmentMenu(false); }}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-secondary rounded-2xl transition-colors text-sm font-bold w-full text-left"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                      <Image className="w-4 h-4 text-blue-600" />
                                    </div>
                                    Photo & Video
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => { document.getElementById('chat-media-file')?.click(); setShowAttachmentMenu(false); }}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-secondary rounded-2xl transition-colors text-sm font-bold w-full text-left"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                                      <FileText className="w-4 h-4 text-orange-600" />
                                    </div>
                                    Document/File
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => { document.getElementById('chat-media-music')?.click(); setShowAttachmentMenu(false); }}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-secondary rounded-2xl transition-colors text-sm font-bold w-full text-left"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                                      <Music className="w-4 h-4 text-pink-600" />
                                    </div>
                                    Music/Audio
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={handleLocationShare}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-secondary rounded-2xl transition-colors text-sm font-bold w-full text-left"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                      <MapPin className="w-4 h-4 text-green-600" />
                                    </div>
                                    Location
                                  </button>
                                </div>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="w-px h-5 bg-border shrink-0 mx-1"></div>
                       {isRecording ? (
                         <div className="flex-1 flex items-center gap-3 px-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="font-semibold text-red-500">Recording...</span>
                            <div className="flex-1 overflow-hidden">
                              <Waveform isPlaying={true} color="bg-red-500" />
                            </div>
                         </div>
                       ) : recordedVoice ? (
                         <div className="flex items-center gap-2 bg-secondary rounded-full px-3 py-1 flex-1">
                            <VoiceMessagePlayer url={recordedVoice} color="secondary" />
                            <div className="ml-auto">
                              <button type="button" onClick={clearRecording} className="text-muted-foreground hover:text-foreground transition-colors p-1"><X className="w-4 h-4" /></button>
                            </div>
                         </div>
                       ) : (
                         <input 
                           type="text" 
                           value={messageText}
                           onChange={e => setMessageText(e.target.value)}
                           placeholder={isListening ? "Listening..." : "Type a message..."}
                           className="flex-1 bg-transparent border-none outline-none text-[14px] sm:text-[15px] font-medium min-w-0 placeholder:text-muted-foreground/70" 
                         />
                       )}
                     <div className="flex items-center shrink-0">
                       <input type="file" id="chat-media-photo" className="hidden" accept="image/*,video/*" multiple onChange={handleMediaUpload} />
                       <input type="file" id="chat-media-file" className="hidden" onChange={handleFileUploadMenu} />
                       <input type="file" id="chat-media-music" className="hidden" accept="audio/*" onChange={handleMusicUpload} />
                       <button
                         type="button"
                         onMouseDown={handleMicDown}
                         onMouseUp={handleMicUp}
                         onTouchStart={handleMicDown}
                         onTouchEnd={handleMicUp}
                         className={`text-foreground hover:scale-110 transition-transform flex items-center justify-center w-8 h-8 rounded-full hover:bg-secondary shrink-0 cursor-pointer ${
                           isRecording ? 'bg-red-500 text-white animate-pulse' : isListening ? 'bg-primary text-primary-foreground animate-pulse' : ''
                         }`}
                       >
                         <Mic className="w-5 h-5" />
                       </button>
                       {messageText.trim() || chatMedia.length > 0 || recordedVoice ? (
                         <button type="submit" className="text-primary font-bold hover:scale-110 transition-transform flex items-center justify-center bg-primary text-primary-foreground p-2 rounded-full shrink-0 shadow-md ml-2">
                           <Send className="w-4 h-4 sm:w-4 sm:h-4 text-primary-foreground" />
                         </button>
                       ) : null}
                     </div>
                 </form>
              </div>
           </div>
        </div>
      )}

      <AnimatePresence>
        {activeCall && selectedUser && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[200] flex flex-col pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] px-4 items-center justify-between">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center gap-4 text-center mt-12"
            >
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary shadow-xl">
                 <img src={selectedUser.avatarUrl || undefined} alt="avatar" className="w-full h-full object-cover" onError={handleAvatarError} />
              </div>
              <h2 className="text-2xl font-bold">{selectedUser.displayName}</h2>
              <p className="text-muted-foreground animate-pulse">{activeCall === 'video' ? 'Calling video...' : 'Calling audio...'}</p>
            </motion.div>
            
            {activeCall === 'video' && (
               <motion.div
                 initial={{ scale: 0 }}
                 animate={{ scale: 1 }}
                 exit={{ scale: 0 }}
                 className="absolute bottom-32 right-8 w-28 h-40 bg-secondary rounded-xl border border-border shadow-2xl overflow-hidden flex items-center justify-center"
               >
                  <img src={currentUser.avatarUrl || undefined} className="w-full h-full object-cover opacity-80 filter blur-[1px]" alt="you" onError={handleAvatarError} />
               </motion.div>
            )}
            
            <motion.div 
               initial={{ opacity: 0, scale: 0.8 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.8 }}
               className="flex items-center gap-6"
            >
               <button className="w-14 h-14 bg-secondary text-foreground hover:bg-secondary/80 rounded-full flex items-center justify-center transition-colors shadow-lg">
                 <Video className="w-6 h-6" />
               </button>
               <button className="w-14 h-14 bg-secondary text-foreground hover:bg-secondary/80 rounded-full flex items-center justify-center transition-colors shadow-lg">
                 <div className="text-xl">🎙️</div>
               </button>
               <button onClick={() => setActiveCall(null)} className="w-16 h-16 bg-red-500 text-white hover:bg-red-600 rounded-full flex items-center justify-center transition-colors shadow-xl">
                 <Phone className="w-8 h-8 rotate-[135deg]" />
               </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modals & Panels */}
      {fullscreenMedia && createPortal(
          <div 
            className="fixed inset-0 z-[400] flex items-center justify-center bg-background pointer-events-auto animate-in fade-in duration-200"
            onClick={(e) => {
               if (e.target === e.currentTarget) {
                 setFullscreenMedia(null);
               }
            }}
          >
            <button
              onClick={() => setFullscreenMedia(null)}
              className="absolute top-4 right-4 z-[410] text-white p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-8 h-8 drop-shadow-md" />
            </button>
            
            {fullscreenMedia.items.length > 1 && fullscreenMedia.mediaIndex > 0 && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenMedia(prev => prev ? { ...prev, mediaIndex: prev.mediaIndex - 1 } : null);
                }}
                className="absolute left-4 z-[410] text-white p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <ChevronLeft className="w-10 h-10 drop-shadow-md" />
              </button>
            )}

            <div className="w-full h-full flex flex-col items-center justify-center p-4 relative">
              <div className="relative max-w-full max-h-[85vh] flex items-center justify-center overflow-hidden rounded-xl border border-white/10 shadow-2xl bg-black">
                {/* Float details header overlay */}
                {(() => {
                  const currentItem = fullscreenMedia.items[fullscreenMedia.mediaIndex];
                  if (!currentItem.title && !currentItem.caption) return null;
                  return (
                    <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-20 flex items-center gap-3">
                      {currentItem.avatarUrl && (
                        <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20 shrink-0">
                          <img src={currentItem.avatarUrl || undefined} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex flex-col leading-none">
                        <span className="text-white font-bold text-sm drop-shadow">{currentItem.title || 'User'}</span>
                        {currentItem.caption && (
                          <span className="text-zinc-300 text-xs mt-1 font-medium drop-shadow-sm truncate max-w-[240px] sm:max-w-md">
                            {currentItem.caption}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {fullscreenMedia.items[fullscreenMedia.mediaIndex].isVideo ? (
                  <video
                    key={`vid-${fullscreenMedia.mediaIndex}`}
                    src={fullscreenMedia.items[fullscreenMedia.mediaIndex].url || undefined}
                    className="max-w-full max-h-[80vh] object-contain"
                    onError={handleMediaError as any}
                    onCanPlay={(e) => { try { e.currentTarget.play().catch(() => {}); } catch(err) {} }}
                    controls
                    autoPlay
                    loop
                    playsInline
                  />
                ) : (
                  <img
                    key={`img-${fullscreenMedia.mediaIndex}`}
                    src={fullscreenMedia.items[fullscreenMedia.mediaIndex].url || undefined}
                    className="max-w-full max-h-[80vh] object-contain"
                    alt={`Fullscreen media ${fullscreenMedia.mediaIndex + 1}`}
                    onError={handleMediaError}
                  />
                )}

                {/* If there is a shared audio track, play it or render revolving badge */}
                {(() => {
                  const currentItem = fullscreenMedia.items[fullscreenMedia.mediaIndex];
                  if (!currentItem.isAudio || !currentItem.name) return null;
                  return (
                    <div className="absolute bottom-4 right-4 bg-black/80 border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 z-20 backdrop-blur-md shadow-lg animate-pulse">
                      <Music className="w-4 h-4 text-primary animate-spin" />
                      <span className="text-[11px] text-zinc-100 font-bold">{currentItem.name}</span>
                    </div>
                  );
                })()}
              </div>

              {fullscreenMedia.items.length > 1 && (
                 <div className="absolute bottom-6 flex gap-2">
                   {fullscreenMedia.items.map((_, idx) => (
                      <div key={idx} className={`w-2 h-2 rounded-full transition-colors ${idx === fullscreenMedia.mediaIndex ? 'bg-white' : 'bg-white/40'}`} />
                   ))}
                 </div>
              )}
            </div>
            
            {fullscreenMedia.items.length > 1 && fullscreenMedia.mediaIndex < fullscreenMedia.items.length - 1 && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenMedia(prev => prev ? { ...prev, mediaIndex: prev.mediaIndex + 1 } : null);
                }}
                className="absolute right-4 z-[410] text-white p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <ChevronRight className="w-10 h-10 drop-shadow-md" />
              </button>
            )}
          </div>,
          document.body
      )}

      <AnimatePresence>
        {showNewMessageModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background p-4">
            <div className="absolute inset-0" onClick={() => setShowNewMessageModal(false)}></div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-[400px] h-[60vh] max-h-[500px] flex flex-col rounded-[24px] overflow-hidden shadow-2xl border border-border relative z-10">
              <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
                 <h2 className="font-bold text-lg">New Message</h2>
                 <button onClick={() => setShowNewMessageModal(false)} className="hover:bg-background p-1.5 rounded-full"><Plus className="w-6 h-6 rotate-45" /></button>
              </div>
              <div className="p-4 border-b border-border">
                <input type="text" placeholder="Search people..." className="w-full bg-secondary outline-none px-4 py-2 rounded-xl text-sm font-medium" />
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                 {USERS.map(u => (
                   <div key={u.id} onClick={() => { setSelectedChatId(u.id); setShowNewMessageModal(false); }} className="flex items-center gap-3 p-3 hover:bg-secondary/50 rounded-xl cursor-pointer transition-colors">
                     <img src={u.avatarUrl || undefined} alt="avatar" className="w-12 h-12 rounded-full border border-border" onError={handleAvatarError} />
                     <div className="flex flex-col">
                       <span className="font-bold text-[14px]">{u.displayName}</span>
                       <span className="text-xs text-muted-foreground">{u.username}</span>
                     </div>
                   </div>
                 ))}
              </div>
            </motion.div>
          </div>
        )}

        {showNewGroupModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background p-4">
            <div className="absolute inset-0" onClick={() => setShowNewGroupModal(false)}></div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-[400px] flex flex-col rounded-[24px] overflow-hidden shadow-2xl border border-border relative z-10">
              <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
                 <h2 className="font-bold text-lg">Create Group</h2>
                 <button onClick={() => setShowNewGroupModal(false)} className="hover:bg-background p-1.5 rounded-full"><Plus className="w-6 h-6 rotate-45" /></button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <input 
                  type="text" 
                  value={newGroupName} 
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Group Name" 
                  className="w-full bg-secondary outline-none px-4 py-3 rounded-xl text-sm font-medium" 
                />
                <button 
                  disabled={!newGroupName.trim()}
                  onClick={() => { 
                    if (!newGroupName.trim()) return;
                    const newId = `group_${Date.now()}`;
                    setGroups(prev => [...prev, {
                      id: newId,
                      displayName: newGroupName,
                      username: '1 member',
                      avatarUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100',
                      isGroup: true
                    }]);
                    setSelectedChatId(newId);
                    setNewGroupName('');
                    setShowNewGroupModal(false); 
                    showToast('Group created'); 
                  }} 
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
              className="w-full max-w-[350px] bg-card h-full flex flex-col shadow-2xl z-10 border-l border-border relative overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
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
                <button onClick={() => { setShowInfoPanel(false); showToast('Reported'); }} className="text-red-500 font-bold p-3 text-left hover:bg-secondary/50 rounded-xl transition-colors">Report...</button>
                <button onClick={() => { setShowInfoPanel(false); setSelectedChatId(null); showToast('Blocked and removed from recents'); }} className="text-red-500 font-bold p-3 text-left hover:bg-secondary/50 rounded-xl transition-colors">Block Contact</button>
              </div>
            </motion.div>
          </div>
        )}

        <LocationPickerModal
          isOpen={showLocationPicker}
          onClose={() => setShowLocationPicker(false)}
          onLocationSelect={handleLocationSelected}
        />
      </AnimatePresence>
    </div>
  );
}
