import React, { useState } from 'react';
import { useDB } from '../../lib/useDB';
import { Post } from './Post';
import { PostModal } from './PostModal';
import { StoryRing } from './StoryRing';
import { Plus, ArrowLeft } from 'lucide-react';
import { useToast } from '../../lib/ToastContext';
import { motion, AnimatePresence } from 'motion/react';
import { openProfilePreview, handleAvatarError } from '../../lib/utils';

export function Feed() {
  const db = useDB();
  const posts = db.posts;
  const currentUser = db.currentUser;

  // Group stories uniquely by user ID to avoid duplicate rings, and filter out the current user.
  const seenUserIds = new Set<string>([currentUser.id]);
  const STORIES: any[] = [];
  db.posts.forEach(p => {
    if (p.user?.id && !seenUserIds.has(p.user.id)) {
      seenUserIds.add(p.user.id);
      STORIES.push({ id: `story-${p.user.id}`, user: p.user, hasUnseenContents: true });
    }
  });

  const USERS = db.users;
  const { showToast } = useToast();
  
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const handleLike = (id: string) => {
    db.updatePost(id, (p: any) => {
      const isLiked = !p.isLiked;
      return { ...p, isLiked, likes: isLiked ? (p.likes || 0) + 1 : (p.likes || 0) - 1 };
    });
  };

  const handleSave = (id: string) => {
    db.updatePost(id, (p: any) => ({ ...p, isSaved: !p.isSaved }));
  };

  const toggleFollow = (user: any) => {
    db.updateUser(user.id, (u: any) => ({ ...u, isFollowing: !u.isFollowing }));
    showToast(user.isFollowing ? `Unfollowed ${user.username}` : `Following ${user.username}`);
  };

  return (
    <div className="w-full flex flex-col items-center pt-6 pb-6 min-h-0">
      <div className="w-full max-w-[470px]">
        
        {/* Stories */}
        <div className="flex gap-6 overflow-x-auto no-scrollbar pt-20 pb-6 mb-5 border-b border-border px-2">
          <StoryRing story={{ id: 'current', user: currentUser, hasViewed: false }} isCurrentUser />
          {STORIES.map(story => (
            <StoryRing key={story.id} story={story} />
          ))}
        </div>

        {/* Posts */}
        <div className="flex flex-col items-center w-full">
          {posts.filter(p => !p.isReported).map((post, index) => (
            <React.Fragment key={post.id}>
              <Post 
                post={post} 
                onLike={handleLike} 
                onSave={handleSave} 
                onViewComments={(id: string) => setSelectedPostId(id)}
                hideVideoControls={true}
              />
              
              {/* Inject Suggested Users after 2nd post */}
              {index === 1 && (
                <div className="w-full bg-card border border-border py-4 mb-8">
                  <div className="px-4 flex items-center justify-between mb-4">
                    <span className="font-bold text-[15px]">Suggested for you</span>
                    <button onClick={() => setShowAllSuggestions(true)} className="text-primary text-[14px] font-bold hover:text-foreground transition-colors">See All</button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-4">
                     {USERS.slice(1, 6).map((suggestedUser) => (
                       <div key={'sugg-'+suggestedUser.id} className="w-[160px] flex-shrink-0 flex flex-col items-center p-4 border border-border rounded-xl bg-secondary/20 hover:bg-secondary/40 transition-colors">
                         <div 
                           onClick={() => openProfilePreview(suggestedUser)}
                           className="w-20 h-20 rounded-full overflow-hidden mb-3 border border-border cursor-pointer hover:opacity-80 transition-opacity"
                         >
                           <img src={suggestedUser.avatarUrl || undefined} alt="avatar" className="w-full h-full object-cover" onError={handleAvatarError} />
                         </div>
                         <span 
                           onClick={() => openProfilePreview(suggestedUser)}
                           className="font-bold text-[14px] truncate w-full text-center cursor-pointer hover:underline"
                         >
                           {suggestedUser.username}
                         </span>
                         <span className="text-[12px] text-muted-foreground font-medium mb-4">Suggested for you</span>
                         <button 
                            onClick={() => toggleFollow(suggestedUser)}
                            className={`w-full py-1.5 rounded-lg text-[13px] font-bold transition-colors ${suggestedUser.isFollowing ? 'bg-secondary text-foreground' : 'bg-primary text-primary-foreground'}`}>
                            {suggestedUser.isFollowing ? 'Following' : 'Follow'}
                         </button>
                       </div>
                     ))}
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
          {/* Spinner for infinite scroll */}
          <div className="my-6 inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-foreground border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        </div>

      </div>
      
      {/* All Suggestions Modal */}
      <AnimatePresence>
        {showAllSuggestions && (
          <div className="fixed inset-0 md:left-[72px] lg:left-[244px] bg-background/95 backdrop-blur-md z-[200] md:z-[40] flex flex-col p-4">
             <div id="suggestions-header" className="flex items-center gap-4 py-4 md:pt-14 md:pb-6 border-b border-border mb-6 transition-all duration-300">
                <button id="suggestions-back-btn" onClick={() => setShowAllSuggestions(false)} className="hover:bg-secondary p-2 rounded-full transition-colors md:scale-110 md:mr-1"><ArrowLeft className="w-6 h-6" /></button>
                <h2 id="suggestions-title" className="text-xl md:text-2xl font-bold md:font-black tracking-tight">Suggested for you</h2>
             </div>
             
             <div className="flex flex-col gap-4 overflow-y-auto w-full max-w-lg mx-auto pb-20">
               {USERS.filter(u => u.id !== currentUser.id).map(user => (
                 <div key={'all-sugg-'+user.id} className="flex items-center justify-between bg-secondary/20 p-4 rounded-xl border border-border">
                    <div className="flex items-center gap-4">
                       <div 
                         onClick={() => {
                           setShowAllSuggestions(false);
                           openProfilePreview(user);
                         }}
                         className="w-12 h-12 rounded-full overflow-hidden border border-border shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                       >
                         <img src={user.avatarUrl || undefined} alt="avatar" className="w-full h-full object-cover" onError={handleAvatarError} />
                       </div>
                       <div className="flex flex-col">
                         <span 
                           onClick={() => {
                             setShowAllSuggestions(false);
                             openProfilePreview(user);
                           }}
                           className="font-bold text-[15px] leading-tight cursor-pointer hover:underline"
                         >
                           {user.username}
                         </span>
                         <span className="text-[13px] text-muted-foreground">{user.displayName}</span>
                       </div>
                    </div>
                    <button 
                       onClick={() => toggleFollow(user)}
                       className={`px-6 py-2 rounded-lg text-[13px] font-bold transition-colors ${user.isFollowing ? 'bg-secondary text-foreground' : 'bg-primary text-primary-foreground'}`}>
                       {user.isFollowing ? 'Following' : 'Follow'}
                    </button>
                 </div>
               ))}
             </div>
          </div>
        )}
      </AnimatePresence>
      
      {selectedPostId && <PostModal postId={selectedPostId} onClose={() => setSelectedPostId(null)} />}
    </div>
  );
}
