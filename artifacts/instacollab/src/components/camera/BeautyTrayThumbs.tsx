import React from 'react';

type ThumbProps = {
  swatch: string;
  className?: string;
};

function ThumbShell({ swatch, className = '', children }: ThumbProps & { children: React.ReactNode }) {
  return (
    <span
      className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{
        background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35), transparent 55%), ${swatch}`,
      }}
    >
      {children}
    </span>
  );
}

const ICON_CLASS = 'h-5 w-5 text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]';

export function BeautyPresetThumb({ presetId, swatch, label }: { presetId: string; swatch: string; label: string }) {
  if (presetId === 'none') {
    return (
      <span className="flex h-full w-full items-center justify-center rounded-full bg-zinc-700 text-[10px] font-black text-white/90">
        Off
      </span>
    );
  }

  const icons: Record<string, React.ReactNode> = {
    'beauty-smooth': (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden>
        <path fill="currentColor" d="M12 3c3.5 0 6.5 2.8 6.5 6.2 0 2.4-1.2 4.5-3 5.8V19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-4c-1.8-1.3-3-3.4-3-5.8C7.5 5.8 10.5 3 12 3Z" opacity="0.9" />
        <path fill="currentColor" d="M9 8.5h6v1.2a3 3 0 0 1-6 0V8.5Z" />
      </svg>
    ),
    'beauty-soft': (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden>
        <circle cx="12" cy="10" r="5.5" fill="currentColor" opacity="0.85" />
        <ellipse cx="12" cy="19" rx="6.5" ry="2.2" fill="currentColor" opacity="0.55" />
      </svg>
    ),
    'beauty-glow': (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden>
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <path stroke="currentColor" strokeWidth="1.6" fill="none" d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1l2.1-2.1M17 7l2.1-2.1" />
      </svg>
    ),
    'beauty-natural': (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden>
        <path fill="currentColor" d="M12 4c2.8 0 5 2.4 5 5.3 0 1.8-.9 3.4-2.2 4.4-.6.5-1 1.1-1.2 1.8l-.3 1.2a1.5 1.5 0 0 1-1.5 1.2h-.6a1.5 1.5 0 0 1-1.5-1.2l-.3-1.2c-.2-.7-.6-1.3-1.2-1.8C6.9 12.7 6 11.1 6 9.3 6 6.4 8.2 4 12 4Z" />
        <path fill="currentColor" d="M8.5 10.2c.8.6 1.8 1 2.9 1s2.1-.4 2.9-1" opacity="0.7" />
      </svg>
    ),
    'beauty-clear': (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden>
        <path fill="currentColor" d="M12 3.5 14.8 9l6.2.9-4.5 4.4 1.1 6.2L12 17.8 6.4 20.5l1.1-6.2L3 9.9 9.2 9 12 3.5Z" />
      </svg>
    ),
  };

  return (
    <ThumbShell swatch={swatch}>
      {icons[presetId] ?? (
        <span className="text-[10px] font-black uppercase text-white/95">{label.slice(0, 2)}</span>
      )}
    </ThumbShell>
  );
}

export function ShapePresetThumb({ presetId, swatch, label }: { presetId: string; swatch: string; label: string }) {
  const icons: Record<string, React.ReactNode> = {
    'shape-natural': (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden>
        <ellipse cx="12" cy="10.5" rx="5.2" ry="6.2" fill="currentColor" />
      </svg>
    ),
    'shape-slim-face': (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden>
        <ellipse cx="12" cy="10.5" rx="3.8" ry="6.4" fill="currentColor" />
      </svg>
    ),
    'shape-full-face': (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden>
        <ellipse cx="12" cy="10.5" rx="6.2" ry="6" fill="currentColor" />
      </svg>
    ),
    'shape-vline': (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden>
        <path fill="currentColor" d="M12 4.5c2.2 0 4 1.8 4 4v2.2c0 1.6-.8 3-2 3.8V18a1.2 1.2 0 0 1-1.2 1.2h-1.6A1.2 1.2 0 0 1 10 18v-3.5c-1.2-.8-2-2.2-2-3.8V8.5c0-2.2 1.8-4 4-4Z" />
      </svg>
    ),
    'shape-big-eyes': (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden>
        <ellipse cx="8.8" cy="10.5" rx="2.4" ry="2.8" fill="currentColor" />
        <ellipse cx="15.2" cy="10.5" rx="2.4" ry="2.8" fill="currentColor" />
        <ellipse cx="12" cy="17.5" rx="4.8" ry="2" fill="currentColor" opacity="0.55" />
      </svg>
    ),
    'shape-model-waist': (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden>
        <path fill="currentColor" d="M9 5.5h6l1 4.5-2 1.5 2 1.5-1 4.5H9l-1-4.5 2-1.5-2-1.5 1-4.5Z" />
      </svg>
    ),
    'shape-curvy': (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden>
        <path fill="currentColor" d="M8.5 6.5h7c1.2 3.2.8 6.8-1 9.5l1.5 3H7.5l1.5-3c-1.8-2.7-2.2-6.3-1-9.5Z" />
      </svg>
    ),
    'shape-long-legs': (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden>
        <circle cx="12" cy="6.5" r="2.6" fill="currentColor" />
        <rect x="10.2" y="9" width="3.6" height="5.5" rx="1.2" fill="currentColor" />
        <rect x="8.8" y="14.8" width="2.4" height="5.8" rx="1" fill="currentColor" />
        <rect x="12.8" y="14.8" width="2.4" height="5.8" rx="1" fill="currentColor" />
      </svg>
    ),
    'shape-athletic': (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden>
        <path fill="currentColor" d="M6.5 8.5 9 6h6l2.5 2.5-2 2H8.5l-2-2Zm1 4h9l1.5 6H7l1.5-6Z" />
      </svg>
    ),
    'shape-glam': (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden>
        <path fill="currentColor" d="M12 3.8 13.6 8h4.6l-3.7 2.7 1.4 4.5L12 13.8 8.1 15.2l1.4-4.5L5.8 8h4.6L12 3.8Z" />
        <ellipse cx="12" cy="18.2" rx="4.5" ry="1.6" fill="currentColor" opacity="0.55" />
      </svg>
    ),
  };

  return (
    <ThumbShell swatch={swatch}>
      {icons[presetId] ?? (
        <span className="text-[10px] font-black uppercase text-white/95">{label.slice(0, 2)}</span>
      )}
    </ThumbShell>
  );
}
