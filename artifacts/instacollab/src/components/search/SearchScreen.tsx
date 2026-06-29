import React, { useState, useEffect } from 'react';
import { Search, MapPin, Music, Hash, UserCircle2, Loader2 } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { handleAvatarError, handleMediaError } from '../../lib/utils';
import { useDiscoverableUserSearch } from '../../hooks/useDiscoverableUserSearch';
import { isCloudAuthConfigured, isPrimarySupabaseCloud } from '../../lib/auth/config';

import { PostModal } from '../feed/PostModal';

import { openProfilePreview } from '../../lib/utils';
import { ProfileNameLines } from '../common/ProfileNameLines';
import { getProfileDisplayName } from '../../lib/profileDisplay';
import { isPostActive, resolvePost } from '../../lib/entityResolve';
import type { User } from '../../types';
import { snapshotPostPlayback } from '../../lib/postPlayback';

export type SearchTab = 'top' | 'accounts' | 'audio' | 'tags' | 'places';

export function SearchScreen({ initialContext, onClearContext }: { initialContext?: { query?: string, tab?: SearchTab } | null, onClearContext?: () => void }) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('top');
  
  useEffect(() => {
    if (initialContext) {
      if (initialContext.query) setQuery(initialContext.query);
      if (
        initialContext.tab === 'top' ||
        initialContext.tab === 'accounts' ||
        initialContext.tab === 'audio' ||
        initialContext.tab === 'tags' ||
        initialContext.tab === 'places'
      ) {
        setActiveTab(initialContext.tab);
      }
      onClearContext?.();
    }
  }, [initialContext, onClearContext]);

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const db = useDB();
  const POSTS = db.posts;
  const { results: searchUsers, loading: searchUsersLoading } = useDiscoverableUserSearch(query);
  const cloudSearchEnabled = isPrimarySupabaseCloud() || isCloudAuthConfigured();
  const { showToast } = useToast();

  const toggleFollow = (user: User, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = db.toggleFollow(user.id);
    if (next === null) return;
    showToast(next ? `Following ${user.username}` : `Unfollowed ${user.username}`);
  };

  const tabs: {id: SearchTab, label: string, icon?: React.ReactNode}[] = [
    { id: 'top', label: 'Top' },
    { id: 'accounts', label: 'Accounts', icon: <UserCircle2 className="w-4 h-4" /> },
    { id: 'audio', label: 'Audio', icon: <Music className="w-4 h-4" /> },
    { id: 'tags', label: 'Tags', icon: <Hash className="w-4 h-4" /> },
    { id: 'places', label: 'Places', icon: <MapPin className="w-4 h-4" /> },
  ];

  return (
    <div className="w-full flex flex-col pt-6 px-4 md:px-0 max-w-[600px] mx-auto min-h-0">
      <div className="relative mb-4 shrink-0">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>
        <input 
          type="text" 
          placeholder="Search..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-secondary text-foreground text-[15px] font-medium rounded-2xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-transparent focus:border-border" 
        />
      </div>
      
      {/* Search Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar shrink-0 pb-1">
         {tabs.map((tab) => (
           <button 
             key={tab.id}
             onClick={() => setActiveTab(tab.id)}
             className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-foreground text-background' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}
           >
             {tab.icon} {tab.label}
           </button>
         ))}
      </div>

      <div className="flex-1 pb-6 w-full">
        {!query ? (
          // Explore Grid
          <div className="grid grid-cols-3 gap-1 md:gap-2">
            {POSTS.filter((raw) => isPostActive(raw)).map((raw, i) => {
              const post = resolvePost(db.posts, raw, db.users);
              // Create dynamic layout variations
              const isLarge = i % 10 === 0;
              const isTall = i % 7 === 0 && !isLarge;
              
              return (
                <div 
                  key={post.id} 
                  onClick={() => {
                    snapshotPostPlayback(post.id, 'modal');
                    setSelectedPostId(post.id);
                  }}
                  className={`bg-secondary relative group cursor-pointer overflow-hidden rounded-xl ${isLarge ? 'col-span-2 row-span-2 aspect-square' : isTall ? 'row-span-2 aspect-[1/2]' : 'aspect-square'}`}
                >
                  <img 
                    src={post.imageUrl || undefined}
                    alt={`Explore ${post.id}`} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    onError={handleMediaError}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-[2px]">
                     <span className="font-bold text-lg flex items-center gap-2">
                        {post?.likes || 0} ♥
                     </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Search Results
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {activeTab === 'top' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black text-lg">Top Accounts</h3>
                    {searchUsersLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-hidden />
                    ) : null}
                  </div>
                  {searchUsers.length === 0 && !searchUsersLoading ? (
                    <p className="text-sm text-muted-foreground px-2">
                      {isPrimarySupabaseCloud()
                        ? 'No accounts match that search. Users appear here after they finish profile setup (Continue on the setup screen).'
                        : cloudSearchEnabled
                          ? 'No accounts match that search. New users appear after they finish profile setup on a cloud-connected app.'
                          : 'No accounts on this device match that search. Local demo sign-ups are only stored in this browser — configure Supabase auth for cross-device discovery.'}
                    </p>
                  ) : null}
                  {searchUsers.map((user, i) => (
                    <div key={'top-user-'+user.id || i} className="flex items-center justify-between hover:bg-secondary/50 p-2 rounded-xl cursor-pointer" onClick={() => openProfilePreview(user)}>
                      <div className="flex items-center gap-3">
                         <div className="w-12 h-12 rounded-full overflow-hidden border border-border">
                           <img src={user.avatarUrl || undefined} className="w-full h-full object-cover" onError={handleAvatarError} />
                         </div>
                         <div className="flex flex-col">
                           <ProfileNameLines
                             user={user}
                             primaryClassName="font-bold text-[15px] flex items-center gap-1"
                             secondaryClassName="text-sm text-muted-foreground"
                             premiumBadge={user.isVerified ? <span>✓</span> : null}
                           />
                           <span className="text-sm text-muted-foreground">{user.followers} followers</span>
                         </div>
                      </div>
                    </div>
                  ))}
                  {searchUsers.length > 0 && (
                    <button onClick={() => setActiveTab('accounts')} className="w-full text-primary font-bold text-sm py-2">See all results</button>
                  )}
                </div>
                
                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="font-black text-lg">Suggested Tags</h3>
                  <div className="flex items-center justify-between hover:bg-secondary/50 p-2 rounded-xl cursor-pointer">
                     <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center"><Hash className="w-6 h-6" /></div>
                       <div className="flex flex-col">
                         <span className="font-bold text-[15px]">#{query}</span>
                         <span className="text-sm text-muted-foreground">{Math.floor(Math.random() * 10) + 1}M posts</span>
                       </div>
                     </div>
                  </div>
                </div>
              </div>
            )}
            
             {activeTab === 'accounts' && (
              <div className="space-y-2">
                 {searchUsersLoading && searchUsers.length === 0 ? (
                   <p className="text-sm text-muted-foreground px-3 py-2 flex items-center gap-2">
                     <Loader2 className="w-4 h-4 animate-spin" /> Searching accounts…
                   </p>
                 ) : null}
                 {!searchUsersLoading && searchUsers.length === 0 ? (
                   <p className="text-sm text-muted-foreground px-3 py-2">No matching accounts.</p>
                 ) : null}
                 {searchUsers.map((user, i) => (
                    <div key={'user-'+user.id || i} className="flex items-center justify-between hover:bg-secondary/50 p-3 rounded-xl cursor-pointer" onClick={() => openProfilePreview(user)}>
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 rounded-full overflow-hidden border border-border">
                           <img src={user.avatarUrl || undefined} className="w-full h-full object-cover" onError={handleAvatarError} />
                         </div>
                         <div className="flex flex-col">
                           <ProfileNameLines
                             user={user}
                             primaryClassName="font-bold text-[16px] flex items-center gap-1"
                             secondaryClassName="text-[14px] text-muted-foreground font-medium"
                             premiumBadge={user.isVerified ? <span>✓</span> : null}
                           />
                           <span className="text-[12px] text-muted-foreground mt-0.5">{Math.floor(Math.random()*500)}K followers</span>
                         </div>
                      </div>
                      {user.id !== db.currentUser?.id && (
                        <button 
                           onClick={(e) => toggleFollow(user, e)}
                           className={`px-5 py-1.5 font-bold rounded-lg text-sm transition-colors active:scale-95 ${user.isFollowing ? 'bg-secondary text-foreground border border-border' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                           {user.isFollowing ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="space-y-2">
                 {[...Array(8)].map((_, i) => (
                    <div key={'audio-'+i} className="flex items-center justify-between hover:bg-secondary/50 p-3 rounded-xl cursor-pointer group">
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 rounded-xl overflow-hidden border border-border bg-secondary flex items-center justify-center shrink-0">
                           <Music className="w-6 h-6 text-muted-foreground" />
                         </div>
                         <div className="flex flex-col">
                           <span className="font-bold text-[16px]">{query} Remix vol {i + 1}</span>
                           <span className="text-[14px] text-muted-foreground font-medium flex items-center gap-1">
                             Creator {i+1}
                           </span>
                           <span className="text-[12px] text-muted-foreground mt-0.5">{Math.floor(Math.random() * 900) + 10}K reels</span>
                         </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {activeTab === 'tags' && (
              <div className="space-y-2">
                 {[...Array(6)].map((_, i) => (
                    <div key={'tag-'+i} className="flex items-center justify-between hover:bg-secondary/50 p-3 rounded-xl cursor-pointer group">
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center shrink-0">
                           <Hash className="w-6 h-6 text-muted-foreground" />
                         </div>
                         <div className="flex flex-col">
                           <span className="font-bold text-[16px]">#{query}{['vibes', 'life', 'daily', 'explore', 'style', 'music'][i]}</span>
                           <span className="text-[14px] text-muted-foreground font-medium flex items-center gap-1">
                             {Math.floor(Math.random() * 50) + 1}M posts
                           </span>
                         </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {activeTab === 'places' && (
              <div className="space-y-2">
                 {[...Array(5)].map((_, i) => (
                    <div key={'place-'+i} className="flex items-center justify-between hover:bg-secondary/50 p-3 rounded-xl cursor-pointer group">
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center shrink-0">
                           <MapPin className="w-6 h-6 text-muted-foreground" />
                         </div>
                         <div className="flex flex-col">
                           <span className="font-bold text-[16px]">{query} {i === 0 ? 'City' : i === 1 ? 'Cafe' : i === 2 ? 'Studio' : i === 3 ? 'Park' : 'Central'}</span>
                           <span className="text-[14px] text-muted-foreground font-medium flex items-center gap-1">
                             Location
                           </span>
                         </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedPostId && (
        <PostModal postId={selectedPostId} onClose={() => setSelectedPostId(null)} />
      )}
    </div>
  );
}
