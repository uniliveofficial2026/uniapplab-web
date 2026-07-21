#!/usr/bin/env node
/**
 * Emit greedy-tap Vercel route snippets for vercel.json / vercel.monorepo.json.
 * Set GREEDY_TAP_ORIGIN (e.g. https://uniapplab-greedy-tap.onrender.com) before deploy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const origin = (process.env.GREEDY_TAP_ORIGIN || '').replace(/\/$/, '');

function stripExistingGreedyRoutes(routes, key = 'src') {
  return (routes || []).filter((r) => {
    const pathKey = r[key] || '';
    return !(
      pathKey.includes('socket.io') ||
      pathKey.includes('/uploads/') ||
      pathKey.includes('/api/items') ||
      pathKey.includes('/api/leaderboard') ||
      pathKey.includes('/api/jackpot') ||
      pathKey.includes('/api/shop') ||
      pathKey.includes('/api/user') ||
      pathKey.includes('/api/seller') ||
      pathKey.includes('/api/admin/verify') ||
      pathKey.includes('/api/admin/upload-icon') ||
      pathKey.includes('/api/admin/toggle-ai') ||
      pathKey.includes('/api/admin/ai-settings') ||
      pathKey.includes('/api/admin/force-win') ||
      pathKey.includes('/api/admin/seller-applications') ||
      pathKey.includes('/api/admin/reward') ||
      pathKey.includes('/api/admin/transactions') ||
      pathKey.includes('/api/admin/bets-history') ||
      pathKey.includes('/api/admin/shop-settings') ||
      (typeof r.dest === 'string' && r.dest.includes('greedy-tap')) ||
      (typeof r.destination === 'string' && r.destination.includes('greedy-tap'))
    );
  });
}

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
  '/api/admin/seller',
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
    routes.push({
      src: `${prefix}`,
      dest: `${origin}${prefix}`,
    });
    routes.push({
      src: `${prefix}/(.*)`,
      dest: `${origin}${prefix}/$1`,
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
    const cleaned = stripExistingGreedyRoutes(config.routes, 'src');
    const apiIdx = cleaned.findIndex(
      (r) => r.src === '/api/(.*)' || r.src?.startsWith('/api/'),
    );
    const insertAt = apiIdx >= 0 ? apiIdx : cleaned.length;
    config.routes = [
      ...cleaned.slice(0, insertAt),
      ...greedy,
      ...cleaned.slice(insertAt),
    ];
  }

  if (Array.isArray(config.rewrites)) {
    const cleaned = stripExistingGreedyRoutes(config.rewrites, 'source');
    const rewrites = greedy.map((r) => {
      if (r.src.includes('(.*)')) {
        const base = r.src.replace('/(.*)', '').replace('(.*)', '');
        return {
          source: `${base}/:path*`,
          destination: `${r.dest.replace('/$1', '').replace('$1', '')}/:path*`,
        };
      }
      return {
        source: r.src,
        destination: r.dest,
      };
    });
    const apiIdx = cleaned.findIndex((r) => r.source?.startsWith('/api'));
    const insertAt = apiIdx >= 0 ? apiIdx : 0;
    config.rewrites = [
      ...cleaned.slice(0, insertAt),
      ...rewrites,
      ...cleaned.slice(insertAt),
    ];
  }

  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`[greedy-vercel] patched ${path.relative(ROOT, filePath)} (${greedy.length} routes → ${origin})`);
}

patchVercelJson(path.join(ROOT, 'vercel.json'));
patchVercelJson(path.join(ROOT, 'vercel.monorepo.json'));
patchVercelJson(path.join(ROOT, 'artifacts/instacollab/vercel.json'));
