import type { PkLiveHost } from '../hooks/usePkLiveHosts';

export type PkInviteFollowFilter = 'all' | 'following' | 'followers';

export function pkInviteFollowFilterLabel(filter: PkInviteFollowFilter): string {
  if (filter === 'following') return 'Following';
  if (filter === 'followers') return 'Followers';
  return 'All';
}

export function filterPkLiveHostsByFollow(
  hosts: PkLiveHost[],
  filter: PkInviteFollowFilter,
): PkLiveHost[] {
  if (filter === 'following') return hosts.filter((host) => host.isFollowing);
  if (filter === 'followers') return hosts.filter((host) => host.isFollower);
  return hosts;
}

/** Match user id, public id, username, name, room id, room title, etc. */
export function searchPkLiveHosts(hosts: PkLiveHost[], rawQuery: string): PkLiveHost[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return hosts;
  const tokens = q.split(/\s+/).filter(Boolean);
  return hosts.filter((host) => {
    const haystack = [
      host.name,
      host.username,
      host.userId,
      host.publicUserId,
      host.roomId,
      host.roomTitle,
      host.roomMode,
      host.isFollowing ? 'following follow' : '',
      host.isFollower ? 'followers follower' : '',
      'live',
      'room',
      'user',
      'stream',
      'shop',
      'solo',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}
