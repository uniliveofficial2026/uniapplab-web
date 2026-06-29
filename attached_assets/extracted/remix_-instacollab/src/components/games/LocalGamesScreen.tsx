import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, Play, Circle, Plus, Clock, BarChart3, ChevronRight, Upload } from 'lucide-react';
import { useDB } from '../../lib/useDB';

export function LocalGamesScreen() {
  const db = useDB();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [games, setGames] = useState(() => db.load('local_games', [
    { id: 'l1', name: 'Infinite Runner', status: 'Installed', playtime: '12h 45m', image: 'bg-gradient-to-tr from-orange-500 to-red-600' },
    { id: 'l2', name: 'Retro Adventure', status: 'Needs Update', playtime: '45h 10m', image: 'bg-gradient-to-tr from-blue-600 to-purple-700' },
  ]));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const newGame = {
      id: `l_${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
      status: 'Installed',
      playtime: '0m',
      image: 'bg-gradient-to-tr from-gray-500 to-gray-700'
    };
    
    const updatedGames = [...games, newGame];
    setGames(updatedGames);
    db.save('local_games', updatedGames);
  };

  const featuredGame = games[0];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 md:p-10 max-w-7xl mx-auto space-y-12"
    >
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".exe,.app" />

      {/* Featured Game Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h1 className="text-4xl font-black text-foreground tracking-tighter">My Library</h1>
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground hover:opacity-90 rounded-xl text-xs font-black transition-all w-full sm:w-auto justify-center sm:justify-start"
            >
                <Upload className="w-4 h-4" /> Import Executable
            </button>
        </div>

        {featuredGame && (
          <motion.div 
            whileHover={{ scale: 1.01 }}
            className={`relative h-64 rounded-3xl p-8 flex flex-col justify-end text-white ${featuredGame.image}`}
          >
            <div className="absolute top-6 left-8 bg-black/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Recently Played</div>
            <h2 className="text-3xl font-black">{featuredGame.name}</h2>
            <p className="text-white/80 font-semibold text-xs mt-1">Total Playtime: {featuredGame.playtime}</p>
            <button className="mt-4 w-32 bg-white text-black font-black text-xs py-3 rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2">
              <Play className="w-3 h-3 fill-black" /> Continue
            </button>
          </motion.div>
        )}
      </div>

      {/* Installed Games List */}
      <div className="space-y-6">
        <h3 className="text-xl font-black text-foreground">Installed Games ({games.length})</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {games.map(game => (
              <motion.div 
                key={game.id}
                layout
                className="group p-5 bg-card border border-border rounded-3xl flex items-center gap-5 hover:border-primary/40 transition-all shadow-sm"
              >
                <div className={`w-20 h-20 rounded-2xl ${game.image} shrink-0`} />
                
                <div className="flex-1 min-w-0">
                    <h4 className="font-black text-sm text-foreground truncate">{game.name}</h4>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground font-semibold">
                      <span className="flex items-center gap-1">
                        <Circle className={`w-2 h-2 fill-current ${game.status === 'Installed' ? 'text-emerald-500' : 'text-amber-500'}`} />
                        {game.status}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {game.playtime}
                      </span>
                    </div>
                </div>

                <button className="p-3 bg-secondary hover:bg-primary hover:text-primary-foreground rounded-xl transition-all">
                    <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Footer Stats / Storage */}
      <div className="bg-card border border-border rounded-3xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary shrink-0"><BarChart3 className="w-6 h-6" /></div>
              <div>
                  <h4 className="font-black text-sm">Storage Usage</h4>
                  <p className="text-[11px] text-muted-foreground font-semibold">{(games.length * 12.5).toFixed(1)} GB / 500 GB used across library</p>
              </div>
          </div>
          <div className="h-2 w-full sm:w-48 bg-secondary rounded-full overflow-hidden shrink-0">
              <div className="h-full w-[10%] bg-primary rounded-full" />
          </div>
      </div>
    </motion.div>
  );
}
