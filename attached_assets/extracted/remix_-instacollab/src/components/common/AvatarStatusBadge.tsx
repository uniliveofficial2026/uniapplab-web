import React from 'react';

export type AvatarStatusBadgeVariant =
  | 'live'
  | 'story'
  | 'story-viewed'
  | 'story-multi'
  | 'you';
export type AvatarStatusBadgeSize = 'xs' | 'sm' | 'md';

const VARIANT_CLASS: Record<AvatarStatusBadgeVariant, string> = {
  live: 'avatar-status-badge--live',
  story: 'avatar-status-badge--story',
  'story-viewed': 'avatar-status-badge--story-viewed',
  'story-multi': 'avatar-status-badge--story-multi',
  you: 'avatar-status-badge--you',
};

const LABEL: Record<AvatarStatusBadgeVariant, string> = {
  live: 'LIVE',
  story: 'STORY',
  'story-viewed': 'STORY',
  'story-multi': 'STORIES',
  you: 'YOU',
};

interface AvatarStatusBadgeProps {
  variant: AvatarStatusBadgeVariant;
  size?: AvatarStatusBadgeSize;
  className?: string;
}

export function AvatarStatusBadge({
  variant,
  size = 'xs',
  className = '',
}: AvatarStatusBadgeProps) {
  const label = LABEL[variant];

  return (
    <span
      className={`avatar-status-badge avatar-status-badge--${size} ${VARIANT_CLASS[variant]} ${className}`.trim()}
    >
      {label}
    </span>
  );
}

/** Map Avatar `className` / `size` to the smallest readable badge tier. */
export function getAvatarStatusBadgeSize(
  className: string,
  size: 'sm' | 'md' | 'lg'
): AvatarStatusBadgeSize {
  if (/\bw-full\b/.test(className)) return 'md';
  if (/\bw-20\b/.test(className) || /\bh-20\b/.test(className)) return 'sm';
  if (/\bw-12\b/.test(className) || /\bh-12\b/.test(className)) return 'xs';
  if (/\bw-10\b/.test(className) || /\bh-10\b/.test(className)) return 'xs';
  if (size === 'lg') return 'sm';
  return 'xs';
}

/** Sit on the bottom ring — mostly inside, only slightly outside. */
export function getAvatarStatusBadgeOutsidePosition(
  _badgeSize: AvatarStatusBadgeSize = 'xs'
): string {
  return 'avatar-status-badge-anchor';
}
