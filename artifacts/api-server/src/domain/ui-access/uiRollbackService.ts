export function rollbackToPriorSnapshot(currentId: string, priorId: string): { snapshotId: string; atomic: true } {
  if (!priorId || priorId === currentId) {
    throw new Error("rollback requires a different prior snapshot");
  }
  return { snapshotId: priorId, atomic: true };
}
