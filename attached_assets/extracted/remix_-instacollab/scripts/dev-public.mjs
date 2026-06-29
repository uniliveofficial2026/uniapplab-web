#!/usr/bin/env node
/**
 * Run Vite on localhost:3000 and a Cloudflare quick tunnel for public HTTPS access.
 * Usage: npm run dev:public
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.DEV_PORT || '3000';
const localUrl = `http://localhost:${PORT}`;
const localNetwork = `http://127.0.0.1:${PORT}`;

let tunnelUrl = '';
let viteExited = false;

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function spawnProc(command, args, opts = {}) {
  return spawn(command, args, {
    cwd: root,
    stdio: opts.stdio ?? 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...opts.env },
  });
}

log('');
log('InstaCollab — local + internet');
log('────────────────────────────');
log(`Local:   ${localUrl}`);
log('Starting Vite (port must be free)…');
log('');

const vite = spawnProc('npm', ['run', 'dev'], { stdio: 'inherit' });

vite.on('exit', (code) => {
  viteExited = true;
  if (code && code !== 0) {
    log(`\nVite exited (${code}). Free port ${PORT}: lsof -ti :${PORT} | xargs kill`);
  }
  process.exit(code ?? 0);
});

const startTunnel = () => {
  log('Starting Cloudflare tunnel…');
  const tunnel = spawnProc(
    'npx',
    ['--yes', 'cloudflared', 'tunnel', '--url', localUrl],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const onTunnelData = (buf) => {
    const text = buf.toString();
    process.stderr.write(text);
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !tunnelUrl) {
      tunnelUrl = match[0];
      let host = '';
      try {
        host = new URL(tunnelUrl).hostname;
      } catch {
        host = tunnelUrl.replace(/^https:\/\//, '').split('/')[0] ?? '';
      }
      log('');
      log('────────────────────────────');
      log(`Public:  ${tunnelUrl}`);
      log('────────────────────────────');
      log('');
      log('Open the Public URL above in the browser for Google / Apple sign-in (Supabase OAuth).');
      log('');
      log('Each new trycloudflare URL — update once:');
      log('');
      log('  Supabase → Authentication → URL Configuration');
      log(`    → Site URL: ${tunnelUrl}`);
      log(`    → Redirect URLs: ${tunnelUrl}  and  ${tunnelUrl}/**`);
      log('');
      log('  Google Cloud → Credentials → Web OAuth client');
      log(`    → Authorized JavaScript origins → ${tunnelUrl}`);
      log('    → Authorized redirect URIs → YOUR_PROJECT.supabase.co/auth/v1/callback');
      log('       (NOT the tunnel URL — run oauth:setup for the exact callback)');
      log('');
      log('  Run: npm run oauth:setup -- ' + tunnelUrl);
      log('');
      log('  Full guide: docs/CLOUD_AUTH.md');
      log('');
    }
  };

  tunnel.stdout.on('data', onTunnelData);
  tunnel.stderr.on('data', onTunnelData);

  tunnel.on('exit', (code) => {
    if (!viteExited) {
      log(`\nTunnel stopped (${code ?? 0}).`);
      vite.kill('SIGTERM');
    }
  });
};

setTimeout(startTunnel, 3500);

process.on('SIGINT', () => {
  vite.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGTERM', () => {
  vite.kill('SIGTERM');
  process.exit(0);
});
