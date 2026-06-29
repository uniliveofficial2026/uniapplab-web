import React, { useState } from "react";
import { X, Trophy, Sparkles, Star, Coins, Heart, Send } from "lucide-react";

export interface ArenaParticipant {
  id: string;
  name: string;
  nick: string;
  avatar: string;
  score: number;
}

interface ArenaRankingsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  participants: ArenaParticipant[];
  onSendSupport: (participantId: string, giftName: string, giftIcon: string, amount: number) => void;
  countdownText: string;
}

export function ArenaRankingsOverlay({ isOpen, onClose, participants, onSendSupport, countdownText }: ArenaRankingsOverlayProps) {
  const [selectedId, setSelectedId] = useState<string>(participants[0]?.id || "");
  const [customAmount, setCustomAmount] = useState<string>("50");
  const [activeGiftIdx, setActiveGiftIdx] = useState<number>(0);

  if (!isOpen) return null;

  const gifts = [
    { name: "Love Heart", icon: "💖", price: 5, scoreValue: 50 },
    { name: "Magic Mic", icon: "🎤", price: 25, scoreValue: 250 },
    { name: "Superstar Trophy", icon: "🏆", price: 100, scoreValue: 1000 },
    { name: "Dragon Castle", icon: "🏰", price: 500, scoreValue: 5000 },
  ];

  const handleGiftClick = (index: number) => {
    setActiveGiftIdx(index);
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = participants.find(p => p.id === selectedId);
    if (!candidate) return;

    const chosenGift = gifts[activeGiftIdx];
    onSendSupport(candidate.id, chosenGift.name, chosenGift.icon, chosenGift.scoreValue);
  };

  const handleCustomSupport = (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = participants.find(p => p.id === selectedId);
    if (!candidate) return;

    const amount = parseInt(customAmount);
    if (isNaN(amount) || amount <= 0) return;

    onSendSupport(candidate.id, "Custom Stars Support", "⭐", amount * 10);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex flex-col justify-end pointer-events-auto">
      <div className="bg-[#1c0f32] w-full max-h-[85vh] rounded-t-3xl border-t border-fuchsia-500/30 flex flex-col overflow-hidden shadow-[0_-15px_50px_rgba(236,72,153,0.25)] animate-fade-in-up">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-[#2a134a] to-[#120724] border-b border-white/5">
          <div className="flex items-center space-x-2.5">
            <div className="w-[30px] h-[30px] rounded-full bg-yellow-500/15 flex items-center justify-center border border-yellow-500/30">
              <Trophy size={16} className="text-yellow-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest textShadow">Arena Tournament Rankings</h2>
              <p className="text-[10px] text-gray-400">Support your pathfinder of interest to conquer the crown</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition active:scale-95">
            <X size={18} />
          </button>
        </div>

        {/* Global Stats bar */}
        <div className="bg-[#0f071e] py-2 px-6 flex justify-between items-center text-[11px] border-b border-white/5">
          <div className="flex items-center space-x-1.5 font-semibold text-yellow-300">
            <Sparkles size={11} className="text-yellow-400" />
            <span>Time Remaining:</span>
            <span className="font-mono text-white bg-slate-800/60 px-2 py-0.5 rounded font-black text-xs border border-white/10">
              {countdownText}
            </span>
          </div>
          <span className="text-[10px] font-bold text-pink-400 uppercase tracking-widest animate-pulse">● LIVE BATTLE ONGOING</span>
        </div>

        {/* Dynamic Split Layout */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-hide pb-8">
          {/* Main ranking blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* LEFT COLUMN: CANDIDATES GRID AND RANKINGS */}
            <div className="space-y-2.5">
              <div className="text-[10px] font-black text-purple-400 uppercase tracking-wider mb-1 pl-1">
                Contestants Leaderboard
              </div>
              {participants.map((p, idx) => {
                const isSelected = p.id === selectedId;
                const medalBg = idx === 0 ? "bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-500/20" 
                              : idx === 1 ? "bg-slate-300 text-black border-slate-200" 
                              : idx === 2 ? "bg-amber-700 text-white border-amber-800" 
                              : "bg-white/5 text-gray-400";
                const medalText = idx === 0 ? "👑 Rank 1" 
                                : idx === 1 ? "🎸 Rank 2" 
                                : idx === 2 ? "🎙️ Rank 3" 
                                : `#${idx + 1}`;

                return (
                  <div 
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition relative border ${
                      isSelected 
                        ? "bg-gradient-to-r from-purple-800/40 via-[#27104b] to-[#120724] border-fuchsia-500/50 shadow-md" 
                        : "bg-black/30 border-white/5 hover:bg-black/50 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      {/* Medals */}
                      <span className={`w-[22px] h-[22px] rounded-full text-[9px] font-black flex items-center justify-center border shrink-0 ${medalBg}`}>
                        {idx + 1}
                      </span>
                      
                      {/* Profile Image */}
                      <div className="relative">
                        <img src={p.avatar} alt={p.name} className="w-10 h-10 rounded-full object-cover border border-purple-500/40" />
                        {idx === 0 && (
                          <div className="absolute -top-1.5 -right-1.5 animate-bounce">
                            👑
                          </div>
                        )}
                      </div>

                      <div className="text-left min-w-0">
                        <span className="text-xs font-black text-white hover:text-purple-300 block truncate">
                          {p.name}
                        </span>
                        <span className="text-[10px] text-gray-400 block truncate">
                          {p.nick}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end shrink-0 pl-2">
                      <span className="text-yellow-400 font-extrabold text-[12.5px] tracking-tight font-mono">
                        🔥 {p.score.toLocaleString()}
                      </span>
                      <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full mt-1 ${idx === 0 ? 'text-amber-300 bg-amber-500/10' : 'text-purple-300 bg-purple-500/10'}`}>
                        {medalText}
                      </span>
                    </div>

                    {/* Radio overlay Indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* RIGHT COLUMN: INTERACTIVE GIVING PORTAL */}
            <div className="space-y-4">
              {(() => {
                const activeContestant = participants.find(p => p.id === selectedId);
                if (!activeContestant) return null;

                return (
                  <div className="bg-[#120724]/80 rounded-2xl p-4 border border-fuchsia-500/20 text-center flex flex-col justify-between h-full">
                    <div>
                      <div className="text-[10px] font-black text-pink-400 uppercase tracking-wider mb-2.5 text-left">
                        Send Arena Support to
                      </div>
                      
                      {/* Selected Candidate Preview card */}
                      <div className="bg-[#1e0f33] p-3.5 rounded-2xl border border-white/5 flex items-center space-x-3.5 mb-4 animate-fade-in text-left">
                        <img src={activeContestant.avatar} alt={activeContestant.name} className="w-12 h-12 rounded-full object-cover border-2 border-fuchsia-500 shadow-md shadow-pink-500/10" />
                        <div>
                          <div className="text-gray-400 text-[9px] font-medium uppercase tracking-wider">Candidate Support target</div>
                          <div className="text-sm font-black text-white">{activeContestant.name}</div>
                          <div className="text-xs text-yellow-400 font-semibold font-mono mt-0.5">Arena Score: 🔥{activeContestant.score}</div>
                        </div>
                      </div>

                      {/* Gifts Carousel */}
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {gifts.map((g, idx) => {
                          const isActive = activeGiftIdx === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleGiftClick(idx)}
                              className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                                isActive 
                                  ? "bg-gradient-to-br from-pink-500/20 to-purple-600/30 border-pink-500 shadow-inner" 
                                  : "bg-black/30 border-white/5 hover:border-white/10"
                              }`}
                            >
                              <span className="text-2.5xl mb-0.5">{g.icon}</span>
                              <span className="text-[10px] font-black text-white truncate max-w-full">{g.name}</span>
                              <span className="text-[9px] text-pink-300 font-bold mt-0.5">{g.price} c</span>
                              <span className="text-[8px] text-[#02faab] font-mono mt-0.5">+{g.scoreValue} score</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      {/* Form action preset button */}
                      <button
                        onClick={handleSupportSubmit}
                        className="w-full bg-gradient-to-r from-red-500 via-[#FF3B70] to-purple-600 hover:opacity-95 active:scale-95 text-white font-black text-xs py-3 rounded-full uppercase tracking-widest shadow-lg shadow-pink-500/20 flex items-center justify-center space-x-2 transition cursor-pointer"
                      >
                        <Heart size={14} className="fill-white" />
                        <span>Support with virtual item</span>
                      </button>

                      {/* Divider */}
                      <div className="relative flex items-center my-1 select-none">
                        <div className="flex-grow border-t border-white/5"></div>
                        <span className="flex-shrink mx-2 text-[8.5px] font-black text-purple-400 uppercase tracking-widest">Or Custom Stars Amount</span>
                        <div className="flex-grow border-t border-white/5"></div>
                      </div>

                      {/* Custom Amount Form */}
                      <form onSubmit={handleCustomSupport} className="flex space-x-2">
                        <div className="relative flex-1">
                          <input 
                            type="number"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            placeholder="Enter Stars..."
                            className="w-full bg-[#1e0f33] border border-white/10 rounded-full pl-3.5 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 font-bold"
                          />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-yellow-400 text-xs">⭐</span>
                        </div>
                        <button
                          type="submit"
                          className="bg-purple-600/35 hover:bg-purple-600/60 border border-purple-500/40 text-purple-200 active:scale-95 px-3 rounded-full flex items-center justify-center transition cursor-pointer"
                          title="Send custom support"
                        >
                          <Send size={12} />
                        </button>
                      </form>
                    </div>

                  </div>
                );
              })()}
            </div>

          </div>

          <div className="bg-black/30 border border-white/5 rounded-2xl p-3.5 text-left flex items-start space-x-3 select-none">
            <Coins size={16} className="text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[11px] font-black text-gray-100 uppercase tracking-wide">Dynamic Rank Swapping Rules</h4>
              <p className="text-[9.5px] text-gray-400 mt-0.5">
                Pathfinder points are generated continuously by chat activity and singing loops. Gifting or sending special support stars instantly multiplies the candidate's scores. When a candidate's score exceeds their immediate superior, they climb up in the rankings in real-time!
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
