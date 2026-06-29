import type { User } from '../../../types';

export type RankingTuning = {
  distanceWeight: number;
  affinityWeight: number;
  profileQualityWeight: number;
  completenessWeight: number;
  learningWeight: number;
};

export function getPseudoAge(user: User): number {
  const seed = Math.abs((user.id + user.username).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
  return 18 + (seed % 25);
}

export function getPseudoDistance(user: User): number {
  const seed = Math.abs((user.username + user.id).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
  return 1 + (seed % 120);
}

export function matchesPreferences(
  user: User,
  preferences: { minAge: number; maxAge: number; maxDistanceKm: number }
): boolean {
  const age = getPseudoAge(user);
  const distance = getPseudoDistance(user);
  return age >= preferences.minAge && age <= preferences.maxAge && distance <= preferences.maxDistanceKm;
}

export function computeAutoExperimentBucket(seed: string): 'A' | 'B' | 'C' {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 33 + seed.charCodeAt(i)) >>> 0;
  const mod = hash % 3;
  return mod === 0 ? 'A' : mod === 1 ? 'B' : 'C';
}

export function getBucketAdjustedTuning(
  bucket: 'A' | 'B' | 'C',
  tuning: RankingTuning
): RankingTuning {
  if (bucket === 'A') return tuning;
  if (bucket === 'B') {
    return {
      ...tuning,
      affinityWeight: Math.min(2, tuning.affinityWeight + 0.4),
      distanceWeight: Math.max(0, tuning.distanceWeight - 0.2),
    };
  }
  return {
    ...tuning,
    learningWeight: Math.min(2, tuning.learningWeight + 0.4),
    profileQualityWeight: Math.min(2, tuning.profileQualityWeight + 0.2),
  };
}

export function computeRecommendationScore(params: {
  user: User;
  followerIds: Set<string>;
  followingIds: Set<string>;
  profileCompleteness: number;
  learnedSignals: { preferredAvgAge: number | null; preferredAvgDistanceKm: number | null };
  bucket: 'A' | 'B' | 'C';
  baseTuning: RankingTuning;
}): number {
  const distanceScore = 130 - getPseudoDistance(params.user);
  const affinity =
    (params.followerIds.has(params.user.id) ? 70 : 0) +
    (params.followingIds.has(params.user.id) ? 40 : 0);
  const profileQuality =
    (params.user.bio && params.user.bio.length > 20 ? 15 : 0) +
    (params.user.avatarUrl ? 10 : 0) +
    (params.user.isVerified ? 12 : 0);
  const completenessBoost = params.profileCompleteness / 5;
  const learnedAge = params.learnedSignals.preferredAvgAge;
  const learnedDistance = params.learnedSignals.preferredAvgDistanceKm;
  const learningScore =
    learnedAge === null || learnedDistance === null
      ? 0
      : Math.max(0, 40 - Math.abs(getPseudoAge(params.user) - learnedAge) * 2) +
        Math.max(0, 30 - Math.abs(getPseudoDistance(params.user) - learnedDistance) * 0.8);
  const tuned = getBucketAdjustedTuning(params.bucket, params.baseTuning);
  return (
    distanceScore * tuned.distanceWeight +
    affinity * tuned.affinityWeight +
    profileQuality * tuned.profileQualityWeight +
    completenessBoost * tuned.completenessWeight +
    learningScore * tuned.learningWeight
  );
}

export function shouldAutoMatch(seed: string, targetUserId: string, followerIds: string[]): boolean {
  if (followerIds.includes(targetUserId)) return true;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % 100 < 35;
}
