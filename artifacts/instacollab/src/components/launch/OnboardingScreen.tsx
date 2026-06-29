import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, MessageCircle, Sparkles, Users } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { OnboardingBackgroundUpload } from './OnboardingBackgroundUpload';
import { LaunchPrimaryButton, LaunchShell, LaunchTextButton } from './launchUi';

const SLIDES = [
  {
    icon: Sparkles,
    title: 'Share your world',
    body: 'Post photos, reels, and stories with filters and music your audience will love.',
  },
  {
    icon: Users,
    title: 'Grow your circle',
    body: 'Follow creators, get discovered on trending, and build your community.',
  },
  {
    icon: MessageCircle,
    title: 'Chat in real time',
    body: 'DMs with typing indicators, read receipts, and rich media sharing.',
  },
  {
    icon: Camera,
    title: 'Go live & create',
    body: 'Stream, collaborate on workspace tasks, and manage your profile in one place.',
  },
] as const;

export function OnboardingScreen() {
  const db = useDB();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index >= SLIDES.length - 1;

  const backgroundUrl = (db.settings.onboardingBackgroundUrl as string | undefined) ?? null;
  const backgroundMediaType =
    (db.settings.onboardingBackgroundMediaType as 'image' | 'video' | undefined) ?? 'image';

  const finish = () => db.completeOnboarding();

  return (
    <LaunchShell
      className="p-6 pb-10 overflow-y-auto"
      backgroundUrl={backgroundUrl}
      backgroundMediaType={backgroundMediaType}
    >
      <div className="flex justify-end">
        <LaunchTextButton onClick={finish}>Skip</LaunchTextButton>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center px-2 min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.title}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            className="flex flex-col items-center gap-6 max-w-sm"
          >
            <OnboardingBackgroundUpload slideIcon={slide.icon} />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {backgroundUrl ? 'Tap to change background' : 'Tap to set full-screen background'}
            </p>
            <h2 className="text-2xl font-black">{slide.title}</h2>
            <p className="text-muted-foreground text-[15px] leading-relaxed">{slide.body}</p>
          </motion.div>
        </AnimatePresence>
        <div className="flex gap-2 mt-10">
          {SLIDES.map((_, i) => (
            <div
              key={SLIDES[i].title}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-8 bg-primary' : 'w-2 bg-border'
              }`}
            />
          ))}
        </div>
      </div>
      <LaunchPrimaryButton
        onClick={() => {
          if (isLast) finish();
          else setIndex((i) => i + 1);
        }}
      >
        {isLast ? 'Get started' : 'Next'}
      </LaunchPrimaryButton>
    </LaunchShell>
  );
}
