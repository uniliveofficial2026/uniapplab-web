/** Vite dev/preview proxy routes so Greedy Tap APIs + socket.io work on the UniLive origin. */

const GREEDY_TARGET = (process.env.GREEDY_TAP_INTERNAL_URL || 'http://127.0.0.1:3000').replace(
  /\/$/,
  '',
);

/** Greedy-only paths — never steal UniLive's /api/admin control plane. */
const GREEDY_API_PREFIXES = [
  '/api/items',
  '/api/seller-applications',
  '/api/seller',
  '/api/leaderboard',
  '/api/shop',
  '/api/user',
  '/api/jackpot',
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

export function createGreedyTapProxyRoutes() {
  if (process.env.GREEDY_TAP_SKIP === '1') {
    return {};
  }

  const routes = {};

  for (const prefix of GREEDY_API_PREFIXES) {
    routes[prefix] = {
      target: GREEDY_TARGET,
      changeOrigin: true,
    };
  }

  routes['/uploads'] = {
    target: GREEDY_TARGET,
    changeOrigin: true,
  };

  routes['/socket.io'] = {
    target: GREEDY_TARGET,
    changeOrigin: true,
    ws: true,
  };

  return routes;
}

function isGreedyApiPath(url) {
  for (const prefix of GREEDY_API_PREFIXES) {
    if (url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`)) {
      return true;
    }
  }
  return false;
}

const CONTROL_PLANE_PREFIXES = [
  '/api/admin/dev',
  '/api/admin/access',
  '/api/admin/ui',
  '/api/admin/assets',
  '/api/admin/me',
  '/api/admin/change-sets',
  '/api/admin/permissions',
  // Quota fallbacks, live seed ids, and cache live only on api-server.
  '/api/youtube',
];

export function mergeViteProxyConfig(_unifiedLive, unifiedApiOrigin) {
  const greedy = createGreedyTapProxyRoutes();
  const apiOrigin = (unifiedApiOrigin || 'https://app.uniapplab.com').replace(/\/$/, '');
  const localControlPlane = (
    process.env.VITE_UNIFIED_LIVE_API ||
    process.env.UNILIVE_LOCAL_CONTROL_PLANE ||
    'http://127.0.0.1:5001'
  ).replace(/\/$/, '');

  const routes = { ...greedy };

  if (process.env.UNILIVE_LOCAL_CONTROL_PLANE !== '0') {
    for (const prefix of CONTROL_PLANE_PREFIXES) {
      routes[prefix] = {
        target: localControlPlane,
        changeOrigin: true,
      };
    }
  }

  routes['/api'] = {
    target: apiOrigin,
    changeOrigin: true,
    secure: apiOrigin.startsWith('https'),
    bypass(req) {
      const url = req.url || '';
      if (isGreedyApiPath(url)) return false;
      return null;
    },
  };

  return routes;
}
