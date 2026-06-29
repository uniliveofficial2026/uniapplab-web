import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Link, CheckCircle2, Copy, Search, Check } from 'lucide-react';
import { useToast } from '../../lib/ToastContext';
import { handleAvatarError } from '../../lib/utils';
import { useDB } from '../../lib/useDB';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  itemTitle: string;
  shareText: string;
}

export function ShareModal({ isOpen, onClose, shareUrl, itemTitle, shareText }: ShareModalProps) {
  const db = useDB();
  const { showToast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    selectedUserIds.forEach(userId => {
      db.addMessage(userId, {
        text: `${shareText}: ${shareUrl}`,
        isAuthor: true,
      });
      db.addNotification({
        userId,
        type: 'message',
        text: `New shared item: ${shareText}`,
        link: shareUrl,
      });
    });
    showToast(`Sent to ${selectedUserIds.length} user${selectedUserIds.length > 1 ? 's' : ''}`);
    onClose();
    setSelectedUserIds([]);
  };

  const filteredUsers = db.users.filter((u) => {
    if (u.id === db.currentUser.id) return false;
    if (!searchQuery) return true;
    
    // Remove leading punctuation for flexible searching
    const q = searchQuery.toLowerCase().replace(/^[@#]/, '');
    
    return (
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-background/40 backdrop-blur-[2px] pointer-events-auto"
            onClick={onClose}
          ></div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 relative z-10 pointer-events-auto shadow-xl overflow-hidden"
          >
            <h3 className="text-lg font-bold mb-4 text-center">{itemTitle}</h3>
            
            {/* Search Input */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input 
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-secondary rounded-full py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            <div className="flex gap-4 mb-4 overflow-x-auto no-scrollbar pb-1">
              {filteredUsers.map((u) => {
                  const isSelected = selectedUserIds.includes(u.id);
                  return (
                  <div
                    key={u.id}
                    onClick={() => {
                      setSelectedUserIds(prev => isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]);
                    }}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group min-w-[64px]"
                  >
                    <div className="relative w-14 h-14 rounded-full overflow-hidden shrink-0">
                      <img
                        src={u.avatarUrl || undefined}
                        alt={u.username}
                        className={`w-full h-full object-cover transition-all ${isSelected ? 'opacity-60' : ''}`}
                        onError={handleAvatarError}
                      />
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                          <Check className="w-7 h-7 text-primary" />
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-center truncate w-full px-1">
                      {u.username}
                    </span>
                  </div>
                )})}
            </div>
            
            {/* Send Button */}
            {selectedUserIds.length > 0 && (
              <button
                onClick={handleSend}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold mb-4 hover:opacity-90 transition-opacity"
              >
                Send to {selectedUserIds.length} user{selectedUserIds.length > 1 ? 's' : ''}
              </button>
            )}

            <div className="flex items-center gap-2 p-2.5 bg-secondary rounded-lg border border-border">
              <div className="w-8 h-8 rounded-md bg-card flex items-center justify-center border border-border shrink-0">
                <Link className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 truncate text-xs font-medium text-muted-foreground">
                {shareUrl}
              </div>
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-foreground text-background rounded-md text-xs font-bold shrink-0 hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                {copied ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
