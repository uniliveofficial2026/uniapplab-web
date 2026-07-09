import type { LocalDB } from './db/localDbType';
import { getKstarCoinsFromStore } from './kstarUserState';
import { resolveLiveCountry } from '../components/live/liveCountries';
import type { User } from '../types';

export type AdminLeaderboardMetric = 'xp' | 'level' | 'followers' | 'likes' | 'gifts' | 'rank';

export type AdminLeaderboardRow = {
  userId: string;
  user: User;
  rank: number;
  country: string;
  level: number;
  tierLabel: string;
  xp: number;
  followers: number;
  following: number;
  likesReceived: number;
  kstarCoins: number;
  isLive: boolean;
  score: number;
};

export function buildAdminLeaderboard(
  db: LocalDB,
  input: {
    countryFilter?: string;
    metric?: AdminLeaderboardMetric;
    limit?: number;
  } = {},
): AdminLeaderboardRow[] {
  const metric = input.metric ?? 'xp';
  const limit = input.limit ?? 100;
  const countryFilter = String(input.countryFilter ?? 'all').trim();

  const rows: AdminLeaderboardRow[] = (db.users ?? []).map((user) => {
    const progress = db.getCreatorProgress(user.id);
    const followers = db.getFollowListMembers(user.id, 'followers').length;
    const following = db.getFollowListMembers(user.id, 'following').length;
    const country = resolveLiveCountry(user.id, user.country);
    const kstarCoins = getKstarCoinsFromStore(user.id);

    let score = progress.xp;
    if (metric === 'level') score = progress.level * 1_000_000 + progress.xp;
    if (metric === 'followers') score = followers;
    if (metric === 'likes') score = progress.activity.likesReceived;
    if (metric === 'gifts') score = kstarCoins;
    if (metric === 'rank') score = progress.level * 1_000_000 + progress.xp;

    return {
      userId: user.id,
      user,
      rank: 0,
      country,
      level: progress.level,
      tierLabel: progress.tierLabel,
      xp: progress.xp,
      followers,
      following,
      likesReceived: progress.activity.likesReceived,
      kstarCoins,
      isLive: user.status === 'live',
      score,
    };
  });

  const filtered =
    countryFilter === 'all'
      ? rows
      : rows.filter((row) => row.country.toLowerCase() === countryFilter.toLowerCase());

  filtered.sort((a, b) => b.score - a.score || b.xp - a.xp);

  return filtered.slice(0, limit).map((row, index) => ({ ...row, rank: index + 1 }));
}

export function listAdminLeaderboardCountries(db: LocalDB): string[] {
  const set = new Set<string>();
  for (const user of db.users ?? []) {
    set.add(resolveLiveCountry(user.id, user.country));
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function lookupAdminUserRank(
  db: LocalDB,
  userId: string,
  metric: AdminLeaderboardMetric = 'xp',
): { globalRank: number | null; countryRank: number | null; country: string } {
  const user = (db.users ?? []).find((row) => row.id === userId);
  const country = resolveLiveCountry(userId, user?.country);
  const globalRows = buildAdminLeaderboard(db, { metric, limit: 10_000 });
  const countryRows = buildAdminLeaderboard(db, { metric, countryFilter: country, limit: 10_000 });
  return {
    globalRank: globalRows.find((row) => row.userId === userId)?.rank ?? null,
    countryRank: countryRows.find((row) => row.userId === userId)?.rank ?? null,
    country,
  };
}
