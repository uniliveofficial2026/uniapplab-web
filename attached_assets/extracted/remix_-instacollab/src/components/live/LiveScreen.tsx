import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, Users, Eye, Play, Sparkles } from 'lucide-react';

const LIVE_STREAMS = [
  { id: '1', title: 'Speed Run: Retro Adventure', creator: 'GamerOne', viewers: '1.2k', image: 'bg-gradient-to-tr from-orange-500 to-red-600' },
  { id: '2', title: 'Creative Design Session', creator: 'ArtBot', viewers: '2.5k', image: 'bg-gradient-to-tr from-purple-600 to-indigo-700' },
  { id: '3', title: 'Cozy Puzzle Time', creator: 'PuzzleQueen', viewers: '850', image: 'bg-gradient-to-tr from-emerald-500 to-teal-700' },
];

export function LiveScreen() {
  const [activeStream, setActiveStream] = useState(LIVE_STREAMS[0]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 md:p-10 max-w-7xl mx-auto space-y-8"
    >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-4xl font-black text-foreground tracking-tighter flex items-center gap-3">
            <Radio className="w-10 h-10 text-rose-500" />
            Live Hub
          </h1>
          <button className="px-5 py-2.5 bg-rose-500 text-white rounded-xl text-xs font-black flex items-center gap-2 hover:bg-rose-600 transition-all w-full sm:w-auto justify-center sm:justify-start">
            <Sparkles className="w-4 h-4" /> Go Live
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 aspect-video bg-secondary rounded-3xl flex items-center justify-center relative overflow-hidden">
                <div className={`absolute inset-0 ${activeStream.image} opacity-30`} />
                <div className="text-center relative z-10 p-6">
                    <h2 className="text-3xl font-black">{activeStream.title}</h2>
                    <p className="text-white/80 font-semibold mt-2">{activeStream.creator} is broadcasting</p>
                    <button className="mt-6 px-8 py-3 bg-white text-black font-black text-sm rounded-xl hover:bg-white/90 transition-all flex items-center gap-2 mx-auto">
                        <Play className="w-4 h-4 fill-black" /> Watch Stream
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="font-black text-sm">Recommended</h3>
                {LIVE_STREAMS.map(stream => (
                    <button 
                        key={stream.id} 
                        onClick={() => setActiveStream(stream)}
                        className={`w-full p-4 rounded-2xl border flex items-center gap-4 transition-all ${activeStream.id === stream.id ? 'bg-secondary border-primary/50' : 'bg-card border-border hover:border-border/80'}`}
                    >
                        <div className={`w-14 h-14 rounded-xl ${stream.image} shrink-0`} />
                        <div className="text-left flex-1 min-w-0">
                            <h4 className="font-bold text-sm truncate">{stream.title}</h4>
                            <p className="text-[10px] font-semibold text-muted-foreground">{stream.creator}</p>
                        </div>
                        <div className="text-[10px] font-black flex items-center gap-1 text-rose-500 shrink-0">
                            <Eye className="w-3 h-3" /> {stream.viewers}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    </motion.div>
  );
}
