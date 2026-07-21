#!/usr/bin/env node
/**
 * Emit greedy-tap Vercel route snippets for vercel.json / vercel.monorepo.json.
 * Set GREEDY_TAP_ORIGIN (e.g. https://uniapplab-greedy-tap.onrender.com) before deploy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const origin = (process.env.GREEDY_TAP_ORIGIN || '').replace(/\/$/, '');

const GREEDY_API_PREFIXES = [
  '/api/items',
  '/api/leaderboard',
  '/api/jackpot',
  '/api/shop',
  '/api/user',
  '/api/seller',
  '/api/seller-applications',
  '/api/admin/verify',
  '/api/admin/upload-icon',
  '/api/admin/toggle-ai',
  '/api/admin/ai-settings',
  '/api/admin/force-win',
  '/api/admin/seller-applications',
  '/api/admin/reward',
  '/api/admin/transactions',
  '/api/admin/bets-history',
  '/api/admin/shop-settings',
];

function greedyRoutes() {
  if (!origin) return [];
  const routes = [
    {
      src: '/socket.io/(.*)',
      dest: `${origin}/socket.io/$1`,
    },
    {
      src: '/uploads/(.*)',
      dest: `${origin}/uploads/$1`,
    },
  ];
  for (const prefix of GREEDY_API_PREFIXES) {
    const stripped = prefix.replace(/^\//, '');
    routes.push({
      src: `/${stripped}(.*)`,
      dest: `${origin}/${stripped}$1`,
    });
  }
  return routes;
}

function patchVercelJson(filePath) {
  if (!fs.existsSync(filePath)) return;
  const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const greedy = greedyRoutes();
  if (!greedy.length) {
    console.log(`[greedy-vercel] GREEDY_TAP_ORIGIN unset — skip ${path.relative(ROOT, filePath)}`);
    return;
  }

  if (Array.isArray(config.routes)) {
    const apiIdx = config.routes.findIndex(
      (r) => r.src === '/api/(.*)' || r.src?.startsWith('/api/'),
    );
    const insertAt = apiIdx >= 0 ? apiIdx : config.routes.length;
    config.routes = [
      ...config.routes.slice(0, insertAt),
      ...greedy,
      ...config.routes.slice(insertAt),
    ];
  }

  if (Array.isArray(config.rewrites)) {
    const rewrites = greedy.map((r) => ({
      source: r.src.replace('(.*)', ':path*').replace(/\(\.\*\)/g, ':path*'),
      destination: r.dest.replace('$1', ':path*'),
    }));
    const apiIdx = config.rewrites.findIndex((r) => r.source?.startsWith('/api'));
    const insertAt = apiIdx >= 0 ? apiIdx : 0;
    config.rewrites = [
      ...config.rewrites.slice(0, insertAt),
      ...rewrites,
      ...config.rewrites.slice(insertAt),
    ];
  }

  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`[greedy-vercel] patched ${path.relative(ROOT, filePath)} (${greedy.length} routes → ${origin})`);
}

patchVercelJson(path.join(ROOT, 'vercel.json'));
patchVercelJson(path.join(ROOT, 'vercel.monorepo.json'));
patchVercelJson(path.join(ROOT, 'artifacts/instacollab/vercel.json'));
