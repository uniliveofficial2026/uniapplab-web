import { mergeViteProxyConfig } from "./scripts/greedyTapProxyRoutes.mjs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import fs from "node:fs";
import os from "node:os";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";
import { createLogger, defineConfig, loadEnv } from "vite";
import { agentIngestPlugin } from "./vite-plugins/agentIngest";
import { youtubeApiPlugin } from "./vite-plugins/youtubeApi";
import { readDeeparEnabled } from "./scripts/read-deepar-enabled.mjs";
import {
  isStaleSupabaseUrl,
} from "./scripts/stale-supabase-refs.mjs";

const appRoot = path.resolve(import.meta.dirname);
const workspaceRoot = path.resolve(import.meta.dirname, "../..");
const legacyEnvRoot = path.resolve(
  workspaceRoot,
  "attached_assets/extracted/remix_-instacollab",
);
const deeparEnabled = readDeeparEnabled(appRoot);

const envSourceDirs = [appRoot, workspaceRoot, legacyEnvRoot];

/** Prefer app `.env`, then repo root, then legacy attached_assets copy. */
function resolveEnvDir(): string {
  for (const dir of envSourceDirs) {
    if (
      fs.existsSync(path.join(dir, ".env")) ||
      fs.existsSync(path.join(dir, ".env.local")) ||
      fs.existsSync(path.join(dir, ".env.development")) ||
      fs.existsSync(path.join(dir, ".env.development.local"))
    ) {
      return dir;
    }
  }
  return appRoot;
}

function applyPublicSupabaseConfig(merged: Record<string, string>) {
  const cfgPath = path.join(appRoot, "public", "supabase-config.json");
  if (!fs.existsSync(cfgPath)) return;
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as {
      supabaseUrl?: string;
      supabaseAnonKey?: string;
    };
    if (cfg.supabaseUrl && !isStaleSupabaseUrl(cfg.supabaseUrl)) {
      merged.VITE_SUPABASE_URL = cfg.supabaseUrl.replace(/\/$/, "");
      if (cfg.supabaseAnonKey) {
        merged.VITE_SUPABASE_ANON_KEY = cfg.supabaseAnonKey;
      }
    }
  } catch {
    /* ignore */
  }
}

/** Merge VITE_* (and GEMINI in dev only) from every known env location; app `.env` wins over root/legacy. */
function loadMergedViteEnv(mode: string): Record<string, string> {
  let merged: Record<string, string> = {};
  const allowGemini = mode !== "production";
  for (const dir of [...envSourceDirs].reverse()) {
    if (!fs.existsSync(dir)) continue;
    const next = loadEnv(mode, dir, "VITE_");
    for (const [key, value] of Object.entries(next)) {
      if (
        (key === "VITE_SUPABASE_URL" || key === "SUPABASE_URL") &&
        isStaleSupabaseUrl(value)
      ) {
        continue;
      }
      merged[key] = value;
    }
    const all = loadEnv(mode, dir, "");
    if (allowGemini && all.GEMINI_API_KEY?.trim()) {
      merged.VITE_GEMINI_API_KEY = all.GEMINI_API_KEY.trim();
    }
    if (mode !== "production" && all.YOUTUBE_API_KEY?.trim()) {
      merged.VITE_YOUTUBE_API_KEY = merged.VITE_YOUTUBE_API_KEY?.trim() || all.YOUTUBE_API_KEY.trim();
    }
  }
  if (isStaleSupabaseUrl(merged.VITE_SUPABASE_URL || "")) {
    delete merged.VITE_SUPABASE_URL;
  }
  applyPublicSupabaseConfig(merged);

  // Production builds must never bake localhost as the OAuth return URL.
  if (mode === "production") {
    const origin = (merged.VITE_APP_ORIGIN || "").trim();
    if (
      !origin ||
      /localhost|127\.0\.0\.1|\[::1\]/i.test(origin)
    ) {
      merged.VITE_APP_ORIGIN = "https://app.uniapplab.com";
      if (origin) {
        console.warn(
          `[vite] Ignoring loopback VITE_APP_ORIGIN (${origin}); using https://app.uniapplab.com for production OAuth redirects.`,
        );
      }
    }
  }
  return merged;
}

const viteLogger = createLogger();
const loggerWarn = viteLogger.warn.bind(viteLogger);
viteLogger.warn = (msg, options) => {
  if (typeof msg === "string") {
    if (msg.includes("dynamically imported") && msg.includes("statically imported")) return;
    if (msg.includes("Use of eval")) return;
    if (msg.includes("Generated an empty chunk")) return;
  }
  loggerWarn(msg, options);
};

