import React from 'react';
import { motion } from 'motion/react';

export function AppleAuthButton({
  onClick,
  disabled,
  label = 'Continue with Apple',
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      className="w-full py-3.5 rounded-2xl font-semibold bg-foreground text-background shadow-sm flex items-center justify-center gap-3 disabled:opacity-50"
    >
      <AppleMark />
      <span>{label}</span>
    </motion.button>
  );
}

function AppleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05 1.88-3.51 1.9-1.46.02-1.93-.86-3.6-.86-1.66 0-2.18.84-3.56.89-1.44.05-2.53-1.47-3.51-2.42C2.44 16.04 1.04 12.3 2.66 8.64c1.14-2.48 3.22-4.04 5.56-4.08 1.44-.03 2.81.97 3.69.97.88 0 2.52-1.2 4.25-1.02.72.03 2.75.29 4.05 2.17-3.45 2.07-2.9 6.25.73 7.66-.61 1.58-1.31 3.14-2.24 4.94zM12.03 8.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}
