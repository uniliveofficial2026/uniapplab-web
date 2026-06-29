import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { 
  MessageSquare, Send, Users, Compass, Link as LinkIcon, 
  Sparkles, Check, AlertCircle, Plus, Info
} from 'lucide-react';
import { handleAvatarError } from '../../lib/utils';

interface ChatSpace {
  name: string;
  displayName: string;
  spaceType: string;
  singleUserBotDm?: boolean;
}

interface ChatMessage {
  id: string;
  text: string;
  senderName: string;
  senderAvatar?: string;
  createdAt: string;
  isSelf: boolean;
}

export function GoogleChatTab() {
  const { user, googleAccessToken, loginWithGoogle } = useAuth();
  const [spaces, setSpaces] = useState<ChatSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<ChatSpace | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorInput, setErrorInput] = useState<string | null>(null);
  
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
    if (!newMessage.trim() || !selectedSpace) return;

    const userDisplayName = user?.displayName || user?.email?.split('@')[0] || 'Me';
    const userPhoto = user?.photoURL || undefined;

    const currentMsgText = newMessage;
    setNewMessage('');

    // Create the message object
    const pendingMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      text: currentMsgText,
      senderName: userDisplayName,
      senderAvatar: userPhoto,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true
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
          // Reload messages
          fetchRealMessages(selectedSpace.name);
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
      <div className="w-full md:w-80 border-r border-border bg-secondary/15 flex flex-col h-1/3 md:h-full">
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

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Loading physical API spaces...
            </div>
          )}
          {spaces.map(space => {
            const isSelected = selectedSpace?.name === space.name;
            return (
              <button
                key={space.name}
                onClick={() => handleSelectSpace(space)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-semibold text-left text-xs ${
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
      <div className="flex-1 flex flex-col h-2/3 md:h-full bg-card">
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
                    {!msg.isSelf && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary uppercase font-bold text-[10px] flex items-center justify-center shrink-0 border border-primary/20">
                        {msg.senderName.slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-[11px] font-bold text-foreground">
                          {msg.isSelf ? 'You' : msg.senderName}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {msg.createdAt}
                        </span>
                      </div>
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                        msg.isSelf 
                          ? 'bg-primary text-primary-foreground rounded-tr-none' 
                          : 'bg-card border border-border rounded-tl-none text-foreground'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Compose Chat Form */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-card flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder={`Message ${selectedSpace.displayName}...`}
                className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="p-2.5 bg-primary text-primary-foreground hover:bg-primary/95 font-bold rounded-xl shadow transition-all disabled:opacity-50 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
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
