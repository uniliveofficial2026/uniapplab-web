import React, { useState, useEffect } from 'react';
import { Crown, Trophy, TrendingUp, Music, Star } from 'lucide-react';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { safeAvatarUrl } from '../../lib/safe';

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

export function LeaderboardView({ onSelectProfile }: { onSelectProfile?: (user: any) => void }) {
  const [timeframe, setTimeframe] = useState<'weekly' | 'alltime'>('weekly');
  const currentUser = useCurrentUser();

  const [weeklyLeaders, setWeeklyLeaders] = useState(WEEKLY_LEADERS);
  const [allTimeLeaders, setAllTimeLeaders] = useState(ALL_TIME_LEADERS);

  useEffect(() => {
    const timer = setInterval(() => {
       setWeeklyLeaders(prev => {
          const newLeaders = [...prev];
          const randomIndex = Math.floor(Math.random() * newLeaders.length);
          newLeaders[randomIndex] = {
             ...newLeaders[randomIndex],
             score: newLeaders[randomIndex].score + Math.floor(Math.random() * 500)
          };
          return newLeaders.sort((a, b) => b.score - a.score).map((l, i) => ({ ...l, rank: i + 1 }));
       });

       setAllTimeLeaders(prev => {
          const newLeaders = [...prev];
          const randomIndex = Math.floor(Math.random() * newLeaders.length);
          newLeaders[randomIndex] = {
             ...newLeaders[randomIndex],
             score: newLeaders[randomIndex].score + Math.floor(Math.random() * 5000)
          };
          return newLeaders.sort((a, b) => b.score - a.score).map((l, i) => ({ ...l, rank: i + 1 }));
       });
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const [userScore, setUserScore] = useState(1240500);
  const [userAllTimeScore, setUserAllTimeScore] = useState(15640200);

  useEffect(() => {
     const userTimer = setInterval(() => {
        setUserScore(s => s + Math.floor(Math.random() * 10));
        setUserAllTimeScore(s => s + Math.floor(Math.random() * 10));
     }, 3000);
     return () => clearInterval(userTimer);
  }, []);

  const currentLeaders = timeframe === 'weekly' ? weeklyLeaders : allTimeLeaders;

  const handleSelectProfile = (leader: any) => {
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
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 to-yellow-600 mb-4 shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-transform hover:scale-105">
           <Trophy className="w-8 h-8 text-white drop-shadow-md" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">Global Leaderboard</h1>
        <p className="text-muted-foreground text-sm sm:text-base">The most celebrated voices from around the world.</p>
      </div>

      {/* Toggles */}
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

      {/* Top 3 Podium */}
      <div className="flex items-end justify-center gap-2 sm:gap-6 mb-12 h-64 sm:h-72 px-2">
         {/* Rank 2 */}
         <div onClick={() => handleSelectProfile(currentLeaders[1])} className="flex flex-col items-center w-1/3 max-w-[120px] relative z-10 animate-in slide-in-from-bottom-8 fade-in duration-700 delay-100 cursor-pointer group">
           <div className="relative mb-2 transition-transform group-hover:-translate-y-2">
             <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-slate-300 overflow-hidden shadow-lg object-cover">
               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentLeaders[1].avatar}`} className="w-full h-full bg-background" alt="avatar" />
             </div>
             <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center font-black text-slate-500 text-xs sm:text-sm shadow-md">2</div>
           </div>
           <div className="font-bold text-xs sm:text-sm text-center truncate w-full px-1">{currentLeaders[1].name}</div>
           <div className="text-[10px] sm:text-xs text-muted-foreground font-mono">{currentLeaders[1].score.toLocaleString()}</div>
           <div className="w-full h-24 sm:h-32 bg-gradient-to-t from-slate-200 to-slate-100 mt-2 rounded-t-lg shadow-inner border border-slate-300/50 flex items-center justify-center group-hover:from-slate-300 transition-colors">
             <Star className="w-6 h-6 text-slate-400 group-hover:scale-110 transition-transform" />
           </div>
         </div>

         {/* Rank 1 */}
         <div onClick={() => handleSelectProfile(currentLeaders[0])} className="flex flex-col items-center w-1/3 max-w-[140px] relative z-20 animate-in slide-in-from-bottom-12 fade-in duration-500 cursor-pointer group">
           <Crown className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500 mb-1 drop-shadow animate-bounce" />
           <div className="relative mb-2 transition-transform group-hover:-translate-y-3">
             <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-yellow-400 overflow-hidden shadow-[0_0_20px_rgba(250,204,21,0.4)] object-cover bg-background">
               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentLeaders[0].avatar}`} className="w-full h-full" alt="avatar" />
             </div>
             <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-yellow-400 border-2 border-white flex items-center justify-center font-black text-yellow-900 text-sm shadow-md">1</div>
           </div>
           <div className="font-bold text-sm sm:text-base text-center truncate w-full px-1 text-yellow-600 dark:text-yellow-500">{currentLeaders[0].name}</div>
           <div className="text-xs sm:text-sm text-muted-foreground font-mono font-bold text-primary">{currentLeaders[0].score.toLocaleString()}</div>
           <div className="w-full h-32 sm:h-40 bg-gradient-to-t from-yellow-300 to-yellow-100 mt-2 rounded-t-lg shadow-inner border border-yellow-300/50 flex flex-col items-center justify-center gap-2 group-hover:from-yellow-400 transition-colors">
              <Star className="w-8 h-8 text-yellow-500 drop-shadow-sm group-hover:scale-125 transition-transform" fill="currentColor" />
              <div className="text-[10px] font-bold text-yellow-700/60 uppercase tracking-widest hidden sm:block delay-150">Champion</div>
           </div>
         </div>

         {/* Rank 3 */}
         <div onClick={() => handleSelectProfile(currentLeaders[2])} className="flex flex-col items-center w-1/3 max-w-[120px] relative z-10 animate-in slide-in-from-bottom-8 fade-in duration-700 delay-200 cursor-pointer group">
           <div className="relative mb-2 transition-transform group-hover:-translate-y-2">
             <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-orange-300 overflow-hidden shadow-lg object-cover bg-background">
               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentLeaders[2].avatar}`} className="w-full h-full" alt="avatar" />
             </div>
             <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-200 border-2 border-white flex items-center justify-center font-black text-orange-600 text-xs sm:text-sm shadow-md">3</div>
           </div>
           <div className="font-bold text-xs sm:text-sm text-center truncate w-full px-1">{currentLeaders[2].name}</div>
           <div className="text-[10px] sm:text-xs text-muted-foreground font-mono">{currentLeaders[2].score.toLocaleString()}</div>
           <div className="w-full h-20 sm:h-24 bg-gradient-to-t from-orange-200 to-orange-100 mt-2 rounded-t-lg shadow-inner border border-orange-300/50 flex items-center justify-center group-hover:from-orange-300 transition-colors">
             <Star className="w-5 h-5 text-orange-400 group-hover:scale-110 transition-transform" />
           </div>
         </div>
      </div>

      {/* List Container */}
      <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
         <div className="px-6 py-4 border-b border-border bg-secondary/30 flex items-center justify-between">
           <span className="font-bold text-sm text-muted-foreground tracking-wider uppercase">Rank & Name</span>
           <span className="font-bold text-sm text-muted-foreground tracking-wider uppercase">Score</span>
         </div>
         
         <div className="divide-y divide-border">
            {currentLeaders.slice(3).map((leader) => (
              <div key={leader.id} onClick={() => handleSelectProfile(leader)} className="flex items-center px-4 sm:px-6 py-4 hover:bg-secondary/50 cursor-pointer transition-colors group">
                
                <div className="w-8 text-center font-black text-muted-foreground group-hover:text-foreground transition-colors shrink-0">{leader.rank}</div>
                
                <div className="flex-1 flex items-center gap-3 sm:gap-4 ml-2 sm:ml-4 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-secondary shrink-0 border border-border group-hover:border-primary/50 transition-colors">
                     <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${leader.avatar}`} className="w-full h-full object-cover" alt="avatar" />
                  </div>
                  <div className="flex flex-col min-w-0 pr-4">
                     <div className="flex items-center gap-2">
                        <span className="font-bold text-sm sm:text-base truncate group-hover:text-primary transition-colors">{leader.name}</span>
                        {leader.change === 'up' && <TrendingUp className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                        {leader.change === 'down' && <TrendingUp className="w-3.5 h-3.5 text-red-500 flex-shrink-0 transform rotate-180" />}
                     </div>
                     <span className="text-[11px] sm:text-sm text-muted-foreground truncate">{leader.title}</span>
                  </div>
                </div>

                <div className="font-mono font-bold text-sm sm:text-base text-right text-primary shrink-0 tabular-nums">
                  {leader.score.toLocaleString()}
                </div>
              </div>
            ))}
         </div>
      </div>

      {/* You row (sticky bottom) */}
      <div className="mt-4 bg-primary/10 border-2 border-primary/20 rounded-2xl p-4 sm:p-5 flex items-center justify-between lg:sticky lg:bottom-4 backdrop-blur-md shadow-lg">
         <div className="flex items-center gap-4">
            <div className="w-8 text-center font-black text-primary text-lg">#{timeframe === 'weekly' ? '142' : '8,903'}</div>
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary">
                  <img src={safeAvatarUrl(currentUser.avatarUrl)} className="w-full h-full object-cover bg-background" />
               </div>
               <div>
                 <div className="font-bold text-base">{currentUser.displayName || currentUser.username}</div>
                 <div className="text-xs text-primary font-medium tracking-wide">Keep singing to rank up!</div>
               </div>
            </div>
         </div>
         <div className="font-mono font-black text-base sm:text-lg text-primary tabular-nums">
            {(timeframe === 'weekly' ? userScore : userAllTimeScore).toLocaleString()}
         </div>
      </div>

    </div>
  );
}
