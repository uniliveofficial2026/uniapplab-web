import React, { useState, useEffect } from 'react';
import { Crown, Trophy, TrendingUp, Music, Star } from 'lucide-react';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { safeAvatarUrl } from '../../lib/safe';
import { isDemoContentEnabled } from '../../lib/demoContentPolicy';

const WEEKLY_LEADERS = [
  { id: '1', name: 'Cherry___Moe', username: '@cherry_moe', avatar: 11, score: 25400300, rank: 1, change: 'up', title: 'Vocal Queen 👑' },
  { id: '2', name: 'Samsam5000', username: '@samsam5000', avatar: 12, score: 21200000, rank: 2, change: 'same', title: 'Platinum Singer' },
  { id: '3', name: 'Aung Lay', username: '@aung_lay', avatar: 13, score: 18500200, rank: 3, change: 'up', title: 'Golden Voice' },
  { id: '4', name: 'Su Su', username: '@su_su_vocal', avatar: 14, score: 15400000, rank: 4, change: 'down', title: 'Rising Star' },
  { id: '5', name: 'Ko Phyo', username: '@kophyo_rocks', avatar: 15, score: 12100000, rank: 5, change: 'same', title: 'Rock Master' },
  { id: '6', name: 'Nilar', username: '@nilar_sweet', avatar: 16, score: 10400000, rank: 6, change: 'up', title: 'Pop Idol' },
  { id: '7', name: 'Zayar', username: '@zayar_music', avatar: 17, score: 9500000, rank: 7, change: 'down', title: 'Indie Artist' },
];

const ALL_TIME_LEADERS = [
  { id: '8', name: 'David Singer', username: '@david_s', avatar: 21, score: 250000000, rank: 1, change: 'same', title: 'Legend 🎤' },
  { id: '1', name: 'Cherry___Moe', username: '@cherry_moe', avatar: 11, score: 198000000, rank: 2, change: 'up', title: 'Vocal Queen 👑' },
  { id: '9', name: 'Mg Mg', username: '@mg_music', avatar: 22, score: 142000000, rank: 3, change: 'down', title: 'Diamond Voice' },
  { id: '2', name: 'Samsam5000', username: '@samsam5000', avatar: 12, score: 121000000, rank: 4, change: 'up', title: 'Platinum Singer' },
  { id: '10', name: 'Kyaw Zin', username: '@k_zin', avatar: 23, score: 98000000, rank: 5, change: 'same', title: 'Master' },
  { id: '3', name: 'Aung Lay', username: '@aung_lay', avatar: 13, score: 85002000, rank: 6, change: 'up', title: 'Golden Voice' },
  { id: '11', name: 'Win Win', username: '@winwin55', avatar: 24, score: 76000000, rank: 7, change: 'down', title: 'Star' },
];

type LeaderRow = (typeof WEEKLY_LEADERS)[number];

