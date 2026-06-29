import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useDB } from '../../lib/useDB';
import { 
  MessageSquare, Send, Users, Compass, Link as LinkIcon, 
  Sparkles, Check, AlertCircle, Plus, Info, Paperclip, X, FileText, Download
} from 'lucide-react';
import { handleAvatarError, handleMediaError, fileToBase64 } from '../../lib/utils';

interface ChatSpace {
  name: string;
  displayName: string;
  spaceType: string;
  singleUserBotDm?: boolean;
}

interface ChatAttachment {
  id: string;
  url: string;
  name: string;
  mime: string;
  size: number;
  isImage: boolean;
  isVideo: boolean;
}

interface ChatMessage {
  id: string;
  text: string;
  senderName: string;
  senderAvatar?: string;
  createdAt: string;
  isSelf: boolean;
  attachments?: ChatAttachment[];
}

export function GoogleChatTab() {
  const { user, googleAccessToken, loginWithGoogle } = useAuth();
  const db = useDB();
  const USERS = db.users ?? [];

  /** Deterministically map a sender name to an avatar from the user pool. */
  const avatarForName = (name: string): string | undefined => {
    if (USERS.length === 0) return undefined;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return USERS[hash % USERS.length]?.avatarUrl;
  };

  const [spaces, setSpaces] = useState<ChatSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<ChatSpace | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorInput, setErrorInput] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  };

  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB per file

  const handleAttachUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const selected = Array.from(files);
    const tooLarge = selected.filter((f) => f.size > MAX_ATTACHMENT_BYTES);
    const allowed = selected.filter((f) => f.size <= MAX_ATTACHMENT_BYTES);
    if (tooLarge.length > 0) {
      setErrorInput(`Skipped ${tooLarge.length} file(s) over 10 MB.`);
      setTimeout(() => setErrorInput(null), 4000);
    }
    if (allowed.length === 0) {
      e.target.value = '';
      return;
    }
    try {
      const items = await Promise.all(
        allowed.map(async (file) => {
          const url = await fileToBase64(file);
          return {
            id: Math.random().toString(36).substring(2, 9),
            url,
            name: file.name,
            mime: file.type,
            size: file.size,
            isImage: file.type.startsWith('image/'),
            isVideo: file.type.startsWith('video/') || /\.(mp4|mov|webm|ogg|m4v|avi)$/i.test(file.name),
          } as ChatAttachment;
        })
      );
      setPendingAttachments((prev) => [...prev, ...items]);
    } catch (err) {
      console.error('Error attaching files to chat', err);
    } finally {
      e.target.value = '';
    }
  };

  const removeAttachment = (id: string) =>
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));

  useEffect(() => {
    if (!fullscreenImage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreenImage(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreenImage]);
  
  // Simulated channels for fallback/mock
  const [mockSpaces] = useState<ChatSpace[]>([
    { name: 'spaces/dev_updates', displayName: '#development-updates', spaceType: 'ROOM' },
    { name: 'spaces/design_critique', displayName: '#design-critique', spaceType: 'SPACE' },
    { name: 'spaces/general_chat', displayName: '#general-workspace', spaceType: 'SPACE' }
  ]);
  
  const [mockMessages, setMockMessages] = useState<Record<string, ChatMessage[]>>({
    'spaces/dev_updates': [
      { id: '1', text: 'Hey team, I just pushed the new database schema update!', senderName: 'Alex Mercer', createdAt: '10:42 AM', isSelf: false },
      { id: '2', text: 'Excellent work, Alex. Let\'s verify the indexing on the users table.', senderName: 'Sarah Connor', createdAt: '10:45 AM', isSelf: false },
    ],
    'spaces/design_critique': [
      { id: '1', text: 'What do you guys think of the new dashboard typography pairings?', senderName: 'Elena Rostova', createdAt: 'Yesterday', isSelf: false },
      { id: '2', text: 'Space Grotesk looks incredibly clean! Fits the modern brand perfectly.', senderName: 'Sarah Connor', createdAt: 'Yesterday', isSelf: false },
    ],
    'spaces/general_chat': [
      { id: '1', text: 'Welcome everyone to the new unilive-ryz8n6 coordination portal!', senderName: 'System Bot', createdAt: 'Jun 2', isSelf: false },
    ]
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Space choosing
  const handleSelectSpace = (space: ChatSpace) => {
    setSelectedSpace(space);
    setPendingAttachments([]);
    if (space.name.startsWith('spaces/')) {
      // Load mock messages
      setMessages(mockMessages[space.name] || []);
    } else {
      // Real spaces messages list
      fetchRealMessages(space.name);
    }
  };

  // Fetch real Google Chat spaces if token exists
  useEffect(() => {
    if (googleAccessToken) {
      fetchRealChatSpaces();
    } else {
      setSpaces(mockSpaces);
      setSelectedSpace(mockSpaces[0]);
      setMessages(mockMessages[mockSpaces[0].name] || []);
    }
  }, [googleAccessToken]);

  const fetchRealChatSpaces = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://chat.googleapis.com/v1/spaces', {
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Accept': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.spaces && data.spaces.length > 0) {
          setSpaces(data.spaces);
          setSelectedSpace(data.spaces[0]);
          fetchRealMessages(data.spaces[0].name);
        } else {
          // Fall back to mocks but indicate connected status
          setSpaces(mockSpaces);
          setSelectedSpace(mockSpaces[0]);
          setMessages(mockMessages[mockSpaces[0].name] || []);
        }
      } else {
        // Fallback gracefully
        setSpaces(mockSpaces);
        setSelectedSpace(mockSpaces[0]);
        setMessages(mockMessages[mockSpaces[0].name] || []);
      }
    } catch (err) {
      console.error('Error fetching Google Chat spaces:', err);
      setSpaces(mockSpaces);
      setSelectedSpace(mockSpaces[0]);
      setMessages(mockMessages[mockSpaces[0].name] || []);
    } finally {
      setLoading(false);
    }
  };

  const fetchRealMessages = async (spaceName: string) => {
    if (!googleAccessToken) return;
    try {
      // Note: Google Chat API lists messages in a space
      const response = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages?pageSize=20`, {
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Accept': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.messages) {
          const formatted: ChatMessage[] = data.messages.map((m: any) => ({
            id: m.name,
            text: m.text || '',
            senderName: m.sender?.displayName || 'Workspace User',
            senderAvatar: m.sender?.avatarUrl,
            createdAt: new Date(m.createTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSelf: m.sender?.name === user?.uid
          }));
          setMessages(formatted);
        } else {
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && pendingAttachments.length === 0) || !selectedSpace) return;

    const userDisplayName = user?.displayName || user?.email?.split('@')[0] || 'Me';
    const userPhoto = user?.photoURL || undefined;

    const currentMsgText = newMessage;
    const currentAttachments = pendingAttachments;
    setNewMessage('');
    setPendingAttachments([]);

    // Create the message object
    const pendingMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      text: currentMsgText,
      senderName: userDisplayName,
      senderAvatar: userPhoto,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    };

    // If mock space
    if (selectedSpace.name.startsWith('spaces/')) {
      const updatedMessages = [...messages, pendingMsg];
      setMessages(updatedMessages);
      setMockMessages(prev => ({
        ...prev,
        [selectedSpace.name]: updatedMessages
      }));

      // Simulate bot answers
      setTimeout(() => {
        const bots = ['Elena Rostova', 'Sarah Connor', 'Alex Mercer'];
        const randomBot = bots[Math.floor(Math.random() * bots.length)];
        const answers = [
          'Agreed! Let\'s synchronize our efforts here.',
          'That matches our requirements. I will review the milestones shortly.',
          'Got it! Just updated our workspace backlog with this note.',
          'Awesome implementation. Can we check the accessibility contrast on that view?',
          'Looks fantastic. I will run a build review in a couple of minutes.'
        ];
        const randomAnswer = answers[Math.floor(Math.random() * answers.length)];

        const botMsg: ChatMessage = {
          id: Math.random().toString(36).substring(2, 9),
          text: randomAnswer,
          senderName: randomBot,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSelf: false
        };

        setMessages(prev => {
          const newThread = [...prev, botMsg];
          setMockMessages(mockPrev => ({
            ...mockPrev,
            [selectedSpace.name]: newThread
          }));
          return newThread;
        });
      }, 1500);

    } else {
      // Real Google Chat API call to send message
      try {
        const response = await fetch(`https://chat.googleapis.com/v1/${selectedSpace.name}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text: currentMsgText })
        });
        if (response.ok) {
          if (pendingMsg.attachments) {
            // The Chat API doesn't store our local attachment previews, so keep
            // the message client-side instead of refetching (which would drop them).
            setMessages(prev => [...prev, pendingMsg]);
          } else {
            // Reload messages
            fetchRealMessages(selectedSpace.name);
          }
        } else {
          setErrorInput('Could not post message to real Google Chat. Showing as local-only.');
          setMessages(prev => [...prev, pendingMsg]);
          setTimeout(() => setErrorInput(null), 4000);
        }
      } catch (err) {
        console.error('Error posting message to Google Chat:', err);
        setMessages(prev => [...prev, pendingMsg]);
      }
    }
  };

  return (
    <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row h-[550px]">
      
      {/* Space sidebar */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border bg-secondary/15 flex flex-col md:h-full shrink-0">
        <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/5">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm">Google Chat Spaces</span>
          </div>
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
            googleAccessToken ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
          }`}>
            {googleAccessToken ? 'Linked' : 'Simulated'}
          </span>
        </div>

        {/* Auth CTA Banner */}
        {!googleAccessToken && (
          <div className="p-3 bg-primary/5 border-b border-border text-xs flex flex-col gap-2">
            <p className="text-muted-foreground flex items-start gap-1">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              Connect your professional Google Workspace account to sync live Google Chat Spaces and spaces thread updates.
            </p>
            <button 
              onClick={loginWithGoogle} 
              className="bg-primary/95 text-primary-foreground hover:bg-primary py-1 px-3 rounded-lg font-bold text-[11px] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" /> Link Google Account
            </button>
          </div>
        )}

        <div className="flex flex-row md:flex-col gap-1 md:gap-0 md:space-y-1 overflow-x-auto md:overflow-x-visible md:overflow-y-auto p-2 md:flex-1 no-scrollbar">
          {loading && (
            <div className="text-center py-8 text-xs text-muted-foreground w-full">
              Loading physical API spaces...
            </div>
          )}
          {spaces.map(space => {
            const isSelected = selectedSpace?.name === space.name;
            return (
              <button
                key={space.name}
                onClick={() => handleSelectSpace(space)}
                className={`shrink-0 w-48 md:w-full flex items-center gap-3 p-3 rounded-xl transition-all font-semibold text-left text-xs ${
                  isSelected 
                    ? 'bg-foreground text-background shadow-md' 
                    : 'text-foreground hover:bg-secondary/40'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-background/20 text-background' : 'bg-secondary text-primary'}`}>
                  <MessageSquare className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 truncate">
                  <p className="font-bold truncate">{space.displayName || space.name.split('/').pop()}</p>
                  <p className={`text-[10px] ${isSelected ? 'text-background/70' : 'text-muted-foreground'}`}>
                    {space.spaceType || 'ROOM'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main chat window */}
      <div className="flex-1 flex flex-col min-h-0 md:h-full bg-card">
        {selectedSpace ? (
          <>
            {/* Chat header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/5">
              <div>
                <h3 className="font-bold text-sm tracking-tight text-foreground flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  {selectedSpace.displayName || selectedSpace.name.split('/').pop()}
                </h3>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Users className="w-3 h-3" /> Workspace Team Discussion Channel
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">
                  {selectedSpace.name.startsWith('spaces/dev_') ? 'Colleagues: 3 Online' : 'Broadcasting Mode'}
                </span>
              </div>
            </div>

            {/* Error badge */}
            {errorInput && (
              <div className="m-3 p-2 bg-destructive/10 text-destructive text-[11px] rounded-lg font-bold flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" /> {errorInput}
              </div>
            )}

            {/* Messages Pane */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/5">
              {messages.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-xs md:text-sm">
                  <Compass className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                  No messages in this chat space yet.<br />Take the lead and post the first update!
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div 
                    key={msg.id || i}
                    className={`flex gap-3 max-w-[85%] md:max-w-[75%] ${msg.isSelf ? 'ml-auto flex-row-reverse' : ''}`}
                  >
                    {(() => {
                      const avatar = msg.senderAvatar
                        || (msg.isSelf ? (user?.photoURL || db.currentUser?.avatarUrl) : avatarForName(msg.senderName));
                      return avatar ? (
                        <img
                          src={avatar || undefined}
                          alt={msg.isSelf ? 'You' : msg.senderName}
                          onError={handleAvatarError}
                          className="w-8 h-8 rounded-full object-cover shrink-0 border border-border bg-secondary"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary uppercase font-bold text-[10px] flex items-center justify-center shrink-0 border border-primary/20">
                          {msg.senderName.slice(0, 2)}
                        </div>
                      );
                    })()}
                    <div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-[11px] font-bold text-foreground">
                          {msg.isSelf ? 'You' : msg.senderName}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {msg.createdAt}
                        </span>
                      </div>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className={`flex flex-col gap-2 mb-1 ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                          {msg.attachments.map(att => (
                            att.isImage ? (
                              <img
                                key={att.id}
                                src={att.url || undefined}
                                alt={att.name}
                                onError={handleMediaError}
                                onClick={() => setFullscreenImage(att.url)}
                                className="max-w-[200px] max-h-[200px] rounded-xl object-cover cursor-pointer border border-border shadow-sm"
                              />
                            ) : att.isVideo ? (
                              <video
                                key={att.id}
                                src={att.url || undefined}
                                controls
                                playsInline
                                className="max-w-[220px] max-h-[200px] rounded-xl border border-border shadow-sm bg-black"
                              />
                            ) : (
                              <a
                                key={att.id}
                                href={att.url}
                                download={att.name}
                                className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary/60 transition-colors max-w-[220px] text-foreground"
                              >
                                <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold truncate">{att.name}</p>
                                  <p className="text-[9px] text-muted-foreground">{formatBytes(att.size)}</p>
                                </div>
                                <Download className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              </a>
                            )
                          ))}
                        </div>
                      )}
                      {msg.text && (
                        <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                          msg.isSelf 
                            ? 'bg-primary text-primary-foreground rounded-tr-none' 
                            : 'bg-card border border-border rounded-tl-none text-foreground'
                        }`}>
                          {msg.text}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Compose Chat Form */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-card flex flex-col gap-2">
              {pendingAttachments.length > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {pendingAttachments.map(att => (
                    <div key={att.id} className="relative shrink-0">
                      {att.isImage ? (
                        <img src={att.url || undefined} alt={att.name} onError={handleMediaError} className="w-16 h-16 rounded-lg object-cover border border-border" />
                      ) : att.isVideo ? (
                        <video src={att.url || undefined} className="w-16 h-16 rounded-lg object-cover border border-border bg-black" muted playsInline />
                      ) : (
                        <div className="w-16 h-16 rounded-lg border border-border bg-secondary/50 flex flex-col items-center justify-center p-1 gap-1">
                          <FileText className="w-5 h-5 text-primary" />
                          <span className="text-[8px] font-bold text-muted-foreground truncate max-w-[56px] px-0.5">{att.name}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        aria-label={`Remove ${att.name}`}
                        className="absolute -top-1.5 -right-1.5 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-black/90 shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={attachInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleAttachUpload}
                />
                <button
                  type="button"
                  onClick={() => attachInputRef.current?.click()}
                  className="p-2.5 bg-secondary/50 text-foreground hover:bg-secondary border border-border rounded-xl transition-colors shrink-0"
                  title="Attach files"
                  aria-label="Attach files"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder={`Message ${selectedSpace.displayName}...`}
                  className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() && pendingAttachments.length === 0}
                  aria-label="Send message"
                  className="p-2.5 bg-primary text-primary-foreground hover:bg-primary/95 font-bold rounded-xl shadow transition-all disabled:opacity-50 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Attachment fullscreen viewer */}
            {fullscreenImage && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Attachment preview"
                className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setFullscreenImage(null)}
              >
                <img
                  src={fullscreenImage || undefined}
                  alt="attachment"
                  onClick={(e) => e.stopPropagation()}
                  className="max-w-full max-h-full rounded-xl object-contain"
                />
                <button
                  type="button"
                  onClick={() => setFullscreenImage(null)}
                  aria-label="Close preview"
                  className="absolute top-4 right-4 bg-white/10 text-white rounded-full w-9 h-9 flex items-center justify-center hover:bg-white/20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
            <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="font-bold text-sm">Select or create a room to begin messaging.</p>
          </div>
        )}
      </div>

    </div>
  );
}
