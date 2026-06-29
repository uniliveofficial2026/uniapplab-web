/** Stored on the user when any profile premium tier is active. */
export const PROFILE_PREMIUM_ENTITLEMENT_ID = 'profile_premium' as const;

/** Purchasable duration tiers (wallet). */
export const PROFILE_PREMIUM_TIER_IDS = [
  'profile_premium_1m',
  'profile_premium_3m',
  'profile_premium_6m',
  'profile_premium_1y',
] as const;

export type ProfilePremiumTierId = (typeof PROFILE_PREMIUM_TIER_IDS)[number];

export type PremiumPackageId =
  | ProfilePremiumTierId
  | typeof PROFILE_PREMIUM_ENTITLEMENT_ID;

export type PremiumPackage = {
  id: ProfilePremiumTierId;
  name: string;
  price: number;
  currency: string;
  durationDays: number;
  periodLabel: string;
  description: string;
  features: string[];
};

const PROFILE_PREMIUM_FEATURES = [
  'Leave no trace — visits are not saved on others’ visitor lists',
  'Profile visitors list and insights on your profile',
  'Stacks with your current plan — time is added to your existing expiry',
];

export const PREMIUM_PACKAGES: Record<ProfilePremiumTierId, PremiumPackage> = {
  profile_premium_1m: {
    id: 'profile_premium_1m',
    name: 'Profile Premium — 1 month',
    price: 9.99,
    currency: 'USD',
    durationDays: 30,
    periodLabel: '1 month',
    description:
      'One month of Profile Premium: browse without leaving a trace and use premium profile tools.',
    features: ['30 days of access', ...PROFILE_PREMIUM_FEATURES],
  },
  profile_premium_3m: {
    id: 'profile_premium_3m',
    name: 'Profile Premium — 3 months',
    price: 26.99,
    currency: 'USD',
    durationDays: 90,
    periodLabel: '3 months',
    description:
      'Three months of Profile Premium at a better value than paying monthly.',
    features: ['90 days of access', ...PROFILE_PREMIUM_FEATURES],
  },
  profile_premium_6m: {
    id: 'profile_premium_6m',
    name: 'Profile Premium — 6 months',
    price: 49.99,
    currency: 'USD',
    durationDays: 180,
    periodLabel: '6 months',
    description:
      'Half a year of Profile Premium for creators who want long-term privacy and insights.',
    features: ['180 days of access', ...PROFILE_PREMIUM_FEATURES],
  },
  profile_premium_1y: {
    id: 'profile_premium_1y',
    name: 'Profile Premium — 1 year',
    price: 89.99,
    currency: 'USD',
    durationDays: 365,
    periodLabel: '1 year',
    description:
      'A full year of Profile Premium — best value for power users.',
    features: ['365 days of access', ...PROFILE_PREMIUM_FEATURES],
  },
};

export const PREMIUM_PACKAGE_LIST: PremiumPackage[] = PROFILE_PREMIUM_TIER_IDS.map(
  (id) => PREMIUM_PACKAGES[id]
);

export function isProfilePremiumTierId(
  id: string | undefined | null
): id is ProfilePremiumTierId {
  return (
    typeof id === 'string' &&
    (PROFILE_PREMIUM_TIER_IDS as readonly string[]).includes(id)
  );
}

export function isProfilePremiumPackageId(
  id: string | undefined | null
): boolean {
  return id === PROFILE_PREMIUM_ENTITLEMENT_ID || isProfilePremiumTierId(id);
}
