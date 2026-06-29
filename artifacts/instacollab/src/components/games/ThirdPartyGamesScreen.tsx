import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Zap, Target, Rocket, Gamepad2, Search, Star, Loader2, Check } from 'lucide-react';
import { useDB } from '../../lib/useDB';

const FEATURED_GAMES = [
  { id: 'f1', name: 'Cyberpunk Arena 2077', category: 'Action', players: '12.5k', image: 'bg-gradient-to-br from-purple-600 to-indigo-600' },
  { id: 'f2', name: 'Neon Flight', category: 'Arcade', players: '8.2k', image: 'bg-gradient-to-br from-emerald-500 to-teal-700' },
];

const GAMES = [
  { id: 'g1', name: 'Space Shooter', category: 'Action', players: '5k', icon: Rocket },
  { id: 'g2', name: 'Arena Battle', category: 'RPG', players: '3k', icon: Target },
  { id: 'g3', name: 'Speed Racer', category: 'Racing', players: '7k', icon: Zap },
  { id: 'g4', name: 'Card Duel', category: 'Strategy', players: '2k', icon: Star },
  { id: 'g5', name: 'Puzzle Quest', category: 'Puzzle', players: '9k', icon: Gamepad2 },
];

const CATEGORIES = ['All', 'Action', 'RPG', 'Racing', 'Strategy', 'Puzzle'];

export function ThirdPartyGamesScreen() {
  const db = useDB();
  const [activeCat, setActiveCat] = useState('All');
  const [linkedAccounts, setLinkedAccounts] = useState(() => db.load('linked_accounts', { steam: false, epic: false }));
  const [loading, setLoading] = useState<string | null>(null);

  const handleLinkAccount = (platform: 'steam' | 'epic') => {
    setLoading(platform);
    setTimeout(() => {
        const nextLinked = { ...linkedAccounts, [platform]: true };
        setLinkedAccounts(nextLinked);
        db.save('linked_accounts', nextLinked);
        setLoading(null);
    }, 1500);
  };

  const filteredGames = activeCat === 'All' 
    ? GAMES 
    : GAMES.filter(g => g.category === activeCat);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 md:p-10 max-w-7xl w-full mx-auto space-y-12 overflow-x-hidden min-w-0"
    >
      {/* Integrations Section */}
      <div className="bg-card border border-border p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm min-w-0">
          <h3 className="font-black text-sm shrink-0">Account Integrations</h3>
          <div className="flex flex-wrap gap-4 w-full min-w-0">
              {['steam', 'epic'].map(platform => (
                  <button 
                    key={platform}
                    onClick={() => !linkedAccounts[platform as 'steam' | 'epic'] && handleLinkAccount(platform as 'steam' | 'epic')}
                    disabled={linkedAccounts[platform as 'steam' | 'epic']}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all flex-1 sm:flex-none min-w-[120px] ${
                        linkedAccounts[platform as 'steam' | 'epic'] 
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                        : 'bg-secondary hover:bg-secondary/80'
                    }`}
                  >
                      {loading === platform ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : linkedAccounts[platform as 'steam' | 'epic'] ? <Check className="w-4 h-4 shrink-0" /> : <Globe className="w-4 h-4 shrink-0" />}
                      <span className="truncate">{linkedAccounts[platform as 'steam' | 'epic'] ? `${platform.toUpperCase()} Linked` : `Link ${platform.toUpperCase()}`}</span>
                  </button>
              ))}
          </div>
      </div>

      {/* Hero Section */}
      <div className="space-y-6">
        <h1 className="text-4xl font-black text-foreground tracking-tighter">Third Party Games Hub</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURED_GAMES.map(game => (
            <motion.div 
              key={game.id}
              whileHover={{ scale: 1.02 }}
              className={`relative h-64 rounded-3xl p-8 flex flex-col justify-end text-white overflow-hidden min-w-0 ${game.image}`}
            >
              <div className="absolute top-6 left-8 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 max-w-[80%] truncate">Featured</div>
              <h2 className="text-2xl font-black truncate">{game.name}</h2>
              <p className="text-white/70 font-semibold text-xs mt-1 truncate">{game.category} • {game.players} Active</p>
              <button className="mt-4 w-32 bg-white text-black font-black text-xs py-3 rounded-xl hover:bg-white/90 transition-all shrink-0">Play Now</button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Filter Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="text-xl font-black text-foreground">All Games</h3>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input placeholder="Search games..." className="w-full sm:w-auto pl-10 pr-4 py-2 bg-secondary rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar w-full min-w-0">
          {CATEGORIES.map(cat => (
            <button 
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeCat === cat ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-secondary border border-border'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <motion.div 
          layout
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6"
        >
          <AnimatePresence>
            {filteredGames.map(game => (
              <motion.button 
                key={game.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group flex flex-col items-center gap-4 p-6 bg-card border border-border rounded-3xl hover:border-primary/40 transition-all"
              >
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors shrink-0">
                  <game.icon className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-center w-full min-w-0">
                  <h4 className="font-bold text-sm text-foreground truncate">{game.name}</h4>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-1 truncate">{game.players} players</p>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}
