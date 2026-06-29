import React, { useState, useEffect } from 'react';
import { Trophy, Users, Play, Star, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { SingingPlayerModal } from './SingingPlayerModal';

const MOCK_TOP_SUBMISSIONS = [
  { id: '1', title: 'Bohemian Rhapsody Cover', user: '@vocal_star_1', votes: 125000, rank: 1, avatar: 11, voted: false },
  { id: '2', title: 'Someone Like You 🎤', user: '@melody_queen', votes: 98000, rank: 2, avatar: 12, voted: false },
  { id: '3', title: 'I Will Always Love You (Acoustic)', user: '@power_vocals', votes: 75000, rank: 3, avatar: 13, voted: true },
  { id: '4', title: 'Stand By Me - Full Band', user: '@johnny_b_good', votes: 45000, rank: 4, avatar: 14, voted: false },
  { id: '5', title: 'Shallow (Duet attempt)', user: '@singer_boy', votes: 32000, rank: 5, avatar: 15, voted: false },
];

const MY_ENTRIES = [
  { id: 'me1', title: 'My Bohemian Rhapsody Version!', views: 1205, votes: 450, rank: 1542 }
];

export function ChallengeView({ onSing, onSelectProfile }: { onSing: () => void, onSelectProfile?: (user: any) => void }) {
  const [activeTab, setActiveTab] = useState<'top' | 'mine' | 'rules'>('top');
  const [submissions, setSubmissions] = useState(MOCK_TOP_SUBMISSIONS);
  const [timeLeft, setTimeLeft] = useState(12 * 3600 + 45 * 60); // 12:45:00 in seconds
  const [activePlayerPost, setActivePlayerPost] = useState<any | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Real-time vote increment simulation
    const voteTimer = setInterval(() => {
       setSubmissions(prev => {
          const newSubs = [...prev];
          const randomIndex = Math.floor(Math.random() * newSubs.length);
          newSubs[randomIndex] = {
             ...newSubs[randomIndex],
             votes: newSubs[randomIndex].votes + Math.floor(Math.random() * 5)
          };
          return newSubs.sort((a, b) => b.votes - a.votes).map((sub, idx) => ({ ...sub, rank: idx + 1 }));
       });
    }, 3000);
    return () => clearInterval(voteTimer);
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleVote = (id: string) => {
    setSubmissions(prev => prev.map(sub => {
      if (sub.id === id) {
        return { 
          ...sub, 
          votes: sub.voted ? sub.votes - 1 : sub.votes + 1,
          voted: !sub.voted
        };
      }
      return sub;
    }));
  };

  return (
    <div className="p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden mb-8 shadow-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 p-8 text-white">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-amber-400 drop-shadow-lg" />
          <h2 className="text-4xl sm:text-5xl font-black mb-4 uppercase tracking-tight">Karaoke Idol 2026</h2>
          <p className="text-lg text-white/90 mb-8">The ultimate global singing competition. Top 10 users with the most votes win a professional studio recording session and 50,000 Coins!</p>
          <div className="flex flex-wrap justify-center gap-4">
             <div className="px-6 py-3 bg-black/40 backdrop-blur border border-white/20 rounded-xl">
                <div className="text-sm text-white/70 font-semibold uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                  <Clock className="w-4 h-4" /> Time Remaining
                </div>
                <div className="text-3xl font-mono font-bold">{formatTime(timeLeft)}</div>
             </div>
             <div className="px-6 py-3 bg-black/40 backdrop-blur border border-white/20 rounded-xl">
                <div className="text-sm text-white/70 font-semibold uppercase tracking-wider mb-1">Participants</div>
                <div className="text-3xl font-mono font-bold flex items-center justify-center gap-2">
                  <Users className="w-6 h-6 text-primary" /> 124K
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-4 border-b border-border mb-6 overflow-x-auto no-scrollbar shrink-0">
        <button 
          onClick={() => setActiveTab('top')}
          className={`pb-3 border-b-2 font-bold whitespace-nowrap transition-colors ${activeTab === 'top' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Top Submissions
        </button>
        <button 
          onClick={() => setActiveTab('mine')}
          className={`pb-3 border-b-2 font-bold whitespace-nowrap transition-colors ${activeTab === 'mine' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          My Entries
        </button>
        <button 
          onClick={() => setActiveTab('rules')}
          className={`pb-3 border-b-2 font-bold whitespace-nowrap transition-colors ${activeTab === 'rules' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Rules
        </button>
      </div>

      {/* Main Submit Button */}
      {activeTab !== 'rules' && (
        <button 
          onClick={onSing}
          className="w-full mb-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-lg uppercase tracking-wider rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          Submit Your Cover
        </button>
      )}

      {/* Tabs Content */}
      <div className="space-y-4">
        {activeTab === 'top' && submissions.map(sub => (
          <div key={sub.id} className="bg-card rounded-2xl p-4 border border-border flex items-center gap-3 sm:gap-4 hover:shadow-md transition">
             <div className={`font-black text-2xl w-6 sm:w-8 text-center ${sub.rank === 1 ? 'text-amber-500' : sub.rank === 2 ? 'text-zinc-400' : sub.rank === 3 ? 'text-orange-400' : 'text-muted-foreground'}`}>{sub.rank}</div>
             <div 
               className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 relative cursor-pointer"
               onClick={() => setActivePlayerPost({
                 id: sub.id,
                 user: { username: sub.user, avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${sub.avatar}` },
                 caption: sub.title,
                 likes: Math.floor(sub.votes / 1000),
                 imageUrl: `https://picsum.photos/seed/karaoke${sub.id}/400/500`
               })}
             >
               <img src={`https://picsum.photos/seed/karaoke${sub.id}/200/200`} className="w-full h-full object-cover" alt="Cover" />
               <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                 <Play className="w-6 h-6 text-white fill-current shadow-lg drop-shadow-md" />
               </div>
             </div>
             <div className="flex-1 min-w-0">
               <h4 className="font-bold text-[15px] sm:text-lg truncate">{sub.title}</h4>
               <p 
                 onClick={() => {
                   if (onSelectProfile) {
                     onSelectProfile({
                       name: sub.user.replace('@', ''),
                       handle: sub.user,
                       avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${sub.avatar}`,
                       followers: '10.5k',
                       likes: '350k',
                       gifts: '8.2M',
                       description: 'Check out my covers! 🎶'
                     });
                   }
                 }}
                 className="text-xs sm:text-sm text-muted-foreground truncate hover:text-primary hover:underline cursor-pointer transition-colors"
               >
                 {sub.user}
               </p>
             </div>
             <div className="flex flex-col items-end gap-1.5 sm:gap-2 shrink-0">
               <div className="flex items-center gap-1 font-bold text-amber-500 bg-amber-500/10 px-2 sm:px-3 py-1 rounded-full text-[11px] sm:text-sm">
                 <Star className="w-3.5 h-3.5 fill-amber-500" /> {(sub.votes / 1000).toFixed(1)}k
               </div>
               <button 
                 onClick={() => handleVote(sub.id)}
                 className={`text-[11px] sm:text-xs font-bold px-3 py-1 rounded-full transition-all border ${sub.voted ? 'bg-primary text-primary-foreground border-primary' : 'text-primary border-primary hover:bg-primary/10'}`}
               >
                 {sub.voted ? 'Voted' : 'Vote'}
               </button>
             </div>
          </div>
        ))}

        {activeTab === 'mine' && (
          <>
            {MY_ENTRIES.map(entry => (
              <div key={entry.id} className="bg-card rounded-2xl p-4 sm:p-5 border border-border flex flex-col gap-3">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h4 className="font-bold text-lg mb-1">{entry.title}</h4>
                    <span className="text-xs font-bold bg-green-500/10 text-green-500 px-2 py-1 rounded-sm uppercase tracking-wider">Approved</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-amber-500">#{entry.rank}</div>
                    <div className="text-xs text-muted-foreground font-semibold uppercase">Current Rank</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                    <Star className="w-4 h-4" /> {entry.votes} Votes
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                    <Play className="w-4 h-4" /> {entry.views} Views
                  </div>
                </div>
              </div>
            ))}
            <div className="text-center p-8 border-2 border-dashed border-border rounded-2xl opacity-60">
               <p className="font-bold text-muted-foreground mb-2">You can submit up to 3 entries!</p>
               <button onClick={onSing} className="text-primary font-bold hover:underline">Submit another cover</button>
            </div>
          </>
        )}

        {activeTab === 'rules' && (
          <div className="bg-card rounded-2xl p-5 sm:p-8 border border-border">
            <h3 className="text-xl font-black mb-6 flex items-center gap-2"><Trophy className="w-6 h-6 text-amber-500" /> Contest Rules</h3>
            <ul className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Eligibility:</strong> Open to all registered users worldwide. You must be at least 13 years old to participate.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Submissions:</strong> Maximum of 3 submissions per user. Must be a live cover using the in-app Studio. Pre-recorded uploads are strictly prohibited and will be disqualified.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Voting:</strong> Users receive 5 free votes daily to distribute however they please. Duplicate votes on the same entry from the same account cast within 24 hours will not count.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Prizes:</strong> Top 10 users by total vote count at the end of the timer will be contacted via email regarding the studio session prize. 50,000 Coins will be credited to accounts within 72 hours.</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {activePlayerPost && (
         <SingingPlayerModal 
           post={activePlayerPost} 
           mode="listen"
           onClose={() => setActivePlayerPost(null)}
         />
      )}
    </div>
  );
}
