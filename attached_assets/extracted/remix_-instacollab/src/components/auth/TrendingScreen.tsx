import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Hash, Users, Zap, ArrowRight, Play, Heart, MessageCircle } from 'lucide-react';
import { useDB } from '../../lib/useDB';

interface Props {
  onContinue: () => void;
}

export function TrendingScreen({ onContinue }: Props) {
  const db = useDB();
  const [activeCategory, setActiveCategory] = useState<'posts' | 'topics' | 'creators'>('creators');
  const [loading, setLoading] = useState(true);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  const handleFollow = (userId: string) => {
    setFollowedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
        db.updateUser(userId, (u: any) => ({ ...u, followers: Math.max(0, parseInt(u.followers) - 1).toString() }));
      } else {
        next.add(userId);
        db.updateUser(userId, (u: any) => ({ ...u, followers: (parseInt(u.followers) + 1).toString() }));
      }
      return next;
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const categories = [
    { id: 'posts', label: 'Top Posts', icon: TrendingUp },
    { id: 'topics', label: 'Viral Topics', icon: Hash },
    { id: 'creators', label: 'Rising Stars', icon: Users },
  ] as const;

  const viralTopics = [
    { name: 'AIArtRevolution', posts: '1.2M', growth: '+45%' },
    { name: 'InstaCollabGlobal', posts: '850K', growth: '+12%' },
    { name: 'CreativeCoding', posts: '420K', growth: '+88%' },
    { name: 'FutureOfDesign', posts: '310K', growth: '+5%' },
  ];

  return (
    <div className="fixed inset-0 bg-background z-[1200] flex flex-col">
      <div className="flex-1 overflow-y-auto no-scrollbar pt-16 px-6 pb-24 max-w-lg mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 text-primary mb-2">
            <Zap className="w-5 h-5 fill-primary" />
            <span className="font-black text-sm uppercase tracking-widest">Happening Now</span>
          </div>
          <h2 className="text-3xl font-black text-foreground">Global Trending</h2>
          <p className="text-muted-foreground mt-2">See what the community is building right now.</p>
        </motion.div>

        {/* Category Switcher */}
        <div className="flex gap-2 mb-8 bg-secondary/50 p-1 rounded-2xl border border-border">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                activeCategory === cat.id 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <cat.icon className="w-4 h-4" />
              {cat.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-4"
            >
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-secondary/50 rounded-2xl animate-pulse border border-border" />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {activeCategory === 'posts' && (
                <div className="grid grid-cols-2 gap-4">
                  {db.posts.slice(0, 4).map((post, i) => (
                    <div key={post.id} className="group relative aspect-square bg-secondary rounded-[24px] overflow-hidden border border-border shadow-md">
                      <img src={post.imageUrl || undefined} alt="Trend" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-4">
                        <div className="flex items-center gap-3 text-white text-[10px] font-bold">
                          <span className="flex items-center gap-1"><Heart className="w-3 h-3 fill-white" /> {post.likes}</span>
                          <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.comments}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeCategory === 'topics' && (
                <div className="space-y-3">
                  {viralTopics.map((topic, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-background border border-border flex items-center justify-between hover:border-primary/30 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-black group-hover:scale-110 transition-transform">
                          #{i + 1}
                        </div>
                        <div>
                          <h4 className="font-black text-foreground">#{topic.name}</h4>
                          <p className="text-xs text-muted-foreground">{topic.posts} interactions</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-500 font-bold text-sm">{topic.growth}</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-black">Trending</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeCategory === 'creators' && (
                <div className="space-y-3">
                  {db.users.slice(0, 5).map((user, i) => (
                    <div key={user.id} className="p-4 rounded-2xl bg-background border border-border flex items-center justify-between hover:bg-secondary/30 transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-border">
                          <img src={user.avatarUrl || undefined} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground">@{user.username} {user.isVerified && '✓'}</h4>
                          <p className="text-xs text-muted-foreground">{user.followers} followers</p>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFollow(user.id);
                        }}
                        className={`px-4 py-1.5 font-bold text-xs rounded-lg transition-all active:scale-95 shadow-sm ${
                          followedIds.has(user.id)
                          ? 'bg-secondary text-foreground border border-border hover:bg-secondary/80'
                          : 'bg-primary text-primary-foreground hover:opacity-90'
                        }`}
                      >
                        {followedIds.has(user.id) ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent flex flex-col gap-3">
        {followedIds.size > 0 ? (
          <button 
            onClick={onContinue}
            className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-xl shadow-primary/20"
          >
            Follow {followedIds.size} & Continue <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <button 
            onClick={onContinue}
            className="w-full h-14 bg-secondary text-foreground rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-secondary/80 transition-all active:scale-95"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
