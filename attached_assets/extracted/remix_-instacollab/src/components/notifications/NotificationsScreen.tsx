import React, { useState } from 'react';
import { useDB } from '../../lib/useDB';
import { Heart, UserPlus, MessageCircle, AlertCircle, BellRing, CheckCircle2 } from 'lucide-react';
import { handleAvatarError, handleMediaError, openProfilePreview } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function NotificationsScreen() {
  const db = useDB();
  const USERS = db.users;

  const [activeTab, setActiveTab] = useState<'all' | 'mentions'>('all');

  const toggleFollow = (user: any) => {
    db.updateUser(user.id, (u: any) => ({ ...u, isFollowing: !u.isFollowing }));
  };

  const notifications = db.notifications;
  const filteredNotifications = notifications.filter((n: any) => activeTab === 'all' || n.type === 'mention');

  const clearAll = () => {
    // We would need a method in db.ts to clear notifications, let's just use save directly or add it.
    // For now we assume we can call db.save('notifications', []) if we add a method
    db.clearNotifications?.(); 
  };

  return (
    <div className="w-full flex flex-col pt-6 md:pt-10 px-4 md:px-0 max-w-[600px] mx-auto pb-6 min-h-0">
      <div className="flex items-center justify-between mb-6 px-2">
        <h1 className="text-3xl font-black flex items-center gap-3">
          Notifications
          {notifications.length > 0 && (
            <span className="bg-primary/20 text-primary text-sm px-3 py-1 rounded-full font-bold">
              {notifications.length}
            </span>
          )}
        </h1>
        {notifications.length > 0 && (
          <button 
            onClick={clearAll}
            className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" /> Clear All
          </button>
        )}
      </div>
      
      <div className="flex gap-4 mb-6 px-2">
        <button 
          onClick={() => setActiveTab('all')}
          className={`px-4 py-1.5 rounded-full font-bold text-sm transition-colors ${activeTab === 'all' ? 'bg-foreground text-background' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}
        >
          All
        </button>
        <button 
          onClick={() => setActiveTab('mentions')}
          className={`px-4 py-1.5 rounded-full font-bold text-sm transition-colors ${activeTab === 'mentions' ? 'bg-foreground text-background' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}
        >
          Mentions
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {filteredNotifications.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-12 text-center bg-secondary/20 rounded-3xl border border-dashed border-border mt-4"
          >
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mb-4">
               <BellRing className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="font-bold text-lg text-foreground">You're all caught up!</h3>
            <p className="text-sm text-muted-foreground font-semibold mt-1 max-w-[250px]">
              {activeTab === 'mentions' 
                ? "No one has mentioned you recently. When they do, it'll show up here."
                : "No new activity right now. We'll let you know when something happens."}
            </p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
          {filteredNotifications.map((notification: any, idx: number) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ delay: idx * 0.05, duration: 0.2 }}
              key={notification.id} 
              className="flex items-center gap-4 p-3.5 bg-card hover:bg-secondary/30 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-border/50 group"
            >
              
              {notification.type === 'system' ? (
                <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <AlertCircle className="w-6 h-6" />
                </div>
              ) : (
                <div className="relative shrink-0 cursor-pointer group-hover:scale-105 transition-transform" onClick={(e) => { e.stopPropagation(); openProfilePreview(notification.user); }}>
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-border">
                    <img src={notification.user?.avatarUrl || undefined} alt="user" className="w-full h-full object-cover" onError={handleAvatarError} />
                  </div>
                  {notification.type === 'like' && <div className="absolute -bottom-1 -right-1 bg-accent rounded-full p-1 border-2 border-background shadow-sm"><Heart className="w-3 h-3 fill-white stroke-white" /></div>}
                  {notification.type === 'follow' && <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1 border-2 border-background shadow-sm"><UserPlus className="w-3 h-3 fill-white stroke-white" /></div>}
                  {notification.type === 'comment' && <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-background shadow-sm"><MessageCircle className="w-3 h-3 fill-white stroke-white" /></div>}
                </div>
              )}

              <div className="flex flex-col flex-1 min-w-0">
                {notification.type === 'system' ? (
                  <>
                    <span className="text-[14px] font-bold text-foreground truncate">{notification.title}</span>
                    <span className="text-[13px] text-muted-foreground font-semibold truncate">{notification.text}</span>
                  </>
                ) : (
                  <div className="text-[14px] text-foreground leading-snug pr-2">
                    <strong className="font-bold hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); openProfilePreview(notification.user); }}>{notification.user?.username}</strong>
                    <span className="font-medium text-muted-foreground">
                      {notification.type === 'like' && ' liked your post.'}
                      {notification.type === 'follow' && ' started following you.'}
                      {notification.type === 'comment' && ' commented: ' + notification.text}
                      {notification.type === 'mention' && ' ' + (notification.text || 'mentioned you.')}
                      {notification.type === 'message' && ' shared an item with you: ' + notification.text}
                    </span>
                    <div className="text-[11px] text-muted-foreground/80 font-semibold mt-0.5">{notification.time}</div>
                  </div>
                )}
              </div>

              {notification.postImage && (
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-border group-hover:border-primary/30 transition-colors ml-auto">
                  <img src={notification.postImage || undefined} alt="post" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={handleMediaError} />
                </div>
              )}

              {notification.type === 'follow' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleFollow(USERS.find(u => u.id === notification.user?.id) || notification.user); }}
                  className={`ml-auto px-4 py-1.5 font-bold text-xs rounded-lg transition-colors shadow-sm active:scale-95 ${(USERS.find(u => u.id === notification.user?.id) || notification.user).isFollowing ? 'bg-secondary text-foreground hover:bg-secondary/70' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                >
                  {(USERS.find(u => u.id === notification.user?.id) || notification.user).isFollowing ? 'Following' : 'Follow back'}
                </button>
              )}
            </motion.div>
          ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
