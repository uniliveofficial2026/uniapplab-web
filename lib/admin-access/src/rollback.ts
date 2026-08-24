export type RollbackTarget = {
  snapshotId: string;
  configVersionId: string | null;
};

export function assertRollbackTarget(target: RollbackTarget | null): RollbackTarget {
  if (!target?.snapshotId) throw new Error("no prior published version");
  return target;
}
