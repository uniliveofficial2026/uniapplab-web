import React from 'react';
import { useReducedMotion } from 'motion/react';
import { motion } from 'motion/react';
import { UniLivesWordmark } from '../../brand/UniLivesWordmark';

type Props = {
  title?: string;
  message?: string;
  visible?: boolean;
};

/**
 * One-time completion visual. Not a new route — optional overlay/message only.
 * Parent owns completion persistence and navigation.
 */
export function UniLivesProfileSetupCompletion({
  title = 'Profile ready',
  message,
  visible = true,
}: Props) {
  const reduceMotion = useReducedMotion();
  if (!visible) return null;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.25 }}
      className="flex flex-col items-center gap-2 text-center pointer-events-none"
      data-unilives-profile-setup-completion=""
      aria-live="polite"
    >
      <UniLivesWordmark className="text-sm font-black text-[color:var(--color-unilives-profile-setup-success)]" />
      <p className="text-base font-black text-[color:var(--color-unilives-profile-setup-text)]">{title}</p>
      {message ? (
        <p className="text-sm text-[color:var(--color-unilives-profile-setup-muted)]">{message}</p>
      ) : null}
    </motion.div>
  );
}
