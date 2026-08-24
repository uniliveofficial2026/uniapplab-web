export function nextVersion(current: number): number {
  return Math.max(1, Number(current) || 1) + 1;
}

export function versionsMatch(expected: number, actual: number): boolean {
  return expected === actual;
}
