import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLogo } from '../common/AppLogo';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';
import { useDB } from '../../lib/useDB';

export function SplashScreen({ onComplete, isLoading = false }: { onComplete?: () => void, isLoading?: boolean }) {
  const db = useDB();
  const settings = db.settings;
  const isAdEnabled = settings.splashAdEnabled;
  const adUrl = settings.splashAdUrl as string | undefined;
  
  // Use ad duration from settings if ad is enabled. Otherwise, no artificial delay.
  // Ensure duration is parsed strictly as a number, defaulting to 2, max 30s.
  const rawDuration = Number(settings.splashAdDuration);
  const safeDuration = isNaN(rawDuration) || rawDuration < 0 ? 2 : Math.min(rawDuration, 30);
  const displayDuration = isAdEnabled && adUrl ? safeDuration : 0;
  
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [fadeAdOut, setFadeAdOut] = useState(false);
  const [timeLeft, setTimeLeft] = useState(displayDuration);

  useEffect(() => {
    setTimeLeft(displayDuration);
    if (displayDuration <= 0) {
       setMinTimeElapsed(true);
       return;
    }
    
    // Also set a hard fallback timeout just in case the interval fails or auth loading hangs indefinitely
    const hardFallback = setTimeout(() => {
       setMinTimeElapsed(true);
    }, (displayDuration + 3) * 1000);
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const next = Number(prev) - 1;
        if (next <= 0) {
           clearInterval(timer);
           setMinTimeElapsed(true);
           return 0;
        }
        return next;
      });
    }, 1000);
    return () => {
      clearInterval(timer);
      clearTimeout(hardFallback);
    };
  }, [displayDuration]);

  // When both minimum time is elapsed AND loading is finished, start fade out
  useEffect(() => {
    // Only fade out when auth is fully loaded AND the ad duration has passed.
    if (minTimeElapsed && !isLoading && !fadeAdOut) {
      setFadeAdOut(true);
      if (onComplete) {
         setTimeout(onComplete, 200); // Wait for fade out animation
      }
    }
  }, [minTimeElapsed, isLoading, fadeAdOut, onComplete]);

  const isVideo = adUrl && (adUrl.includes('video') || adUrl.endsWith('.mp4') || adUrl.endsWith('.webm') || adUrl.endsWith('.mov') || adUrl.startsWith('data:video/'));

  return (
    <AnimatePresence>
      {!fadeAdOut && (
        <motion.div 
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-background z-[2000] flex items-center justify-center overflow-hidden"
        >
           {isAdEnabled && adUrl ? (
             <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-black">
                 {isVideo ? (
                    <video 
                      src={adUrl} 
                      className="w-full h-full object-contain" 
                      autoPlay 
                      muted 
                      loop 
                      playsInline
                      controls
                    {...nativeVideoControlGuardProps()}
                    />
                 ) : (
                    <img 
                      src={adUrl} 
                      className="w-full h-full object-contain" 
                      alt="Splash Ad" 
                    />
                 )}
                 {/* App Branding over Ad */}
                 <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-2 z-10 bg-black/40 backdrop-blur-md py-4">
                    <AppLogo showText={true} iconClassName="w-8 h-8 text-white" textClassName="text-xl font-black tracking-tighter text-white" />
                 </div>
                 <div className="absolute top-12 right-6 px-3 py-1 bg-black/50 text-white rounded-full text-xs font-bold z-10 backdrop-blur-md flex items-center gap-2">
                   <span>Advertisement</span>
                   {timeLeft > 0 ? (
                     <span className="w-5 text-center">{timeLeft}s</span>
                   ) : isLoading ? (
                     <span className="animate-pulse">Loading...</span>
                   ) : null}
                 </div>
             </div>
           ) : (
             <>
               <motion.div
                 animate={{ 
                   scale: [1, 1.1, 1],
                   rotate: [0, 5, -5, 0]
                 }}
                 transition={{ 
                   duration: 2,
                   repeat: Infinity,
                   ease: "easeInOut"
                 }}
                 className="w-24 h-24 bg-primary rounded-[32px] flex items-center justify-center shadow-2xl shadow-primary/40 relative z-10"
               >
                 <AppLogo showText={false} iconClassName="w-12 h-12 text-primary-foreground" />
               </motion.div>
               
               <div className="fixed bottom-12 left-0 right-0 flex flex-col items-center gap-2 z-10">
                 <AppLogo showText={true} iconClassName="hidden" textClassName="text-xl font-black tracking-tighter text-foreground not-italic vibe-gradient-text-none uppercase" />
                 <div className="h-1 w-32 bg-secondary rounded-full overflow-hidden">
                   <motion.div 
                     initial={{ x: -128 }}
                     animate={{ x: 128 }}
                     transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                     className="h-full w-1/2 bg-primary"
                   />
                 </div>
               </div>
             </>
           )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
