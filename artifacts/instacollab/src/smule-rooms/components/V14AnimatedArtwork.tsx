import type { CSSProperties } from 'react';
import { findV14GiftSpec, findV14StickerSpec } from './liveToolsV14Artwork';
import './live-artwork-motion.css';

type MotionStyle = CSSProperties & { '--v14-motion-duration'?: string };

type AnimatedArtworkProps = {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  animate?: boolean;
  playKey?: string | number;
};

export function V14AnimatedStickerArtwork({
  stickerId,
  src,
  alt = 'Sticker',
  className = '',
  imgClassName = '',
  animate = true,
  playKey,
}: AnimatedArtworkProps & { stickerId?: string | null }) {
  const spec = findV14StickerSpec(stickerId);
  const style: MotionStyle = { '--v14-motion-duration': `${spec?.motionDurationMs ?? 1600}ms` };
  return (
    <span
      key={playKey}
      className={`v14-animated-artwork v14-animated-artwork--sticker ${className}`}
      data-v14-motion={spec?.motion ?? 'hey-pop'}
      data-v14-animate={animate ? 'true' : 'false'}
      style={style}
    >
      <img className={`v14-animated-artwork__image ${imgClassName}`} src={src} alt={alt} draggable={false} decoding="async" />
    </span>
  );
}

export function V14AnimatedGiftArtwork({
  giftId,
  giftName,
  src,
  alt = '',
  className = '',
  imgClassName = '',
  animate = true,
  playKey,
}: AnimatedArtworkProps & { giftId?: string | null; giftName?: string | null }) {
  const spec = findV14GiftSpec(giftId, giftName);
  const style: MotionStyle = { '--v14-motion-duration': `${spec?.motionDurationMs ?? 1900}ms` };
  return (
    <span
      key={playKey}
      className={`v14-animated-artwork v14-animated-artwork--gift ${className}`}
      data-v14-motion={spec?.motion ?? 'lucky-pop'}
      data-v14-animate={animate ? 'true' : 'false'}
      style={style}
    >
      <img className={`v14-animated-artwork__image ${imgClassName}`} src={src} alt={alt} draggable={false} decoding="async" />
    </span>
  );
}