const envDir = resolveEnvDir();

const rawDevPort = process.env.PORT ?? "5173";
const rawPreviewPort = process.env.PREVIEW_PORT ?? "4173";

const devPort = Number(rawDevPort);
const previewPort = Number(rawPreviewPort);

if (Number.isNaN(devPort) || devPort <= 0) {
  throw new Error(`Invalid PORT value: "${rawDevPort}"`);
}

if (Number.isNaN(previewPort) || previewPort <= 0) {
  throw new Error(`Invalid PREVIEW_PORT value: "${rawPreviewPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";
const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
const useDevHttps = process.env.DEV_HTTPS === "true";
const pwaDevEnabled = process.env.PWA_DEV === "true";

function resolveLanHost(): string | undefined {
  if (process.env.HMR_HOST) return process.env.HMR_HOST;
  try {
    const nets = os.networkInterfaces();
    for (const ifaces of Object.values(nets)) {
      for (const iface of ifaces ?? []) {
        if (iface.family !== "IPv4" || iface.internal) continue;
        if (
          iface.address.startsWith("192.168.") ||
          iface.address.startsWith("10.") ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(iface.address)
        ) {
          return iface.address;
        }
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

const devBindHost = process.env.DEV_BIND_HOST ?? "127.0.0.1";
const lanHost = devBindHost === "0.0.0.0" ? resolveLanHost() : undefined;
const disableHmr = process.env.DISABLE_HMR === "true";
const useWatchPolling =
  process.env.DEV_USE_POLLING === "true" ||
  workspaceRoot.startsWith("/Volumes/") ||
  appRoot.startsWith("/Volumes/");

const replitPlugins =
  process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
    ? [
        (await import("@replit/vite-plugin-cartographer")).cartographer({
          root: path.resolve(import.meta.dirname, ".."),
        }),
        (await import("@replit/vite-plugin-dev-banner")).devBanner(),
      ]
    : [];

export default defineConfig(async ({ mode }) => {
  const isProd = mode === "production";
  const viteEnv = loadMergedViteEnv(mode);
  const unifiedLive =
    viteEnv.VITE_UNIFIED_LIVE === "true" ||
    process.env.VITE_UNIFIED_LIVE === "true";
  const unifiedApiOrigin =
    (viteEnv.VITE_UNIFIED_LIVE_API || process.env.VITE_UNIFIED_LIVE_API || "https://app.uniapplab.com")
      .replace(/\/$/, "");
  const envDefine = Object.fromEntries(
    Object.entries(viteEnv)
      .filter(([key]) => !(isProd && (key === "VITE_GEMINI_API_KEY" || key === "VITE_YOUTUBE_API_KEY")))
      .map(([key, val]) => [`import.meta.env.${key}`, JSON.stringify(val)]),
  );
  const youtubeApiKey =
    process.env.YOUTUBE_API_KEY?.trim() ||
    viteEnv.VITE_YOUTUBE_API_KEY?.trim() ||
    "";
  const youtubePlugin = youtubeApiPlugin(youtubeApiKey);

  const analyzePlugins =
    process.env.ANALYZE === "1"
      ? await import("rollup-plugin-visualizer")
          .then((m) => [
            m.visualizer({
              filename: path.resolve(appRoot, "dist/stats.html"),
              gzipSize: true,
              brotliSize: true,
              open: false,
            }),
          ])
          .catch(() => {
            console.warn(
              "[vite] ANALYZE=1 set but rollup-plugin-visualizer is not installed; skipping.",
            );
            return [];
          })
      : [];

  return {
  base: basePath,
  envDir,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(useDevHttps ? [basicSsl()] : []),
    ...analyzePlugins,
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "brand/app-logo.png",
        "pwa-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-192-maskable.png",
        "icons/icon-512-maskable.png",
        "local-game-sw.js",
        "robots.txt",
        "opengraph.jpg",
      ],
      devOptions: {
        enabled: pwaDevEnabled,
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: `${normalizedBase}index.html`,
        navigateFallbackDenylist: [
          /^\/api\//,
          /\/__local_game__\//,
          /^\/assets\//,
          /^\/live-version\.json$/,
        ],
        // Never precache version probe, API shell responses, or heavy lazy-only chunks.
        globIgnores: [
          "**/live-version.json",
          "**/api/**",
          "**/unilives-assets/**",
          "**/live-gifts/**",
          "**/live-tools-v14/**",
          "**/live-tools-v13/**",
          "**/live-tools-v15/**",
          "**/i18n/**",
          "**/greedy-tap/**",
          "**/games/**",
          "assets/vendor-webar-*",
          "assets/vendor-three-*",
          "assets/vendor-livekit-*",
          "assets/vendor-firebase-*",
          "assets/vendor-deepar-*",
          "assets/vendor-ai-*",
          "assets/vendor-emoji-*",
          "assets/vendor-charts-*",
          "assets/vendor-svga-*",
          "assets/smule-rooms-*",
          "assets/KaraokeScreen-*",
          "assets/UniLivesCharacterPreviewHost-*",
          "assets/WorkspaceGate-*",
          "assets/RoomsHost-*",
          "assets/LiveScreen-*",
          "assets/YouTube-*",
          "assets/**/*.jpg",
          "assets/**/*.jpeg",
          "assets/**/*.webp",
          "assets/**/*.png",
          "assets/**/*.svg",
        ],
        // Shell-only precache — lazy feature chunks + artwork load on demand via runtime cache.
        globPatterns: [
          "index.html",
          "assets/index-*.js",
          "assets/index-*.css",
          "assets/vendor-react-*.js",
          "assets/vendor-router-*.js",
          "assets/vendor-utils-*.js",
          "assets/vendor-icons-*.js",
          "assets/vendor-motion-*.js",
          "assets/vendor-supabase-*.js",
          "assets/instantUiBoot-*.js",
          "assets/app-*.js",
          "assets/firebase-config-*.js",
          "assets/preloadAppSurfaces-*.js",
          "brand/app-logo.png",
          "icons/icon-192.png",
          "icons/icon-512.png",
          "icons/icon-192-maskable.png",
          "icons/icon-512-maskable.png",
          "pwa-icon.png",
          "pwa-icon.svg",
          "robots.txt",
          "manifest.webmanifest",
          "firebase-config.json",
          "supabase-config.json",
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/") ||
              url.pathname === "/live-version.json" ||
              url.hostname.endsWith("supabase.co") ||
              url.hostname.includes("supabase") ||
              url.hostname.endsWith("googleapis.com") ||
              url.hostname.endsWith("firebaseio.com") ||
              url.hostname.endsWith("livekit.cloud") ||
              url.hostname.includes("livekit"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url }) =>
              /^\/(unilives-assets|live-gifts|live-tools-v14|live-tools-v13|live-tools-v15|i18n|greedy-tap|games)\//.test(
                url.pathname,
              ),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "app-static-assets",
              expiration: { maxEntries: 160, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/assets/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "app-chunks",
              expiration: { maxEntries: 96, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              request.destination === "image" &&
              (url.hostname.endsWith("uniapplab.com") ||
                url.hostname.endsWith("supabase.co")),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "media-swr",
              expiration: { maxEntries: 80, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        id: normalizedBase,
        name: "UniLive’s",
        short_name: "UniLive’s",
        description:
          "UniLive’s is a live social app for going live, chatting, sharing posts, and collaborating with creators in real time.",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone", "browser"],
        orientation: "portrait-primary",
        scope: basePath,
        start_url: normalizedBase,
        categories: ["social", "entertainment"],
        icons: [
          {
            src: `${normalizedBase}icons/icon-192.png`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${normalizedBase}icons/icon-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${normalizedBase}icons/icon-192-maskable.png`,
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: `${normalizedBase}icons/icon-512-maskable.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
    ...replitPlugins,
    agentIngestPlugin(workspaceRoot),
    ...(youtubePlugin ? [youtubePlugin] : []),
    {
      name: 'local-game-dev-guard',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          if (url.includes('/__local_game__/')) {
            // Without the local-game service worker this would wrongly fall through to index.html.
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('X-Local-Game', '1');
            res.end('Local game asset — register local-game-sw.js to serve this path.');
            return;
          }
          next();
        });
      },
    },
    {
      name: 'greedy-slot-spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const raw = (req.url || '').split('?')[0] || '';
          // Keep static assets; rewrite soft routes onto the embedded game shell.
          if (
            raw === '/games/greedy-slot' ||
            raw === '/games/greedy-slot/' ||
            raw === '/games/greedy-slot/admin' ||
            raw.startsWith('/games/greedy-slot/admin/')
          ) {
            req.url = '/games/greedy-slot/index.html';
          }
          next();
        });
      },
    },
    {
      name: 'strip-heavy-vendor-entry-side-effects',
      generateBundle(_options, bundle) {
        const heavy =
          /vendor-(?:firebase|livekit|webar|three|deepar|ai|emoji|charts)-[^"']+/;
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== 'chunk' || !chunk.isEntry) continue;
          const before = chunk.code;
          chunk.code = chunk.code.replace(
            new RegExp(String.raw`import\s*["']\./(${heavy.source})["'];?`, 'g'),
            '',
          );
          if (chunk.code === before) continue;
          chunk.imports = chunk.imports.filter((id) => !heavy.test(id));
        }
      },
    },
  ],
  define: {
    ...envDefine,
    ...(isProd
      ? {}
      : {
          "process.env.GEMINI_API_KEY": JSON.stringify(
            viteEnv.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "",
          ),
        }),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    exclude: ["deepar", "@deepar/beauty"],
  },
  assetsInclude: ['**/*.wasm', '**/*.bin', '**/*.deepar'],
  root: appRoot,
  customLogger: viteLogger,
  build: {
    outDir: path.resolve(appRoot, "dist/public"),
    emptyOutDir: true,
    // vendor-webar / livekit / firebase are intentionally large async chunks
    chunkSizeWarningLimit: 4000,
    // Keep Vite's default dependency preloads, but strip heavy async-only vendors.
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter(
          (dep) =>
            !dep.includes('vendor-livekit') &&
            !dep.includes('vendor-webar') &&
            !dep.includes('vendor-three') &&
            !dep.includes('vendor-deepar') &&
            !dep.includes('vendor-ai') &&
            !dep.includes('vendor-emoji') &&
            !dep.includes('vendor-charts') &&
            !dep.includes('firebase'),
        ),
    },
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "EVAL" && warning.id?.includes("svga")) return;
        if (warning.code === "EMPTY_BUNDLE") return;
        warn(warning);
      },
      output: {
        manualChunks(id) {
          // Shared Firebase config (no SDK) — breaks entry ↔ async app circular hoist.
          if (
            id.includes('/lib/firebase/config') ||
            id.includes('/lib/firebase/runtimeAuthConfig') ||
            id.includes('/lib/firebase/firebaseConfig') ||
            id.includes('firebase-config.json')
          ) {
            return 'firebase-config';
          }
          if (!id.includes('node_modules')) return;
          if (id.includes('livekit-client')) return 'vendor-livekit';
          if (id.includes('/three/') || id.includes('\\three\\') || id.endsWith('/three') || id.endsWith('\\three'))
            return 'vendor-three';
          if (id.includes('tencentcloud-webar')) return 'vendor-webar';
          if (id.includes('svga')) return 'vendor-svga';
          // Avoid empty vendor-deepar when DeepAR is compile-disabled
          if (deeparEnabled && id.includes('deepar')) return 'vendor-deepar';
          if (id.includes('@mediapipe') || id.includes('@google/genai')) return 'vendor-ai';
          if (id.includes('emoji-picker-react')) return 'vendor-emoji';
          if (id.includes('motion')) return 'vendor-motion';
          // Keep shared class helpers out of vendor-charts (recharts also depends on clsx).
          if (id.includes('clsx') || id.includes('tailwind-merge')) return 'vendor-utils';
          // Match package only — not local files like useRechartsTheme.ts
          if (id.includes('node_modules') && id.includes('recharts')) return 'vendor-charts';
          if (
            id.includes('node_modules/firebase/') ||
            id.includes('node_modules\\firebase\\') ||
            id.includes('/.pnpm/firebase@') ||
            id.includes('/.pnpm/@firebase+')
          ) {
            return 'vendor-firebase';
          }
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('/react-dom/') || id.includes('/react/')) return 'vendor-react';
        },
      },
    },
  },
  server: {
    port: devPort,
    strictPort: false,
    host: devBindHost,
    allowedHosts: true,
    watch: useWatchPolling
      ? {
          usePolling: true,
          interval: Number(process.env.DEV_POLL_INTERVAL_MS ?? 300),
        }
      : undefined,
    // Greedy Tap + optional unified live API proxy.
    proxy: mergeViteProxyConfig(unifiedLive, unifiedApiOrigin),
    hmr: disableHmr
      ? false
      : lanHost
        ? {
            host: lanHost,
            port: devPort,
            clientPort: devPort,
            overlay: false,
            ...(useDevHttps ? { protocol: "wss" as const } : {}),
          }
        : { overlay: false },
  },
  preview: {
    port: previewPort,
    strictPort: false,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: mergeViteProxyConfig(unifiedLive, unifiedApiOrigin),
  },
};
});
