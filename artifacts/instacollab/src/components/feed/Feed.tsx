import React, { useState, useEffect } from 'react';
import { useDB } from '../../lib/useDB';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { Post } from './Post';
import { PostModal } from './PostModal';
import { StoryStrip } from './StoryStrip';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '../../lib/ToastContext';
import { AnimatePresence } from 'motion/react';
import { openProfilePreview } from '../../lib/utils';
import { Avatar } from '../common/Avatar';
import { ProfileNameLines } from '../common/ProfileNameLines';
import { resolveUser } from '../../lib/safe';
import { isPostActive } from '../../lib/entityResolve';
import { TAP_REFRESH_EVENT } from '../../lib/appRefresh';
import { syncCloudFeed } from '../../lib/cloudPostSync';

export function Feed() {
  const db = useDB();
  const posts = db.posts;
  const currentUser = useCurrentUser();
  const USERS = db.users ?? [];

  const { showToast } = useToast();
  
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  useEffect(() => {
    void syncCloudFeed();
  }, []);

  useEffect(() => {
    const onRefresh = (event: Event) => {
      const scope = (event as CustomEvent<{ scope?: string }>).detail?.scope;
      if (scope === 'home' || scope === 'global') {
        void syncCloudFeed();
      }
    };
    window.addEventListener(TAP_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(TAP_REFRESH_EVENT, onRefresh);
  }, []);

  const handleLike = (id: string) => {
    db.togglePostLike(id);
  };

  const handleSave = (id: string) => {
    db.togglePostSave(id);
  };

  const toggleFollow = (user: { id?: string; username?: string; isFollowing?: boolean }) => {
    if (!user?.id) return;
    const next = db.toggleFollow(user.id);
    if (next === null) return;
    const label = user.username ?? 'user';
    showToast(next ? `Following ${label}` : `Unfollowed ${label}`);
  };

  return (
    <div className="w-full flex flex-col items-center pt-6 pb-6 min-h-0 overflow-visible">
      {/* Stories should span the full feed lane (edge-to-edge), not the post card max width */}
      <div className="w-full overflow-visible" key={`stories-${feedRefreshKey}`}>
        <StoryStrip />
      </div>

      <div className="w-full max-w-[470px] overflow-visible">
        {/* Posts */}
        <div className="flex flex-col items-center w-full overflow-visible">
          {db
            .filterPostsByPrivateAuthors((posts ?? []).filter((p) => p && p.user && isPostActive(p)))
            .map((post, index) => (
            <React.Fragment key={post.id}>
              <Post 
                post={post} 
                onLike={handleLike} 
                onSave={handleSave} 
                onViewComments={(id: string) => setSelectedPostId(id)}
                commentsPostId={selectedPostId}
                hideVideoControls={true}
              />
              
              {/* Inject Suggested Users after 2nd post */}
              {index === 1 && (
                <div className="w-full bg-card border border-border py-4 mb-8 overflow-visible">
                  <div className="px-4 flex items-center justify-between mb-4">
                    <span className="font-bold text-[15px]">Suggested for you</span>
                    <button onClick={() => setShowAllSuggestions(true)} className="text-primary text-[14px] font-bold hover:text-foreground transition-colors">See All</button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto overflow-y-visible no-scrollbar px-4 pb-4 pt-12 items-stretch">
                     {USERS.slice(1, 6).map((rawUser) => {
                       const suggestedUser = resolveUser(db.users, rawUser);
                       return (
                       <div
                         key={'sugg-'+suggestedUser.id}
                         className="w-[168px] flex-shrink-0 flex flex-col items-center px-3 pt-2 pb-4 border border-border rounded-xl bg-secondary/20 hover:bg-secondary/40 transition-colors overflow-visible"
                       >
                         <div className="relative flex h-[88px] w-full items-end justify-center shrink-0 mb-2 overflow-visible">
                           <Avatar
                             user={suggestedUser}
                             size="lg"
                             thoughtBubbleMode="inline"
                             className="hover:opacity-80 transition-opacity"
                             onClick={() => openProfilePreview(suggestedUser)}
                           />
                         </div>
                         <span 
                           onClick={() => openProfilePreview(suggestedUser)}
                           className="font-bold text-[14px] truncate w-full text-center cursor-pointer hover:underline mt-1"
                         >
                           {suggestedUser.username}
                         </span>
                         <span className="text-[12px] text-muted-foreground font-medium mb-3 mt-0.5">
                           Suggested for you
                         </span>
                         <button 
                            onClick={() => toggleFollow(suggestedUser)}
                            className={`w-full py-1.5 rounded-lg text-[13px] font-bold transition-colors ${suggestedUser.isFollowing ? 'bg-secondary text-foreground' : 'bg-primary text-primary-foreground'}`}>
                            {suggestedUser.isFollowing ? 'Following' : 'Follow'}
                         </button>
                       </div>
                     );
                     })}
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
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
               {USERS.filter(u => u.id !== currentUser.id).map(rawUser => {
                 const user = resolveUser(db.users, rawUser);
                 return (
                 <div key={'all-sugg-'+user.id} className="flex items-center justify-between bg-secondary/20 p-4 rounded-xl border border-border overflow-visible">
                    <div className="flex items-center gap-4 min-w-0 overflow-visible">
                       <div className="relative flex h-[72px] w-14 shrink-0 items-end justify-center overflow-visible">
                         <Avatar
                           user={user}
                           size="md"
                           thoughtBubbleMode="inline"
                           className="hover:opacity-80 transition-opacity"
                           onClick={() => {
                             setShowAllSuggestions(false);
                             openProfilePreview(user);
                           }}
                         />
                       </div>
                       <div className="flex flex-col">
                         <ProfileNameLines
                           user={user}
                           primaryClassName="font-bold text-[15px] leading-tight cursor-pointer hover:underline"
                           secondaryClassName="text-[13px] text-muted-foreground"
                         />
                       </div>
                    </div>
                    <button 
                       onClick={() => toggleFollow(user)}
                       className={`px-6 py-2 rounded-lg text-[13px] font-bold transition-colors ${user.isFollowing ? 'bg-secondary text-foreground' : 'bg-primary text-primary-foreground'}`}>
                       {user.isFollowing ? 'Following' : 'Follow'}
                    </button>
                 </div>
               );
               })}
             </div>
          </div>
        )}
      </AnimatePresence>
      
      {selectedPostId && <PostModal postId={selectedPostId} onClose={() => setSelectedPostId(null)} />}
    </div>
  );
}
