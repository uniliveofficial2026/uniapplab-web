import React from 'react';

/** True when gift icon is an uploaded/remote image rather than emoji text. */
export function isGiftIconMediaUrl(icon: string | null | undefined): boolean {
  const value = String(icon ?? '').trim();
  if (!value) return false;
  return (
    /^https?:\/\//i.test(value) ||
    value.startsWith('data:image/') ||
    value.startsWith('blob:') ||
    /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(value)
  );
}

type GiftIconProps = {
  icon: string | null | undefined;
  className?: string;
  /** Applied to <img> when icon is media. Defaults to matching emoji text size. */
  imgClassName?: string;
  alt?: string;
};

/** Renders gift icon as emoji text or media thumbnail. */
export function GiftIcon({
  icon,
  className = '',
  imgClassName = 'inline-block h-[1.15em] w-[1.15em] object-contain align-middle',
  alt = '',
}: GiftIconProps) {
  const value = String(icon ?? '').trim() || '🎁';
  if (isGiftIconMediaUrl(value)) {
    return <img src={value} alt={alt} className={imgClassName} draggable={false} />;
  }
  return <span className={className}>{value}</span>;
}
