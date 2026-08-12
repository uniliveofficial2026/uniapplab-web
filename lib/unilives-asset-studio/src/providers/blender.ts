import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export function resolveBlenderBinary(): string | null {
  for (const candidate of [
    process.env.BLENDER_BIN,
    'blender',
    '/Users/wei/.local/bin/blender',
    '/opt/homebrew/bin/blender',
    '/Applications/Blender.app/Contents/MacOS/Blender',
  ]) {
    if (!candidate) continue;
    if (candidate.includes('/') && existsSync(candidate)) return candidate;
    const which = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  }
  return null;
}

export function blenderDoctor(): { ok: boolean; path: string | null; version?: string } {
  const bin = resolveBlenderBinary();
  if (!bin) return { ok: false, path: null };
  const ver = spawnSync(bin, ['--version'], { encoding: 'utf8' });
  const line = (ver.stdout || ver.stderr || '').split('\n')[0]?.trim();
  return { ok: ver.status === 0, path: bin, version: line };
}
