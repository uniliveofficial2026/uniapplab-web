/** Canonical sorted pair key for 1:1 DM threads. */
export function buildDmKey(userA: string, userB: string): string {
  return [userA, userB].sort().join(':');
}
