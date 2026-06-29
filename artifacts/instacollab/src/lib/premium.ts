import type { User, PremiumSubscription } from '../types';
import {
  isProfilePremiumPackageId,
  isProfilePremiumTierId,
  PREMIUM_PACKAGES,
  PROFILE_PREMIUM_ENTITLEMENT_ID,
  type PremiumPackageId,
  type ProfilePremiumTierId,
} from './premiumPackages';

export const PREMIUM_DAY_MS = 24 * 60 * 60 * 1000;

export type PremiumSubscriptionStatus = {
  packageId: typeof PROFILE_PREMIUM_ENTITLEMENT_ID;
  active: boolean;
  purchasedAt: number | null;
  expiresAt: number | null;
  daysRemaining: number;
  lastTierId: ProfilePremiumTierId | null;
  planLabel: string | null;
  periodLabel: string | null;
  timeRemainingLabel: string;
};

export function getPackageDurationMs(packageId: PremiumPackageId): number {
  if (isProfilePremiumTierId(packageId)) {
    const days = PREMIUM_PACKAGES[packageId].durationDays;
    return days * PREMIUM_DAY_MS;
  }
  return 30 * PREMIUM_DAY_MS;
}

export function normalizePremiumSubscriptions(
  user: User | null | undefined,
  now = Date.now()
): PremiumSubscription[] {
  if (!user) return [];

  const raw = user.premiumSubscriptions;
  let subs: PremiumSubscription[] = [];

  if (Array.isArray(raw) && raw.length > 0) {
    subs = raw
      .filter(
        (s): s is PremiumSubscription =>
          !!s &&
          typeof s.packageId === 'string' &&
          typeof s.purchasedAt === 'number' &&
          typeof s.expiresAt === 'number'
      )
      .map((s) => ({ ...s, packageId: s.packageId as PremiumPackageId }));
  } else {
    const legacy = user.purchasedPremiumPackages;
    if (Array.isArray(legacy) && legacy.length > 0) {
      subs = legacy
        .filter((id) => isProfilePremiumPackageId(id))
        .map(() => ({
          packageId: PROFILE_PREMIUM_ENTITLEMENT_ID,
          purchasedAt: now,
          expiresAt: now + 30 * PREMIUM_DAY_MS,
        }));
    }
  }

  return consolidateProfilePremiumSubscriptions(subs, now);
}

/** One entitlement row for all profile premium tiers. */
export function consolidateProfilePremiumSubscriptions(
  subs: PremiumSubscription[],
  now = Date.now()
): PremiumSubscription[] {
  const other = subs.filter((s) => !isProfilePremiumPackageId(s.packageId));
  const premium = subs.filter((s) => isProfilePremiumPackageId(s.packageId));
  if (premium.length === 0) return other;

  const maxExpires = Math.max(...premium.map((s) => s.expiresAt));
  const latestRow = premium.reduce((best, s) =>
    s.purchasedAt >= best.purchasedAt ? s : best
  );
  if (maxExpires <= now) return other;

  const lastTierId =
    latestRow.lastTierId ??
    (isProfilePremiumTierId(latestRow.packageId) ? latestRow.packageId : undefined);

  return [
    ...other,
    {
      packageId: PROFILE_PREMIUM_ENTITLEMENT_ID,
      purchasedAt: latestRow.purchasedAt,
      expiresAt: maxExpires,
      ...(lastTierId ? { lastTierId } : {}),
    },
  ];
}

export function getProfilePremiumAccess(
  user: User | null | undefined,
  now = Date.now()
): PremiumSubscription | null {
  const subs = normalizePremiumSubscriptions(user, now);
  const row = subs.find(
    (s) => s.packageId === PROFILE_PREMIUM_ENTITLEMENT_ID && s.expiresAt > now
  );
  return row ?? null;
}

export function userHasProfilePremium(
  user: User | null | undefined,
  now = Date.now()
): boolean {
  return getProfilePremiumAccess(user, now) != null;
}

