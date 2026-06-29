import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { ChevronDown, Heart, MessageCircle, Gift, Mic, Globe, UserPlus, MoreHorizontal, Play, Pause } from 'lucide-react';
import { ShareIcon } from '../common/ShareIcon';
import { useDB } from '../../lib/useDB';

export function SingingPlayerModal({ post, mode, onClose }: { post: any, mode: 'sing' | 'join' | 'listen', onClose: () => void }) {
  const db = useDB();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        setProgress(p => {
          if (p >= 100) return 0;
          return p + 0.1;
        });
      }, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying]);

  if (!post) return null;

  const currentSeconds = Math.floor((progress / 100) * 279); // max 4:39 = 279s
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return createPortal(
    <div className="fixed inset-0 z-[3000] bg-white text-black flex flex-col overflow-hidden animate-in slide-in-from-bottom-full duration-300">
      
      {/* Top Header */}
      <div className="flex flex-shrink-0 items-center justify-between p-4 pt-safe bg-white border-b border-gray-100">
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95">
          <ChevronDown className="w-7 h-7 text-black" strokeWidth={2} />
        </button>
        <span className="font-bold text-[17px] tracking-wide">Now Playing</span>
        <div className="w-11"></div> {/* Spacer for balance */}
      </div>

      <div className="flex-1 overflow-y-auto bg-white flex flex-col">
        {/* Profiles Info Top Left */}
        <div className="px-4 py-3 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full border border-gray-200 relative z-10 bg-white p-0.5">
                <img src={post.user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user?.id || '2'}`} className="w-full h-full rounded-full object-cover" alt="avatar" />
                <div className="absolute -bottom-1 -right-1 bg-pink-500 text-[8px] font-bold text-white px-1 py-0.5 rounded-full border border-white">
                  VIP
                </div>
              </div>
              <span className="text-gray-400 font-bold mx-1 text-sm">+</span>
              <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white text-[8px] font-bold relative -ml-1 border border-white overflow-hidden">
                <img src="https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=100&q=80" className="w-full h-full object-cover opacity-80 mix-blend-screen" />
                <span className="absolute z-10 text-center leading-tight shadow-black drop-shadow-md">Music<br/>Club</span>
              </div>
            </div>
            
            <div className="flex flex-col">
              <span className="font-bold text-[15px] leading-tight">{post.user?.username || 'Cherry___Moe'}</span>
              <span className="text-[13px] text-gray-500 leading-tight">+ samsam5000</span>
            </div>
          </div>
          
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <MoreHorizontal className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Visualizer / Video Area - Taking ~55% of the screen */}
        <div 
          className="relative w-full aspect-[4/5] bg-gray-900 overflow-hidden shrink-0 cursor-pointer"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {/* Background */}
          {post.imageUrl ? (
            <img src={post.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-tr from-[#110033] via-[#4a00e0] to-[#8e2de2] opacity-80" />
          )}

          {/* Globe Animation */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div 
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
              className="w-64 h-64 md:w-80 md:h-80 rounded-full flex items-center justify-center relative bg-[#2a8dd4]/30 backdrop-blur-sm"
              style={{
                boxShadow: 'inset 0 0 50px rgba(42,141,212,0.5), 0 0 30px rgba(42,141,212,0.2)'
              }}
            >
              <Globe className="w-[110%] h-[110%] text-[#89c5f0] opacity-40 absolute mix-blend-screen" strokeWidth={1} />
              
              {/* Dotted Connection line */}
              <div className="absolute w-[2px] h-full flex flex-col justify-between items-center py-4">
                 <div className="w-[4px] h-[4px] bg-white rounded-full"></div>
                 <div className="w-[2px] h-full border-l-2 border-dotted border-white/40"></div>
                 <div className="w-[4px] h-[4px] bg-white rounded-full"></div>
              </div>

              {/* Floating Profile */}
              <div className="absolute shadow-[0_0_20px_rgba(0,0,0,0.5)] rounded-full p-1 bg-white/20 backdrop-blur-md">
                 <img src={post.user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user?.id || '2'}`} className="w-16 h-16 rounded-full object-cover" />
              </div>

            </motion.div>
          </div>

          {/* Top Right Box */}
          <div className="absolute top-4 right-4 w-16 h-20 border-2 border-transparent hover:border-white/50 transition-colors rounded-sm overflow-hidden bg-black object-cover z-20">
             <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&q=80" className="w-full h-full object-cover opacity-90" />
          </div>

          {/* Play/Pause Indicator Centered */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
               <Pause className="w-16 h-16 text-white drop-shadow-lg fill-white" />
            </div>
          )}

          {/* Info Overlay Bottom Layer */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12 pb-6 z-10 flex text-white pointer-events-none items-end justify-between">
             <div className="flex flex-col gap-2 flex-1">
                <div className="self-start px-2 py-1 rounded bg-black/40 backdrop-blur-sm flex items-center gap-2 border border-white/10 shrink-0 max-w-full">
                   <div className="w-4 h-4 rounded-sm bg-gradient-to-tr from-pink-500 to-orange-400 flex items-center justify-center shrink-0">
                      <span className="text-[10px]">🌹</span>
                   </div>
                   <span className="text-[12px] font-medium tracking-wide truncate">Style · Eccentric_sabu</span>
                </div>
                
                <h2 className="text-[16px] font-bold leading-snug drop-shadow-md">
                   🌹 {post.caption || 'ချစ်ခြင်းမေတ္တာ၏အရိပ် _Duet (Unicode)'}
                </h2>
                
                <div className="flex items-center gap-2 text-sm text-white/90 font-medium">
                  <Mic className="w-4 h-4" /> 
                  <span className="drop-shadow-md">{post.user?.username || 'ထူးအိမ်သင်'}</span> 
                  <span className="text-pink-500 drop-shadow-md">💗</span> 
                  <span className="drop-shadow-md">ချောစုခင်</span>
                </div>
             </div>
             
             <div className="text-[12px] font-mono tracking-wider drop-shadow-md opacity-90 mb-1 ml-2">
                {formatTime(currentSeconds)} / 4:39
             </div>
          </div>

          {/* Progress Bar (Attached to bottom of video section) */}
          <div 
            className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 cursor-pointer pointer-events-auto"
            onClick={(e) => {
               e.stopPropagation();
               const rect = e.currentTarget.getBoundingClientRect();
               const pos = (e.clientX - rect.left) / rect.width;
               setProgress(pos * 100);
            }}
          >
             <div className="absolute top-0 left-0 h-full bg-[#8224e3] rounded-r-full" style={{ width: `${progress}%` }} />
             <div 
               className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-[#8224e3] rounded-full shadow-[0_0_10px_#8224e3] transition-all" 
               style={{ left: `calc(${progress}% - 6px)` }} 
             />
          </div>
        </div>

        {/* Action Bar (White section) */}
        <div className="p-4 flex flex-col gap-3 shrink-0">
           {/* Buttons Row */}
           <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-5 sm:gap-6">
                 <button 
                   onClick={() => setIsLiked(!isLiked)} 
                   className="hover:scale-110 transition-transform active:scale-95"
                 >
                    <Heart className={`w-7 h-7 sm:w-8 sm:h-8 ${isLiked ? 'fill-red-500 text-red-500' : 'text-black'}`} strokeWidth={1.5} />
                 </button>
                 <button className="hover:scale-110 transition-transform active:scale-95 text-black">
                    <Gift className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={1.5} />
                 </button>
                 <button className="hover:scale-110 transition-transform active:scale-95 text-black">
                    <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={1.5} />
                 </button>
                 <button className="hover:scale-110 transition-transform active:scale-95 text-black">
                    <ShareIcon size="xl" tone="inherit" className="text-black" strokeWidth={1.5} />
                 </button>
              </div>

              <button className={`bg-[#8224e3] hover:bg-[#6c1cb0] active:scale-95 text-white font-bold text-[15px] px-8 py-2.5 rounded-full shadow-md transition-all ${mode === 'sing' ? 'bg-[#ff0055]' : ''}`}>
                 {mode === 'sing' ? 'Sing' : mode === 'join' ? 'Join' : 'Vote'}
              </button>
           </div>

           {/* Metrics */}
           <div className="flex items-center gap-2 text-[14px] mt-1">
              <span className="text-[#8224e3] font-bold cursor-pointer hover:underline">{isLiked ? (post.likes || 14) + 1 : (post.likes || 14)} likes</span>
              <span className="text-gray-400">•</span>
              <span className="text-[#8224e3] font-bold cursor-pointer hover:underline">1 gift</span>
           </div>

           {/* Captions and Comments */}
           <div className="flex flex-col gap-1.5 text-[14px]">
              <div className="leading-snug">
                <span className="font-bold mr-2 text-black cursor-pointer hover:underline">{post.user?.username || 'cza_cho'}</span>
                <span className="text-black">သင့်ရဲ့အရိပ်၌ ငြိမ်းချမ်းခွင့်ပေးပါ 🎶🎶</span>
              </div>
              
              <button className="text-gray-500 font-medium self-start text-[14px] hover:text-black transition-colors mt-0.5">
                 Be the first to comment
              </button>
              
              <span className="text-gray-400 text-[12px] mt-0.5">3 days ago</span>
           </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
