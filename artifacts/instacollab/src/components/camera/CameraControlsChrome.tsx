import { motion } from 'motion/react';
import type { ReactNode } from 'react';

export type CameraControlsChromeProps = {
  visible: boolean;
  children: ReactNode;
  className?: string;
  edge?: 'top' | 'bottom' | 'none';
};

/** Fade/slide camera screen chrome — used on calls, live rooms, capture, karaoke. */
export function CameraControlsChrome({
  visible,
  children,
  className = '',
  edge = 'bottom',
}: CameraControlsChromeProps) {
  const y = edge === 'top' ? -10 : edge === 'bottom' ? 10 : 0;

  return (
    <motion.div
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : y }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`pointer-events-none ${className} ${visible ? '' : '!pointer-events-none'}`}
      aria-hidden={!visible}
    >
      {children}
    </motion.div>
  );
}