export function LeaderboardView({ onSelectProfile }: { onSelectProfile?: (user: any) => void }) {
  const [timeframe, setTimeframe] = useState<'weekly' | 'alltime'>('weekly');
  const currentUser = useCurrentUser();
  const demoOn = isDemoContentEnabled();

  const [weeklyLeaders, setWeeklyLeaders] = useState<LeaderRow[]>(() =>
    demoOn ? WEEKLY_LEADERS : [],
  );
  const [allTimeLeaders, setAllTimeLeaders] = useState<LeaderRow[]>(() =>
    demoOn ? ALL_TIME_LEADERS : [],
  );

  useEffect(() => {
    if (!demoOn) return;
    const timer = setInterval(() => {
       setWeeklyLeaders(prev => {
          if (prev.length === 0) return prev;
          const newLeaders = [...prev];
          const randomIndex = Math.floor(Math.random() * newLeaders.length);
          newLeaders[randomIndex] = {
             ...newLeaders[randomIndex],
             score: newLeaders[randomIndex].score + Math.floor(Math.random() * 500)
          };
          return newLeaders.sort((a, b) => b.score - a.score).map((l, i) => ({ ...l, rank: i + 1 }));
       });

       setAllTimeLeaders(prev => {
          if (prev.length === 0) return prev;
          const newLeaders = [...prev];
          const randomIndex = Math.floor(Math.random() * newLeaders.length);
          newLeaders[randomIndex] = {
             ...newLeaders[randomIndex],
             score: newLeaders[randomIndex].score + Math.floor(Math.random() * 5000)
          };
          return newLeaders.sort((a, b) => b.score - a.score).map((l, i) => ({ ...l, rank: i + 1 }));
       });
    }, 30000);
    return () => clearInterval(timer);
  }, [demoOn]);

  const [userScore, setUserScore] = useState(demoOn ? 1240500 : 0);
  const [userAllTimeScore, setUserAllTimeScore] = useState(demoOn ? 15640200 : 0);

  useEffect(() => {
     if (!demoOn) return;
     const userTimer = setInterval(() => {
        setUserScore(s => s + Math.floor(Math.random() * 10));
        setUserAllTimeScore(s => s + Math.floor(Math.random() * 10));
     }, 3000);
     return () => clearInterval(userTimer);
  }, [demoOn]);

  const currentLeaders = timeframe === 'weekly' ? weeklyLeaders : allTimeLeaders;

  const handleSelectProfile = (leader: LeaderRow) => {
    if (onSelectProfile) {
      onSelectProfile({
        name: leader.name,
        handle: leader.username,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${leader.avatar}`,
        followers: '150k',
        likes: '2.4M',
        gifts: '10M',
        vip: leader.rank <= 3,
        description: leader.title + ' on Karaoke Idol! 🎤'
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 to-yellow-600 mb-4 shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-transform hover:scale-105">
           <Trophy className="w-8 h-8 text-white drop-shadow-md" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">Global Leaderboard</h1>
        <p className="text-muted-foreground text-sm sm:text-base">The most celebrated voices from around the world.</p>
      </div>

      <div className="flex bg-secondary p-1 rounded-full mb-8 max-w-sm mx-auto shadow-inner">
         <button 
           onClick={() => setTimeframe('weekly')}
           className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${timeframe === 'weekly' ? 'bg-background shadow font-black text-primary' : 'text-muted-foreground hover:text-foreground'}`}
         >
           Weekly Record
         </button>
         <button 
           onClick={() => setTimeframe('alltime')}
           className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${timeframe === 'alltime' ? 'bg-background shadow font-black text-primary' : 'text-muted-foreground hover:text-foreground'}`}
         >
           All-Time Hall of Fame
         </button>
      </div>

      {currentLeaders.length < 3 ? (
        <div className="mb-12 rounded-3xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <Trophy className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-bold">No rankings yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sing covers and send gifts — live scores will show up here.
          </p>
        </div>
      ) : (
      <div className="flex items-end justify-center gap-2 sm:gap-6 mb-12 h-64 sm:h-72 px-2">
         <div onClick={() => handleSelectProfile(currentLeaders[1]!)} className="flex flex-col items-center w-1/3 max-w-[120px] relative z-10 animate-in slide-in-from-bottom-8 fade-in duration-700 delay-100 cursor-pointer group">
           <div className="relative mb-2 transition-transform group-hover:-translate-y-2">
             <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-slate-300 overflow-hidden shadow-lg object-cover">
               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentLeaders[1]!.avatar}`} className="w-full h-full bg-background" alt="avatar" />
             </div>
             <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center font-black text-slate-500 text-xs sm:text-sm shadow-md">2</div>
           </div>
           <div className="font-bold text-xs sm:text-sm text-center truncate w-full px-1">{currentLeaders[1]!.name}</div>
           <div className="text-[10px] sm:text-xs text-muted-foreground font-mono">{currentLeaders[1]!.score.toLocaleString()}</div>
           <div className="w-full h-24 sm:h-32 bg-gradient-to-t from-slate-200 to-slate-100 mt-2 rounded-t-lg shadow-inner border border-slate-300/50 flex items-center justify-center group-hover:from-slate-300 transition-colors">
             <Star className="w-6 h-6 text-slate-400 group-hover:scale-110 transition-transform" />
           </div>
         </div>

         <div onClick={() => handleSelectProfile(currentLeaders[0]!)} className="flex flex-col items-center w-1/3 max-w-[140px] relative z-20 animate-in slide-in-from-bottom-12 fade-in duration-500 cursor-pointer group">
           <Crown className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500 mb-1 drop-shadow animate-bounce" />
           <div className="relative mb-2 transition-transform group-hover:-translate-y-3">
             <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-yellow-400 overflow-hidden shadow-[0_0_20px_rgba(250,204,21,0.4)] object-cover bg-background">
               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentLeaders[0]!.avatar}`} className="w-full h-full" alt="avatar" />
             </div>
             <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-yellow-400 border-2 border-white flex items-center justify-center font-black text-yellow-900 text-sm shadow-md">1</div>
           </div>
           <div className="font-bold text-sm sm:text-base text-center truncate w-full px-1 text-yellow-600 dark:text-yellow-500">{currentLeaders[0]!.name}</div>
           <div className="text-xs sm:text-sm text-muted-foreground font-mono font-bold text-primary">{currentLeaders[0]!.score.toLocaleString()}</div>
           <div className="w-full h-32 sm:h-40 bg-gradient-to-t from-yellow-300 to-yellow-100 mt-2 rounded-t-lg shadow-inner border border-yellow-300/50 flex flex-col items-center justify-center gap-2 group-hover:from-yellow-400 transition-colors">
              <Star className="w-8 h-8 text-yellow-500 drop-shadow-sm group-hover:scale-125 transition-transform" fill="currentColor" />
              <div className="text-[10px] font-bold text-yellow-700/60 uppercase tracking-widest hidden sm:block delay-150">Champion</div>
           </div>
         </div>

         <div onClick={() => handleSelectProfile(currentLeaders[2]!)} className="flex flex-col items-center w-1/3 max-w-[120px] relative z-10 animate-in slide-in-from-bottom-8 fade-in duration-700 delay-200 cursor-pointer group">
           <div className="relative mb-2 transition-transform group-hover:-translate-y-2">
             <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-orange-300 overflow-hidden shadow-lg object-cover bg-background">
               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentLeaders[2]!.avatar}`} className="w-full h-full" alt="avatar" />
             </div>
             <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-200 border-2 border-white flex items-center justify-center font-black text-orange-600 text-xs sm:text-sm shadow-md">3</div>
           </div>
           <div className="font-bold text-xs sm:text-sm text-center truncate w-full px-1">{currentLeaders[2]!.name}</div>
           <div className="text-[10px] sm:text-xs text-muted-foreground font-mono">{currentLeaders[2]!.score.toLocaleString()}</div>
           <div className="w-full h-20 sm:h-24 bg-gradient-to-t from-orange-200 to-orange-100 mt-2 rounded-t-lg shadow-inner border border-orange-300/50 flex items-center justify-center group-hover:from-orange-300 transition-colors">
             <Star className="w-5 h-5 text-orange-400 group-hover:scale-110 transition-transform" />
           </div>
         </div>
      </div>
      )}

      <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
        {currentLeaders.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            Rankings appear when singers compete.
          </div>
        ) : (
          currentLeaders.slice(3).map((leader) => (
            <button
              key={leader.id}
              type="button"
              onClick={() => handleSelectProfile(leader)}
              className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-secondary/40"
            >
              <span className="w-8 text-center text-sm font-black text-muted-foreground">{leader.rank}</span>
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${leader.avatar}`}
                className="h-10 w-10 rounded-full object-cover"
                alt=""
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{leader.name}</p>
                <p className="truncate text-xs text-muted-foreground">{leader.title}</p>
              </div>
              <span className="font-mono text-xs font-bold">{leader.score.toLocaleString()}</span>
            </button>
          ))
        )}
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-4">
        <img
          src={safeAvatarUrl(currentUser.avatarUrl)}
          className="h-12 w-12 rounded-full object-cover"
          alt=""
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{currentUser.displayName || currentUser.username}</p>
          <p className="text-xs text-muted-foreground">Your {timeframe === 'weekly' ? 'weekly' : 'all-time'} score</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-black text-primary">
            {(timeframe === 'weekly' ? userScore : userAllTimeScore).toLocaleString()}
          </p>
          <TrendingUp className="ml-auto mt-0.5 h-3.5 w-3.5 text-emerald-500" />
        </div>
        <Music className="h-5 w-5 text-muted-foreground" />
      </div>
    </div>
  );
}
