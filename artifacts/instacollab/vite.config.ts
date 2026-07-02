import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import fs from "node:fs";
import os from "node:os";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";
import { uxSignalIngestPlugin } from "./vite-plugins/uxSignalIngest";

const appRoot = path.resolve(import.meta.dirname);
const workspaceRoot = path.resolve(import.meta.dirname, "../..");
const legacyEnvRoot = path.resolve(
  workspaceRoot,
  "attached_assets/extracted/remix_-instacollab",
);

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

/** Merge VITE_* (and GEMINI) from every known env location; app `.env` wins over root/legacy. */
function loadMergedViteEnv(mode: string): Record<string, string> {
  let merged: Record<string, string> = {};
  for (const dir of [...envSourceDirs].reverse()) {
    if (!fs.existsSync(dir)) continue;
    merged = { ...merged, ...loadEnv(mode, dir, "VITE_") };
    const all = loadEnv(mode, dir, "");
    if (all.GEMINI_API_KEY?.trim()) {
      merged.VITE_GEMINI_API_KEY = all.GEMINI_API_KEY.trim();
    }
  }
  return merged;
}

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

export default defineConfig(({ mode }) => {
  const viteEnv = loadMergedViteEnv(mode);
  const unifiedLive =
    viteEnv.VITE_UNIFIED_LIVE === "true" ||
    process.env.VITE_UNIFIED_LIVE === "true";
  const unifiedApiOrigin =
    (viteEnv.VITE_UNIFIED_LIVE_API || process.env.VITE_UNIFIED_LIVE_API || "https://app.uniapplab.com")
      .replace(/\/$/, "");
  const envDefine = Object.fromEntries(
    Object.entries(viteEnv).map(([key, val]) => [
      `import.meta.env.${key}`,
      JSON.stringify(val),
    ]),
  );

  return {
  base: basePath,
  envDir,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(useDevHttps ? [basicSsl()] : []),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "pwa-icon.svg", "robots.txt", "opengraph.jpg"],
      devOptions: {
        enabled: pwaDevEnabled,
      },
      workbox: {
        skipWaiting: false,
        clientsClaim: false,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: `${normalizedBase}index.html`,
        navigateFallbackDenylist: [/^\/api\//, /\/__local_game__\//, /^\/assets\//],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}"],
      },
      manifest: {
        id: normalizedBase,
        name: "InstaCollab",
        short_name: "InstaCollab",
        description: "Create, connect, and collaborate in real time.",
        theme_color: "#020617",
        background_color: "#020617",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone", "browser"],
        orientation: "portrait-primary",
        scope: basePath,
        start_url: normalizedBase,
        categories: ["social", "entertainment"],
        icons: [
          {
            src: `${normalizedBase}pwa-icon.svg`,
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: `${normalizedBase}pwa-icon.svg`,
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
          {
            src: `${normalizedBase}favicon.svg`,
            sizes: "180x180",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
    }),
    ...replitPlugins,
    uxSignalIngestPlugin(workspaceRoot),
  ],
  define: {
    ...envDefine,
    "process.env.GEMINI_API_KEY": JSON.stringify(
      viteEnv.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "",
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    exclude: ["deepar"],
  },
  assetsInclude: ['**/*.wasm', '**/*.bin', '**/*.deepar'],
  root: appRoot,
  build: {
    outDir: path.resolve(appRoot, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('deepar')) return 'vendor-deepar';
          if (id.includes('motion')) return 'vendor-motion';
          if (id.includes('recharts')) return 'vendor-charts';
          if (id.includes('firebase')) return 'vendor-firebase';
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
    proxy: {
      "/api": {
        target: unifiedLive
          ? unifiedApiOrigin
          : (process.env.VITE_API_PROXY ?? "http://127.0.0.1:3000"),
        changeOrigin: true,
        secure: unifiedLive,
      },
    },
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
  },
};
});
