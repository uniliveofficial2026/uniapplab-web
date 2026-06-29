import React from 'react';
import type { User } from '../../types';
import {
  formatProfileHandle,
  getProfileDisplayName,
  shouldShowProfileHandle,
} from '../../lib/profileDisplay';

type ProfileNameLinesProps = {
  user: Partial<User> | null | undefined;
  primaryClassName?: string;
  secondaryClassName?: string;
  /** When true, only render the primary display name line. */
  primaryOnly?: boolean;
  premiumBadge?: React.ReactNode;
};

/** Canonical two-line profile name: display name + optional @handle. */
export function ProfileNameLines({
  user,
  primaryClassName = 'truncate font-bold leading-tight',
  secondaryClassName = 'truncate text-foreground/65 leading-tight',
  primaryOnly = false,
  premiumBadge = null,
}: ProfileNameLinesProps) {
  return (
    <>
      <span className={`${primaryClassName} flex items-center gap-1.5 min-w-0`}>
        <span className="truncate">{getProfileDisplayName(user)}</span>
        {premiumBadge}
      </span>
      {!primaryOnly && shouldShowProfileHandle(user) ? (
        <span className={secondaryClassName}>{formatProfileHandle(user)}</span>
      ) : null}
    </>
  );
}

export function ProfileNamePrimary({
  user,
  className = '',
  fallback = 'User',
}: {
  user: Partial<User> | null | undefined;
  className?: string;
  fallback?: string;
}) {
  return <span className={className}>{getProfileDisplayName(user, fallback)}</span>;
}
