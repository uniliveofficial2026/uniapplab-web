import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLogo } from '../common/AppLogo';
import { AppNativeVideo } from '../common/AppNativeVideo';
import { useDB } from '../../lib/useDB';
import { UniLivesPrincessLoadingRefreshLayout } from '../brand/UniLivesPrincessLoadingRefreshLayout';
import { detectPrefersReducedMotion } from '../../lib/unilives-assets';

export function SplashScreen({
  onComplete,
  isLoading = false,
}: {
  onComplete?: () => void;
  isLoading?: boolean;
}) {
  const db = useDB();
  const settings = db.settings;
  const isAdEnabled = settings.splashAdEnabled;
  const adUrl = settings.splashAdUrl as string | undefined;

  const rawDuration = Number(settings.splashAdDuration);
  const safeDuration = isNaN(rawDuration) || rawDuration < 0 ? 2 : Math.min(rawDuration, 30);
  const displayDuration = isAdEnabled && adUrl ? safeDuration : 0;

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [fadeAdOut, setFadeAdOut] = useState(false);
  const [timeLeft, setTimeLeft] = useState(displayDuration);
  const reduced = detectPrefersReducedMotion();

  useEffect(() => {
    setTimeLeft(displayDuration);
    if (displayDuration <= 0) {
      setMinTimeElapsed(true);
      return;
    }

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

  useEffect(() => {
    if (minTimeElapsed && !isLoading && !fadeAdOut) {
      setFadeAdOut(true);
      if (onComplete) {
        setTimeout(onComplete, 200);
      }
    }
  }, [minTimeElapsed, isLoading, fadeAdOut, onComplete]);

  const isVideo =
    adUrl &&
    (adUrl.includes('video') ||
      adUrl.endsWith('.mp4') ||
      adUrl.endsWith('.webm') ||
      adUrl.endsWith('.mov') ||
      adUrl.startsWith('data:video/'));

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
                <AppNativeVideo
                  src={adUrl}
                  className="w-full h-full object-contain"
                  autoPlay
                  muted
                  loop
                  controls={false}
                />
              ) : (
                <img src={adUrl} className="w-full h-full object-contain" alt="Splash Ad" />
              )}
              <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-2 z-10 bg-black/40 backdrop-blur-md py-4">
                <AppLogo
                  showText={true}
                  iconClassName="w-8 h-8 text-white"
                  textClassName="text-xl font-black tracking-tighter text-white"
                />
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
            <UniLivesPrincessLoadingRefreshLayout
              overlay
              loop={isLoading && !reduced}
              staticPoster={reduced}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
