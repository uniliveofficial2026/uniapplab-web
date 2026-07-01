import type { RoomBackgroundMode } from '../utils/roomBackground';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';

type RoomBackgroundLayerProps = {
  mode: RoomBackgroundMode;
  className?: string;
};

export function RoomBackgroundLayer({ mode, className = '' }: RoomBackgroundLayerProps) {
  return (
    <div
      className={`absolute inset-0 z-0 pointer-events-none overflow-hidden ${mode.type === 'css' ? mode.value : ''} ${className}`}
      aria-hidden="true"
    >
      {mode.type === 'video' && (
        <video
          src={mode.value}
          autoPlay
          loop
          muted
          playsInline
          controls
          className="absolute inset-0 h-full w-full object-cover pointer-events-auto"
          {...nativeVideoControlGuardProps()}
        />
      )}
      {mode.type === 'image' && (
        <div
          className="absolute inset-0 h-full w-full"
          style={{
            backgroundImage: `url(${mode.value})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      <div className="absolute top-[8%] left-[50%] h-[260px] w-[260px] -translate-x-[50%] rounded-full bg-yellow-500/15 blur-[85px] animate-pulse duration-1000" />
      <div className="absolute top-[25%] left-[10%] h-[200px] w-[200px] rounded-full bg-pink-700/15 blur-[75px]" />
      <div className="absolute top-[40%] right-[5%] h-[230px] w-[230px] rounded-full bg-purple-900/20 blur-[90px]" />
      <div className="absolute bottom-[10%] left-[20%] h-[320px] w-[320px] rounded-full bg-[#1b082d] blur-[110px]" />
    </div>
  );
}
