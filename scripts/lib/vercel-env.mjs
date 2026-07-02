/**
 * Vercel env sync helpers (CLI v54+ — fully non-interactive).
 */
import { spawnSync } from 'node:child_process';

export function vercelEnv() {
  return {
    ...process.env,
    CI: '1',
    VERCEL_NON_INTERACTIVE: '1',
    NPM_CONFIG_USERCONFIG: undefined,
    NPM_CONFIG_GLOBALCONFIG: undefined,
  };
}

/** Set one env var for production | preview | development. */
export function vercelEnvSet(cwd, name, value, target) {
  spawnSync('pnpm', ['dlx', 'vercel@latest', 'env', 'rm', name, target, '--yes'], {
    cwd,
    stdio: 'ignore',
    env: vercelEnv(),
  });

  const add = spawnSync(
    'pnpm',
    [
      'dlx',
      'vercel@latest',
      'env',
      'add',
      name,
      target,
      '--yes',
      '--force',
      '--value',
      value,
    ],
    {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: vercelEnv(),
    },
  );
  if (add.status !== 0 && add.stderr) {
    const err = add.stderr.toString().trim();
    if (err) console.error(err);
  }
  return add.status ?? 1;
}

/** Sync many vars to all standard Vercel targets. */
export function vercelEnvSyncAll(cwd, vars, { label = 'vercel' } = {}) {
  const targets = ['production', 'preview', 'development'];
  for (const target of targets) {
    for (const [name, value] of vars) {
      if (!value) continue;
      const code = vercelEnvSet(cwd, name, value, target);
      if (code !== 0) {
        console.error(`[${label}] Failed ${name} (${target})`);
        return code;
      }
      console.log(`[${label}] ✓ ${name} → ${target}`);
    }
  }
  return 0;
}
