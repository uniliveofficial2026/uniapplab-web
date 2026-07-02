/**
 * Vercel env sync helpers (CLI v54+ — no --git-branch flag).
 */
import { spawnSync } from 'node:child_process';

export function vercelEnv(cwd) {
  return {
    ...process.env,
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
    ['dlx', 'vercel@latest', 'env', 'add', name, target, '--yes', '--force'],
    {
      cwd,
      input: value,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: vercelEnv(),
    },
  );
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
