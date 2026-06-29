import React, { useRef } from 'react';
import { motion } from 'motion/react';

export function Waveform({
  isPlaying = false,
  color = 'bg-primary',
  inactiveColor = 'bg-black/35 dark:bg-zinc-500/45',
  progress = 0,
  onSeek,
}: {
  isPlaying?: boolean;
  color?: string;
  inactiveColor?: string;
  progress?: number;
  onSeek?: (nextProgress: number) => void;
}) {
  // 15 bars for the waveform
  const bars = [...Array(15)];
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, ratio));
    onSeek(clamped);
  };
  
  return (
    <div
      ref={containerRef}
      className={`flex w-full min-w-0 gap-0.75 items-center h-8 overflow-hidden relative ${onSeek ? 'cursor-pointer' : ''}`}
      onClick={handleSeek}
    >
      {bars.map((_, i) => {
        const barProgress = (i + 1) / bars.length;
        const isActive = progress > 0 ? barProgress <= progress : true;
        
        return (
          <motion.div
            key={i}
            className={`w-1 rounded-full transition-all duration-300 ${isActive ? `${color} opacity-100 scale-y-110` : `${inactiveColor} opacity-95 scale-y-90`}`}
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