export function getPremiumTimeRemainingLabel(
  expiresAt: number,
  now = Date.now()
): string {
  const ms = expiresAt - now;
  if (ms <= 0) return 'Expired';

  const days = Math.floor(ms / PREMIUM_DAY_MS);
  const hours = Math.floor((ms % PREMIUM_DAY_MS) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / 60_000);

  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'}, ${hours} hr left`;
  }
  if (hours > 0) {
    return `${hours} hr, ${minutes} min left`;
  }
  return `${minutes} min left`;
}

export function getProfilePremiumAccessStatus(
  user: User | null | undefined,
  now = Date.now()
): PremiumSubscriptionStatus {
  const inactive: PremiumSubscriptionStatus = {
    packageId: PROFILE_PREMIUM_ENTITLEMENT_ID,
    active: false,
    purchasedAt: null,
    expiresAt: null,
    daysRemaining: 0,
    lastTierId: null,
    planLabel: null,
    periodLabel: null,
    timeRemainingLabel: 'Expired',
  };

  const access = getProfilePremiumAccess(user, now);
  if (!access) return inactive;

  const tierId = isProfilePremiumTierId(access.lastTierId)
    ? access.lastTierId
    : null;
  const tier = tierId ? PREMIUM_PACKAGES[tierId] : null;

  return {
    packageId: PROFILE_PREMIUM_ENTITLEMENT_ID,
    active: true,
    purchasedAt: access.purchasedAt,
    expiresAt: access.expiresAt,
    daysRemaining: getPremiumDaysRemaining(access.expiresAt, now),
    lastTierId: tierId,
    planLabel: tier?.name ?? 'Profile Premium',
    periodLabel: tier?.periodLabel ?? null,
    timeRemainingLabel: getPremiumTimeRemainingLabel(access.expiresAt, now),
  };
}

export function getPremiumSubscription(
  user: User | null | undefined,
  packageId: PremiumPackageId,
  now = Date.now()
): PremiumSubscription | null {
  if (isProfilePremiumPackageId(packageId)) {
    return getProfilePremiumAccess(user, now);
  }
  const subs = normalizePremiumSubscriptions(user, now);
  return (
    subs.find((s) => s.packageId === packageId && s.expiresAt > now) ?? null
  );
}

export function userHasPremiumPackage(
  user: User | null | undefined,
  packageId: PremiumPackageId,
  now = Date.now()
): boolean {
  return getPremiumSubscription(user, packageId, now) != null;
}

export function getPremiumSubscriptionStatus(
  user: User | null | undefined,
  packageId: PremiumPackageId,
  now = Date.now()
): PremiumSubscriptionStatus {
  if (isProfilePremiumPackageId(packageId)) {
    return getProfilePremiumAccessStatus(user, now);
  }

  const subs = normalizePremiumSubscriptions(user, now);
  const latest = subs
    .filter((s) => s.packageId === packageId)
    .sort((a, b) => b.expiresAt - a.expiresAt)[0];

  if (!latest) {
    return getProfilePremiumAccessStatus(user, now);
  }

  const active = latest.expiresAt > now;
  if (isProfilePremiumPackageId(packageId)) {
    return getProfilePremiumAccessStatus(user, now);
  }

  return {
    packageId: PROFILE_PREMIUM_ENTITLEMENT_ID,
    active,
    purchasedAt: latest.purchasedAt,
    expiresAt: latest.expiresAt,
    daysRemaining: active ? getPremiumDaysRemaining(latest.expiresAt, now) : 0,
    lastTierId: null,
    planLabel: null,
    periodLabel: null,
    timeRemainingLabel: active
      ? getPremiumTimeRemainingLabel(latest.expiresAt, now)
      : 'Expired',
  };
}

export function getPremiumDaysRemaining(
  expiresAt: number,
  now = Date.now()
): number {
  if (expiresAt <= now) return 0;
  return Math.max(0, Math.ceil((expiresAt - now) / PREMIUM_DAY_MS));
}

export function formatPremiumExpiryDate(expiresAt: number): string {
  return new Date(expiresAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export type { ProfilePremiumTierId };
