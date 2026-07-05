import React from 'react';

type CoinIconProps = {
  className?: string;
};

/** Shared gold coin glyph for balances, gifts, and seat totals. */
export function CoinIcon({ className }: CoinIconProps) {
  const gradientId = React.useId();

  return (
    <svg
      className={className}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="6" cy="6" r="5.1" fill={`url(#${gradientId})`} stroke="#b45309" strokeWidth="0.65" />
      <ellipse cx="6" cy="4.7" rx="2.8" ry="1.05" fill="#fff" fillOpacity="0.38" />
      <circle cx="6" cy="6" r="2.35" stroke="#d97706" strokeWidth="0.45" fill="none" opacity="0.85" />
      <defs>
        <linearGradient id={gradientId} x1="6" y1="0.9" x2="6" y2="11.1" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde68a" />
          <stop offset="0.55" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
    </svg>
  );
}
