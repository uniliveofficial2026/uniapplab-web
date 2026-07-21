/** Vite dev/preview proxy routes so Greedy Tap APIs + socket.io work on the UniLive origin. */

const GREEDY_TARGET = (process.env.GREEDY_TAP_INTERNAL_URL || 'http://127.0.0.1:3000').replace(
  /\/$/,
  '',
);

const GREEDY_API_PREFIXES = [
  '/api/health',
  '/api/items',
  '/api/admin',
  '/api/seller-applications',
  '/api/seller',
  '/api/leaderboard',
  '/api/shop',
  '/api/user',
  '/api/jackpot',
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

export function mergeViteProxyConfig(unifiedLive, unifiedApiOrigin) {
  const greedy = createGreedyTapProxyRoutes();
  if (!unifiedLive) {
    return Object.keys(greedy).length ? greedy : undefined;
  }

  return {
    ...greedy,
    '/api': {
      target: unifiedApiOrigin,
      changeOrigin: true,
      secure: unifiedLive,
      bypass(req) {
        const url = req.url || '';
        for (const prefix of GREEDY_API_PREFIXES) {
          if (url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`)) {
            return false;
          }
        }
        return null;
      },
    },
  };
}
