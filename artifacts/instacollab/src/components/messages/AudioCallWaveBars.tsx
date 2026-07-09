type AudioCallWaveBarsProps = {
  active?: boolean;
  bars?: number;
  className?: string;
};

export function AudioCallWaveBars({
  active = true,
  bars = 5,
  className = '',
}: AudioCallWaveBarsProps) {
  return (
    <div
      className={`flex items-end justify-center gap-1 ${className}`}
      aria-hidden={!active}
    >
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className={`w-1 rounded-full bg-emerald-400/90 ${active ? 'animate-pulse' : 'h-1 opacity-40'}`}
          style={
            active
              ? {
                  height: `${10 + (i % 3) * 6}px`,
                  animationDelay: `${i * 0.12}s`,
                  animationDuration: `${0.55 + (i % 3) * 0.15}s`,
                }
              : { height: '4px' }
          }
        />
      ))}
    </div>
  );
}
