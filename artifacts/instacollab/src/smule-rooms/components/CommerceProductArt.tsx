import { type ReactNode } from 'react';
import type { CommerceProduct } from '../utils/liveRoomTypes';

type CommerceProductArtProps = {
  product: Pick<CommerceProduct, 'imageUrl' | 'videoUrl'>;
  fallback?: ReactNode;
  className?: string;
};

export function CommerceProductArt({ product, fallback = null, className }: CommerceProductArtProps) {
  if (product.videoUrl) {
    return (
      <video
        className={className}
        src={product.videoUrl}
        muted
        playsInline
        loop
        autoPlay
        preload="metadata"
        aria-hidden="true"
      />
    );
  }
  if (product.imageUrl) {
    return <img className={className} src={product.imageUrl} alt="" />;
  }
  return <>{fallback}</>;
}
