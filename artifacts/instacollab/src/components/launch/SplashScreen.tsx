import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { useDB } from '../../lib/useDB';
import { LaunchBrandMark, LaunchShell } from './launchUi';

export function SplashScreen() {
  const db = useDB();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      db.markSplashSeen();
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [db]);

  return (
    <LaunchShell className="items-center justify-center p-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center gap-6 text-center"
      >
        <LaunchBrandMark size="hero" allowUpload />
        <div>
          <h1 className="text-3xl font-black tracking-tight">InstaCollab</h1>
          <p className="text-muted-foreground mt-2 text-sm font-medium">
            Create, connect, and collaborate in real time.
          </p>
        </div>
        <motion.div
          className="h-1 w-24 rounded-full bg-gradient-to-r from-[#fd5949] to-[#d6249f]"
          initial={{ width: 0 }}
          animate={{ width: 96 }}
          transition={{ duration: 2, ease: 'easeInOut' }}
        />
      </motion.div>
      <button
        type="button"
        onClick={() => db.markSplashSeen()}
        className="mt-12 text-xs font-bold text-muted-foreground uppercase tracking-widest"
      >
        Tap to continue
      </button>
    </LaunchShell>
  );
}
