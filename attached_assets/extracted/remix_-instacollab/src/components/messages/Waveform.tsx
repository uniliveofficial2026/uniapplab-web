import React from 'react';
import { motion } from 'motion/react';

export function Waveform({ isPlaying = false, color = 'bg-primary', progress = 0 }: { isPlaying?: boolean, color?: string, progress?: number }) {
  // 15 bars for the waveform
  const bars = [...Array(15)];
  
  return (
    <div className="flex gap-0.75 items-center h-8 overflow-hidden min-w-[100px] relative">
      {bars.map((_, i) => {
        const barProgress = (i + 1) / bars.length;
        const isActive = progress > 0 ? barProgress <= progress : true;
        
        return (
          <motion.div
            key={i}
            className={`w-1 rounded-full ${color} transition-all duration-300 ${isActive ? 'opacity-100 scale-y-110' : 'opacity-30 scale-y-90'}`}
            initial={{ height: '20%' }}
            animate={isPlaying ? {
              height: [
                '25%',
                `${45 + (i % 7) * 8}%`,
                `${30 + (i % 4) * 12}%`,
                `${55 + (i % 6) * 7}%`,
                '25%'
              ],
              transition: {
                duration: 0.8 + (i % 5) * 0.15,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.05
              }
            } : {
              height: `${25 + (i % 4) * 10}%`,
              transition: { duration: 0.3 }
            }}
          />
        );
      })}
    </div>
  );
}
