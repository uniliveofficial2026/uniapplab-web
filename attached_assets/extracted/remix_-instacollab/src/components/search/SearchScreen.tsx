import React, { useState, useEffect } from 'react';
import { Search, MapPin, Music, Hash, UserCircle2, ArrowUpRight, X, Clock, Play, Layers } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { handleAvatarError, handleMediaError } from '../../lib/utils';

import { PostModal } from '../feed/PostModal';

import { openProfilePreview } from '../../lib/utils';

type SearchTab = 'top' | 'accounts' | 'audio' | 'tags' | 'places';

export function SearchScreen({ initialContext, onClearContext }: { initialContext?: { query?: string, tab?: any } | null, onClearContext?: () => void }) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('top');
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(['photography', 'travel', 'food', 'design']);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (initialContext) {
      if (initialContext.query) {
        setQuery(initialContext.query);
        if (!recentSearches.includes(initialContext.query)) {
          setRecentSearches(prev => [initialContext.query!, ...prev].slice(0, 8));
        }
      }
      if (initialContext.tab) setActiveTab(initialContext.tab);
      onClearContext?.();
    }
  }, [initialContext, onClearContext]);

  const handleClear = () => {
    setQuery('');
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const handleRecentSearchClick = (search: string) => {
    setQuery(search);
    if (!recentSearches.includes(search)) {
      setRecentSearches(prev => [search, ...prev].slice(0, 8));
    }
  };

  const removeRecentSearch = (search: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches(prev => prev.filter(s => s !== search));
  };

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const db = useDB();
  const POSTS = db.posts;
  const USERS = db.users;
  const { showToast } = useToast();

  const toggleFollow = (user: any, e: React.MouseEvent) => {
    e.stopPropagation();
    db.updateUser(user.id, (u: any) => ({ ...u, isFollowing: !u.isFollowing }));
    showToast(user.isFollowing ? `Unfollowed ${user.username}` : `Following ${user.username}`);
  };

  const tabs: {id: SearchTab, label: string, icon?: React.ReactNode}[] = [
    { id: 'top', label: 'Top' },
    { id: 'accounts', label: 'Accounts', icon: <UserCircle2 className="w-4 h-4" /> },
    { id: 'audio', label: 'Audio', icon: <Music className="w-4 h-4" /> },
    { id: 'tags', label: 'Tags', icon: <Hash className="w-4 h-4" /> },
    { id: 'places', label: 'Places', icon: <MapPin className="w-4 h-4" /> },
  ];

  return (
    <div className="w-full flex flex-col pt-6 px-0 max-w-[600px] mx-auto min-h-0">
      <div className="flex items-center gap-2 mb-4 shrink-0 px-2 lg:px-0">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="Search..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            className="w-full bg-secondary text-foreground text-[15px] font-medium rounded-2xl pl-12 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-transparent focus:border-border" 
          />
          {query && (
            <button 
              onClick={handleClear}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5 bg-secondary/80 rounded-full p-0.5" />
            </button>
          )}
        </div>
        {(isFocused || query) && (
          <button 
            onClick={() => {
              setIsFocused(false);
              setQuery('');
              if (searchInputRef.current) searchInputRef.current.blur();
            }}
            className="text-sm font-bold text-foreground px-2 animate-in fade-in slide-in-from-right-2"
          >
            Cancel
          </button>
        )}
      </div>
      
      {/* Search Tabs */}
      {(query || isFocused) && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar shrink-0 pb-1 px-2 lg:px-0">
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
      )}

      <div className="flex-1 pb-6 w-full px-2 lg:px-0">
        {!query && !isFocused ? (
          // Explore Grid
          <div className="grid grid-cols-3 gap-1 md:gap-2">
            {POSTS.map((post, i) => {
              // Create dynamic layout variations
              const isLarge = i % 10 === 0;
              const isTall = i % 7 === 0 && !isLarge;
              const isReel = i % 5 === 0;
              const isCarousel = i % 8 === 0 && !isReel;
              
              return (
                <div 
                  key={post.id} 
                  onClick={() => setSelectedPostId(post.id)}
                  className={`bg-secondary relative group cursor-pointer overflow-hidden ${isLarge ? 'col-span-2 row-span-2 aspect-square' : isTall ? 'row-span-2 aspect-[1/2]' : 'aspect-square'} ${i === 0 ? 'rounded-tl-2xl' : ''} ${i === 2 ? 'rounded-tr-2xl' : ''}`}
                >
                  <img 
                    src={post.imageUrl || undefined}
                    alt={`Explore ${post.id}`} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    onError={handleMediaError}
                  />
                  {isReel && (
                    <div className="absolute top-2 right-2 text-white drop-shadow-md">
                      <Play className="w-5 h-5 fill-white stroke-none" />
                    </div>
                  )}
                  {isCarousel && (
                     <div className="absolute top-2 right-2 text-white drop-shadow-md">
                      <Layers className="w-5 h-5 fill-white shadow-black" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-[2px]">
                     <span className="font-bold text-lg flex items-center gap-2">
                        {post?.likes || 0} ♥
                     </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : !query && isFocused ? (
          // Recent Searches
          <div className="animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg">Recent</h3>
              <button 
                onClick={() => setRecentSearches([])}
                className="text-primary font-bold text-sm"
              >
                Clear all
              </button>
            </div>
            {recentSearches.length > 0 ? (
              <div className="space-y-1">
                {recentSearches.map((search, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleRecentSearchClick(search)}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-secondary cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      <span className="font-semibold text-[15px]">{search}</span>
                    </div>
                    <button 
                      onClick={(e) => removeRecentSearch(search, e)}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-muted-foreground font-semibold">
                No recent searches.
              </div>
            )}
          </div>
        ) : (
          // Search Results
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {activeTab === 'top' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-black text-lg">Top Accounts</h3>
                  {USERS.filter(u => u.username.toLowerCase().includes(query.toLowerCase()) || u.displayName.toLowerCase().includes(query.toLowerCase())).map((user, i) => (
                    <div key={'top-user-'+user.id || i} className="flex items-center justify-between hover:bg-secondary/50 p-2 rounded-xl cursor-pointer" onClick={() => openProfilePreview(user)}>
                      <div className="flex items-center gap-3">
                         <div className="w-12 h-12 rounded-full overflow-hidden border border-border">
                           <img src={user.avatarUrl || undefined} className="w-full h-full object-cover" onError={handleAvatarError} />
                         </div>
                         <div className="flex flex-col">
                           <span className="font-bold text-[15px]">{user.username} {user.isVerified && '✓'}</span>
                           <span className="text-sm text-muted-foreground">{user.displayName} • {user.followers} followers</span>
                         </div>
                      </div>
                    </div>
                  ))}
                  {USERS.length > 0 && <button onClick={() => setActiveTab('accounts')} className="w-full text-primary font-bold text-sm py-2">See all results</button>}
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
                 {USERS.map((user, i) => (
                    <div key={'user-'+user.id || i} className="flex items-center justify-between hover:bg-secondary/50 p-3 rounded-xl cursor-pointer" onClick={() => openProfilePreview(user)}>
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 rounded-full overflow-hidden border border-border">
                           <img src={user.avatarUrl || undefined} className="w-full h-full object-cover" onError={handleAvatarError} />
                         </div>
                         <div className="flex flex-col">
                           <span className="font-bold text-[16px]">{user.username} {user.isVerified && '✓'}</span>
                           <span className="text-[14px] text-muted-foreground font-medium">{user.displayName}</span>
                           <span className="text-[12px] text-muted-foreground mt-0.5">{Math.floor(Math.random()*500)}K followers</span>
                         </div>
                      </div>
                      {user.id !== db.currentUser.id && (
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
              <div className="space-y-4 pt-2">
                 <h3 className="font-black text-lg px-2 lg:px-0">Audio Tracks</h3>
                 {[...Array(8)].map((_, i) => (
                    <div key={'audio-'+i} className="flex items-center justify-between hover:bg-secondary/50 p-2 lg:p-3 rounded-xl cursor-pointer group">
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 rounded-xl overflow-hidden border border-border bg-secondary flex items-center justify-center shrink-0">
                           <Music className="w-6 h-6 text-muted-foreground group-hover:scale-110 transition-transform" />
                         </div>
                         <div className="flex flex-col">
                           <span className="font-bold text-[16px]">{query || 'Original'} Remix vol {i + 1}</span>
                           <span className="text-[14px] text-muted-foreground font-medium flex items-center gap-1">
                             Creator {i+1}
                           </span>
                           <span className="text-[12px] text-muted-foreground mt-0.5">{Math.floor(Math.random() * 900) + 10}K reels playing</span>
                         </div>
                      </div>
                      <button className="p-2 mr-2 text-foreground/50 hover:text-foreground">
                        <Play className="w-5 h-5 fill-current" />
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {activeTab === 'tags' && (
              <div className="space-y-4 pt-2">
                 <h3 className="font-black text-lg px-2 lg:px-0">Hash Tags</h3>
                 {[...Array(6)].map((_, i) => (
                    <div key={'tag-'+i} className="flex items-center justify-between hover:bg-secondary/50 p-2 lg:p-3 rounded-xl cursor-pointer group">
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center shrink-0">
                           <Hash className="w-6 h-6 text-muted-foreground group-hover:scale-110 transition-transform" />
                         </div>
                         <div className="flex flex-col">
                           <span className="font-bold text-[16px]">#{query || 'trend'}{['vibes', 'life', 'daily', 'explore', 'style', 'music'][i]}</span>
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
              <div className="space-y-4 pt-2">
                 <h3 className="font-black text-lg px-2 lg:px-0">Places nearby</h3>
                 {[...Array(5)].map((_, i) => (
                    <div key={'place-'+i} className="flex items-center justify-between hover:bg-secondary/50 p-2 lg:p-3 rounded-xl cursor-pointer group">
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 rounded-full overflow-hidden border border-border bg-secondary/80 flex items-center justify-center shrink-0">
                           <MapPin className="w-6 h-6 text-muted-foreground group-hover:scale-110 transition-transform" />
                         </div>
                         <div className="flex flex-col">
                           <span className="font-bold text-[16px]">{query || 'Local'} {i === 0 ? 'City' : i === 1 ? 'Cafe' : i === 2 ? 'Studio' : i === 3 ? 'Park' : 'Central'}</span>
                           <span className="text-[14px] text-muted-foreground font-medium flex items-center gap-1">
                             {2 + i * 1.5} km away
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
