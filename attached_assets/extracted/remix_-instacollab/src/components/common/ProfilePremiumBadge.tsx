import React from 'react';
import { Crown } from 'lucide-react';
import type { User } from '../../types';
import {
  formatPremiumExpiryDate,
  getProfilePremiumAccessStatus,
  type PremiumSubscriptionStatus,
} from '../../lib/premium';

type BadgeSize = 'sm' | 'md';

const sizeClasses: Record<BadgeSize, { wrap: string; icon: string }> = {
  sm: { wrap: 'text-[10px] px-1.5 py-0.5 gap-0.5', icon: 'w-3 h-3' },
  md: { wrap: 'text-xs px-2 py-0.5 gap-1', icon: 'w-3.5 h-3.5' },
};

function premiumBadgeTitle(status: PremiumSubscriptionStatus | null | undefined): string {
  if (!status?.active || status.expiresAt == null) {
    return 'Profile Premium';
  }
  const plan = status.periodLabel ? ` · ${status.periodLabel}` : '';
  return `Profile Premium${plan} — ${status.timeRemainingLabel} · until ${formatPremiumExpiryDate(status.expiresAt)}`;
}

export function ProfilePremiumBadge({
  size = 'sm',
  className = '',
  status,
}: {
  size?: BadgeSize;
  className?: string;
  status?: PremiumSubscriptionStatus | null;
}) {
  const s = sizeClasses[size];

  return (
    <span
      className={`inline-flex items-center shrink-0 font-black uppercase tracking-wide rounded-md border border-amber-500/45 bg-gradient-to-r from-amber-500/25 via-amber-400/15 to-amber-600/10 text-amber-800 dark:text-amber-200 shadow-sm ${s.wrap} ${className}`.trim()}
      title={premiumBadgeTitle(status)}
    >
      <Crown className={`${s.icon} fill-amber-500 text-amber-600 dark:fill-amber-400 dark:text-amber-300`} />
      Premium
    </span>
  );
}

export function ProfilePremiumBadgeForUser({
  user,
  size = 'sm',
  className = '',
}: {
  user: User;
  size?: BadgeSize;
  className?: string;
}) {
  const status = getProfilePremiumAccessStatus(user);
  if (!status.active) return null;
  return (
    <ProfilePremiumBadge size={size} className={className} status={status} />
  );
}
