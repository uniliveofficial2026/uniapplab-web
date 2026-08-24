import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** Resolve monorepo root whether running from src, dist, or tests. */
export function resolveRepoRoot(): string {
  const markers = ["config/ui-catalog", "config/admin-access"];
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (markers.every((m) => existsSync(join(dir, m)))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(process.cwd(), "../..");
}

export function repoPath(...segments: string[]): string {
  return join(resolveRepoRoot(), ...segments);
}
