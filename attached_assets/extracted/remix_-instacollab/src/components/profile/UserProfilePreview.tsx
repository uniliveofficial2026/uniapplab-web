import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../../types';
import { Grid, ChevronLeft } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { Avatar } from '../common/Avatar';
import { handleAvatarError, handleMediaError } from '../../lib/utils';

export function UserProfilePreview({ user, onClose }: { user: User, onClose: () => void }) {
  const db = useDB();
  const userPosts = db.posts.filter(p => p.user?.id === user.id);
  
  const isFollowing = user.isFollowing || false;

  const handleFollowToggle = () => {
    db.updateUser(user.id, (u: any) => ({ ...u, isFollowing: !u.isFollowing }));
  };

  return (
    <div className="fixed inset-0 z-[2600] flex items-center justify-center p-4 sm:p-6 pb-20 pointer-events-none">
              <div className="absolute inset-0 bg-background/95 backdrop-blur-md pointer-events-auto" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-sm bg-card rounded-[32px] border border-border shadow-2xl relative z-10 pointer-events-auto overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
           <div className="flex items-center gap-4">
              <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full -ml-2 transition-colors"><ChevronLeft className="w-6 h-6" /></button>
              <h3 className="font-bold text-lg">{user.username}</h3>
           </div>
           <button 
             onClick={() => {
               onClose();
               window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'profile', userId: user.id } }));
             }}
             className="text-xs font-bold text-primary hover:underline hover:text-primary/80 transition-colors"
           >
             View Profile
           </button>
        </div>
        
        <div className="overflow-y-auto no-scrollbar p-6">
          <div 
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'profile', userId: user.id } }));
            }}
            className="flex items-center gap-6 mb-6 cursor-pointer group/avatar"
          >
             <div className="w-20 h-20 shrink-0 shadow-sm group-hover/avatar:opacity-80 transition-opacity">
               <Avatar user={user} size="lg" className="w-full h-full" />
             </div>
             <div className="flex gap-4 flex-1 justify-center">
                <div className="flex flex-col items-center">
                   <span className="font-bold text-lg">{userPosts.length}</span>
                   <span className="text-[12px] text-muted-foreground font-bold font-sans">Posts</span>
                </div>
                <div className="flex flex-col items-center">
                   <span className="font-bold text-lg">{user.followers?.toLocaleString() || '43.2k'}</span>
                   <span className="text-[12px] text-muted-foreground font-bold font-sans">Followers</span>
                </div>
             </div>
          </div>
          
          <div className="mb-6">
             <div className="font-bold text-[15px]">{user.displayName}</div>
             <div className="text-[14px] text-foreground/90 mt-1 whitespace-pre-line">{user.bio || 'Digital creator. Living life to the fullest. ✨ #lifestyle'}</div>
          </div>
          
          <div className="flex gap-3 mb-6">
             {user.id !== db.currentUser.id && (
               <button 
                 onClick={handleFollowToggle}
                 className={`flex-1 py-1.5 font-bold rounded-lg text-sm border transition-colors ${isFollowing ? 'bg-background text-foreground border-border hover:bg-secondary' : 'bg-primary text-primary-foreground border-transparent hover:bg-primary/90'}`}
               >
                 {isFollowing ? 'Following' : 'Follow'}
               </button>
             )}
             <button 
               onClick={() => {
                 onClose();
                 window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'messages', chatId: user.id } }));
               }}
               className="flex-1 py-1.5 bg-secondary text-foreground font-bold rounded-lg text-sm border border-border transition-colors hover:bg-secondary/70">Message</button>
          </div>
          
          {/* Grid */}
          <div className="border-t border-border pt-4">
             <div className="flex justify-center mb-4 text-foreground"><Grid className="w-6 h-6" /></div>
             <div className="grid grid-cols-3 gap-1">
               {userPosts.map(post => (
                 <div key={post.id} className="aspect-square bg-secondary relative overflow-hidden group cursor-pointer">
                   <img src={post.imageUrl || undefined} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={handleMediaError} />
                 </div>
               ))}
               {userPosts.length === 0 && (
                 <div className="col-span-3 text-center py-10 text-muted-foreground text-sm font-medium">No posts yet</div>
               )}
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
