import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { 
  Mail, Send, Search, Trash2, ArrowUpRight, Plus, X, 
  Star, AlertCircle, RefreshCw, CheckCircle2, Inbox, 
  ChevronRight, Reply, Users
} from 'lucide-react';

interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  starred: boolean;
  body?: string;
}

export function GmailTab() {
  const { googleAccessToken, loginWithGoogle } = useAuth();
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMsg, setSelectedMsg] = useState<GmailMessage | null>(null);
  
  // Compose modal state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [toInput, setToInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [bodyInput, setBodyInput] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fallback / seed messages if not linked to a live account yet
  const seedMessages: GmailMessage[] = [
    {
      id: 'g1',
      threadId: 't1',
      from: 'Google workspace-alerts@google.com',
      subject: 'Scope Access Granted: Project unilive-ryz8n6',
      snippet: 'Google Cloud Platform has successfully completed security authorization of the workspace scopes requested.',
      date: new Date(Date.now() - 1000 * 60 * 45).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      unread: true,
      starred: true,
      body: 'Hello Team,\n\nWe are pleased to inform you that the security configuration for project "unilive-ryz8n6" has been completed. The scopes for Calendar, Mail, People, and Drive are active.\n\nBest,\nGoogle Cloud Identity Team'
    },
    {
      id: 'g2',
      threadId: 't2',
      from: 'Sarah Lin <sarah.lin@unilive.co>',
      subject: 'Updated Deliverables & Meet Agenda',
      snippet: 'Please find attached the high-fidelity designs for the database and Firebase.rules audit. Let’s sync via Meet.',
      date: 'Yesterday',
      unread: false,
      starred: false,
      body: 'Hi Alice,\n\nI’ve uploaded the Figma design files and updated our team backlog. We should do a call on Google Meet to review. Let me know what slot works for you!\n\nBest,\nSarah'
    },
    {
      id: 'g3',
      threadId: 't3',
      from: 'Firebase Billing <noreply@firebase.google.com>',
      subject: 'Security rules successfully deployed - Spark Plan',
      snippet: 'Your Firestore database security rules have been parsed, validated by ESLint, and compiled to production successfully.',
      date: 'May 31',
      unread: false,
      starred: true,
      body: 'Hey unilive Developer,\n\nCongratulations! Your Firestore and Firebase security rules are now active on the Spark Plan. Rate limiting and attribute-based security parameters are fully active.\n\n- Project ID: unilive-ryz8n6\n- Database ID: default'
    }
  ];

  const fetchEmails = async () => {
    if (!googleAccessToken) {
      setMessages(seedMessages);
      return;
    }
    setLoading(true);
    try {
      // 1. Fetch message list
      const listUrl = searchQuery 
        ? `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${encodeURIComponent(searchQuery)}`
        : `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=10`;
        
      const res = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      
      if (!res.ok) {
        throw new Error('Failed to retrieve inbox list');
      }
      
      const listData = await res.json();
      if (!listData.messages || listData.messages.length === 0) {
        setMessages([]);
        setLoading(false);
        return;
      }

      // 2. Fetch details for each message in parallel
      const detailedMsgs = await Promise.all(
        listData.messages.map(async (m: { id: string; threadId: string }) => {
          try {
            const detailRes = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, {
              headers: { Authorization: `Bearer ${googleAccessToken}` }
            });
            if (!detailRes.ok) return null;
            const detailData = await detailRes.json();
            
            // Extract headers
            const headers = detailData.payload.headers;
            const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
            const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
            const dateStr = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
            
            // Extract snippet and simple body parse
            const snippet = detailData.snippet || '';
            const unread = detailData.labelIds?.includes('UNREAD') || false;
            const starred = detailData.labelIds?.includes('STARRED') || false;
            
            // Clean up date a bit
            let displayDate = dateStr;
            try {
              displayDate = new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
            } catch (e) {}

            return {
              id: m.id,
              threadId: m.threadId,
              from,
              subject,
              snippet,
              date: displayDate,
              unread,
              starred,
              body: detailData.snippet // Use snippet as body for simple display, or can recurse parts
            };
          } catch (e) {
            return null;
          }
        })
      );

      setMessages(detailedMsgs.filter(m => m !== null) as GmailMessage[]);
    } catch (e) {
      console.error('Error fetching Gmail data', e);
      // Fallback
      setMessages(seedMessages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [googleAccessToken]);

  const handleCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toInput.trim() || !subjectInput.trim() || !bodyInput.trim()) return;
    setSending(true);
    setStatusMessage(null);

    // If client is logged in with real OAuth
    if (googleAccessToken) {
      try {
        const mailRFC822 = [
          `To: ${toInput}`,
          `Subject: ${subjectInput}`,
          `Content-Type: text/plain; charset="UTF-8"`,
          ``,
          bodyInput
        ].join('\n');

        // Safe Base64 encoding for URL/Filename safe RF822
        const base64Mail = btoa(unescape(encodeURIComponent(mailRFC822)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: base64Mail })
        });

        if (res.ok) {
          setStatusMessage({ type: 'success', text: 'Email successfully sent via Gmail!' });
          setToInput('');
          setSubjectInput('');
          setBodyInput('');
          setTimeout(() => setIsComposeOpen(false), 2000);
          fetchEmails();
        } else {
          throw new Error('API server rejected message draft');
        }
      } catch (e: any) {
        setStatusMessage({ type: 'error', text: e.message || 'Failed to dispatch email.' });
      } finally {
        setSending(false);
      }
    } else {
      // Mock flow with visual success
      setTimeout(() => {
        setStatusMessage({ type: 'success', text: 'Mock email sent successfully (Link Google account for live email sending).' });
        
        // Add to mock list locally for gorgeous interactive feedback
        const mockNew: GmailMessage = {
          id: 'mock-' + Date.now(),
          threadId: 'thread-' + Date.now(),
          from: 'Me <you@unilive.co>',
          subject: subjectInput,
          snippet: bodyInput.slice(0, 80) + '...',
          date: 'Just now',
          unread: false,
          starred: false,
          body: bodyInput
        };
        setMessages(prev => [mockNew, ...prev]);

        setToInput('');
        setSubjectInput('');
        setBodyInput('');
        setTimeout(() => {
          setIsComposeOpen(false);
          setStatusMessage(null);
        }, 2200);
        setSending(false);
      }, 1000);
    }
  };

  const handleDeleteEmail = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm('Are you sure you want to delete this email permanently? This action cannot be undone.');
    if (!confirmed) return;

    if (googleAccessToken) {
      try {
        const res = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${id}/trash`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${googleAccessToken}` }
        });
        if (res.ok) {
          setMessages(prev => prev.filter(m => m.id !== id));
          if (selectedMsg?.id === id) setSelectedMsg(null);
        } else {
          throw new Error('Failed to move message to Trash');
        }
      } catch (err: any) {
        alert(err.message || 'Error deleting email.');
      }
    } else {
      // Offline local delete
      setMessages(prev => prev.filter(m => m.id !== id));
      if (selectedMsg?.id === id) setSelectedMsg(null);
    }
  };

  const handleToggleStar = async (msg: GmailMessage, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Toggle state locally first for immediate responsiveness
    const newStar = !msg.starred;
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, starred: newStar } : m));
    if (selectedMsg?.id === msg.id) {
      setSelectedMsg(prev => prev ? { ...prev, starred: newStar } : null);
    }

    if (googleAccessToken) {
      try {
        await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}/modify`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            addLabelIds: newStar ? ['STARRED'] : [],
            removeLabelIds: newStar ? [] : ['STARRED']
          })
        });
      } catch (err) {
        console.error('Failed to update star label in Gmail account', err);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px]">
      
      {/* Inbox Panel (Lists emails) */}
      <div className={`border border-border bg-card rounded-2xl shadow-sm flex flex-col overflow-hidden ${selectedMsg ? 'lg:col-span-5 hidden lg:flex' : 'lg:col-span-12'}`}>
        
        {/* Panel Header */}
        <div className="p-4 border-b border-border bg-secondary/5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-500/10 rounded-xl text-red-500">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                Gmail Inbox 
                {googleAccessToken && <span className="bg-emerald-500/10 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold">Live Synced</span>}
              </h3>
              <p className="text-[11px] text-muted-foreground">Interact with your mail feed dynamically</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsComposeOpen(true)}
              className="px-3.5 py-1.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Compose
            </button>
            <button 
              onClick={fetchEmails}
              disabled={loading}
              className="p-2 border border-border hover:bg-secondary/40 text-muted-foreground hover:text-foreground rounded-xl"
              title="Refresh Emails"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Searching */}
        <div className="p-3 border-b border-border bg-card flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search conversations by keywords..."
              className="w-full bg-secondary/45 border border-border rounded-xl pl-9 p-1.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/55"
              onKeyDown={e => e.key === 'Enter' && fetchEmails()}
            />
          </div>
        </div>

        {/* Account Linking status bar if not logged in */}
        {!googleAccessToken && (
          <div className="p-3 bg-primary/5 border-b border-primary/10 text-[11px] font-semibold text-foreground flex justify-between items-center gap-3">
            <span>Accessing mock inbox. Link Google Account to fetch your real Gmail.</span>
            <button 
              onClick={loginWithGoogle}
              className="bg-primary hover:bg-primary/95 text-primary-foreground text-[10px] py-1 px-3 rounded-lg font-bold shadow-sm whitespace-nowrap"
            >
              Link Account
            </button>
          </div>
        )}

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60 max-h-[480px]">
          {loading ? (
            <div className="text-center py-20 text-xs text-muted-foreground font-medium">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-3" />
              Fetching message body packages...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-24 text-muted-foreground">
              <Inbox className="w-8 h-8 mx-auto stroke-1 mb-3 text-muted-foreground/60" />
              <p className="text-xs font-bold">Mailbox is completely clear.</p>
              <p className="text-[10px] text-muted-foreground/75 mt-0.5">Any correspondence will show up here.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div 
                key={msg.id}
                onClick={() => setSelectedMsg(msg)}
                className={`flex gap-3 p-3.5 hover:bg-secondary/25 cursor-pointer transition-colors relative ${msg.unread ? 'bg-primary/5 border-l-2 border-primary' : ''} ${selectedMsg?.id === msg.id ? 'bg-secondary/20' : ''}`}
              >
                <button 
                  onClick={(e) => handleToggleStar(msg, e)}
                  className="mt-0.5 text-muted-foreground hover:text-amber-500 shrink-0 self-start"
                >
                  <Star className={`w-4 h-4 ${msg.starred ? 'fill-amber-400 text-amber-500' : ''}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <span className={`text-xs truncate text-foreground ${msg.unread ? 'font-black' : 'font-semibold'}`}>
                      {msg.from.split('<')[0].trim() || msg.from}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold shrink-0 ml-1">
                      {msg.date}
                    </span>
                  </div>
                  <h4 className={`text-xs text-foreground truncate mb-1 ${msg.unread ? 'font-bold' : 'font-medium'}`}>
                    {msg.subject}
                  </h4>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {msg.snippet}
                  </p>
                </div>
                
                {/* Trash icon trigger */}
                <button 
                  onClick={(e) => handleDeleteEmail(msg.id, e)}
                  className="absolute right-3 bottom-3 p-1.5 rounded bg-secondary hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 lg:hover:opacity-100 transition-all"
                  title="Move to Trash"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Message Reader Panel */}
      {selectedMsg && (
        <div className="lg:col-span-7 border border-border bg-card rounded-2xl shadow-sm flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
          
          {/* Reader Header */}
          <div className="p-3.5 border-b border-border bg-secondary/5 flex justify-between items-center gap-3">
            <button 
              onClick={() => setSelectedMsg(null)}
              className="lg:hidden p-1 rounded-lg hover:bg-secondary text-muted-foreground"
            >
              <X className="w-4 h-4" /> Back to Inbox
            </button>
            <div className="hidden lg:block text-xs font-bold text-muted-foreground">
              Conversation Thread
            </div>
            <div className="flex gap-1.5 ml-auto">
              <button 
                onClick={(e) => handleToggleStar(selectedMsg!, e)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-amber-500"
              >
                <Star className={`w-4 h-4 ${selectedMsg.starred ? 'fill-amber-400 text-amber-500' : ''}`} />
              </button>
              <button 
                onClick={(e) => handleDeleteEmail(selectedMsg.id, e)}
                className="p-1.5 rounded-lg hover:bg-secondary hover:text-destructive text-muted-foreground"
                title="Delete conversations"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setSelectedMsg(null)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Email Header Info */}
          <div className="p-5 border-b border-border">
            <h2 className="text-base font-extrabold text-foreground mb-4">
              {selectedMsg.subject}
            </h2>
            <div className="flex items-center gap-3 text-xs">
              <div className="w-9 h-9 bg-primary/10 text-primary font-bold rounded-full flex items-center justify-center">
                {selectedMsg.from.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 font-medium">
                <p className="text-foreground font-bold truncate">{selectedMsg.from}</p>
                <p className="text-[10px] text-muted-foreground">To: me</p>
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold">
                {selectedMsg.date}
              </div>
            </div>
          </div>

          {/* Email Body */}
          <div className="flex-1 overflow-y-auto p-6 bg-card text-xs text-foreground font-medium leading-relaxed whitespace-pre-wrap max-h-[350px]">
            {selectedMsg.body || selectedMsg.snippet}
          </div>

          {/* Reply / Quick Footer Action */}
          <div className="p-4 border-t border-border bg-secondary/5 flex gap-2">
            <button 
              onClick={() => {
                setToInput(selectedMsg.from.match(/<([^>]+)>/)?.[1] || selectedMsg.from);
                setSubjectInput(`Re: ${selectedMsg.subject}`);
                setBodyInput(`\n\nOn ${selectedMsg.date}, ${selectedMsg.from} wrote:\n> ${selectedMsg.snippet}`);
                setIsComposeOpen(true);
              }}
              className="flex-1 py-2 bg-secondary hover:bg-secondary/85 text-foreground rounded-xl text-xs font-bold border border-border flex items-center justify-center gap-2 transition"
            >
              <Reply className="w-3.5 h-3.5" /> Reply to Thread
            </button>
          </div>
        </div>
      )}

      {/* Compose Email Dialog (Modal) */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setIsComposeOpen(false)}>
          <div className="bg-card border border-border w-full max-w-xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[500px]" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-border bg-secondary/5 flex justify-between items-center bg-card">
              <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" /> New Message
              </h3>
              <button onClick={() => setIsComposeOpen(false)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCompose} className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Recipient *</label>
                <input 
                  type="email" 
                  required
                  placeholder="name@company.com" 
                  value={toInput}
                  onChange={e => setToInput(e.target.value)}
                  className="w-full bg-secondary/30 border border-border rounded-xl p-2 text-xs focus:ring-2 focus:ring-primary/60 outline-none text-foreground font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Subject *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Weekly Updates / Client Review" 
                  value={subjectInput}
                  onChange={e => setSubjectInput(e.target.value)}
                  className="w-full bg-secondary/30 border border-border rounded-xl p-2 text-xs focus:ring-2 focus:ring-primary/60 outline-none text-foreground font-bold"
                />
              </div>

              <div className="space-y-1 flex-1 flex flex-col">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Body</label>
                <textarea 
                  required
                  rows={6}
                  placeholder="Write your email here..." 
                  value={bodyInput}
                  onChange={e => setBodyInput(e.target.value)}
                  className="w-full bg-secondary/30 border border-border rounded-xl p-2 text-xs focus:ring-2 focus:ring-primary/60 outline-none text-foreground font-semibold flex-1 resize-none"
                />
              </div>

              {statusMessage && (
                <div className={`p-3 rounded-lg text-[11px] font-bold flex items-center gap-2 ${
                  statusMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{statusMessage.text}</span>
                </div>
              )}

              <div className="border-t border-border pt-3 flex justify-end gap-2 mt-2">
                <button 
                  type="button" 
                  onClick={() => setIsComposeOpen(false)}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-bold hover:bg-secondary text-muted-foreground"
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  disabled={sending}
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold rounded-xl shadow-md min-w-[80px]"
                >
                  {sending ? 'Sending...' : 'Send Email'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
