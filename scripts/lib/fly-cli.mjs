/**
 * Resolve fly/flyctl binary — Homebrew installs `flyctl`, symlink may be `fly`.
 */
import { spawnSync } from 'node:child_process';

export function resolveFlyBin() {
  for (const bin of ['flyctl', 'fly']) {
    const which = spawnSync('command', ['-v', bin], { shell: true, encoding: 'utf8' });
    if (which.status === 0) return bin.trim();
  }
  return null;
}

export function flyInstallHint() {
  return [
    'Install Fly CLI:',
    '  brew install flyctl',
    '  # or: curl -L https://fly.io/install.sh | sh',
    'Then add to PATH (install.sh prints the line), restart terminal, and run:',
    '  flyctl auth login',
  ].join('\n');
}

export function flySpawn(args, options = {}) {
  const bin = resolveFlyBin();
  if (!bin) return { status: 127, stdout: '', stderr: 'flyctl not found' };
  return spawnSync(bin, args, {
    encoding: 'utf8',
    ...options,
  });
}
