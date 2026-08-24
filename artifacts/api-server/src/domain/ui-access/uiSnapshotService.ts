import { checksumJson } from "../uiConfig/nodeValidate";

export function activateSnapshotAtomically(lockfile: Record<string, unknown>): { ok: true; checksum: string } | { ok: false; reason: string } {
  if (!lockfile || typeof lockfile !== "object") return { ok: false, reason: "invalid_lockfile" };
  if (!lockfile.snapshotId || !lockfile.experiences) return { ok: false, reason: "incomplete_lockfile" };
  const checksum = typeof lockfile.checksum === "string" ? lockfile.checksum : checksumJson(lockfile);
  return { ok: true, checksum };
}

export function snapshotsMustNotMix(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return String(a.snapshotId) !== String(b.snapshotId);
}
