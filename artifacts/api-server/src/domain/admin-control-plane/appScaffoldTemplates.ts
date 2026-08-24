import { listProjectApps } from "./projectRegistryService";
import { inferAppStack } from "./appStackInference";
import { appendDeployScaffoldFiles, buildDeployPipeline } from "./appDeployManifest";
import {
  buildAndroidNativeAppFiles,
  buildCapacitorAppFiles,
  buildFlutterAppFiles,
  buildIosNativeAppFiles,
  buildReactNativeAppFiles,
  type StackBuildContext,
} from "./appStackScaffoldBuilders";

export type AppTemplateKind = "standard" | "dating" | "wallet" | "dashboard" | "messages";

export type ScaffoldFileDef = {
  path: string;
  role: "code" | "config" | "pipeline" | "access" | "env" | "doc";
  description: string;
  content: string;
};

export type AppTemplateSpec = {
  kind: AppTemplateKind;
  label: string;
  features: string[];
  routes: Array<{ path: string; label: string; file: string }>;
};

const RESPONSIVE_FEATURES = [
  "Responsive — mobile, tablet, desktop layouts",
  "PWA-ready web app (installable)",
  "Platform map — web now, native shell extensible",
];

function withResponsiveFeatures(features: string[]): string[] {
  return [...features, ...RESPONSIVE_FEATURES];
}

export function inferAppTemplate(message: string): AppTemplateSpec {
  const lower = message.toLowerCase();
  if (/dating|match|swipe|romance/.test(lower)) {
    return {
      kind: "dating",
      label: "Dating app",
      features: withResponsiveFeatures(["Swipe feed", "Matches inbox", "Profile editor", "Live API health"]),
      routes: [
        { path: "/", label: "Discover", file: "DiscoverScreen" },
        { path: "/matches", label: "Matches", file: "MatchesScreen" },
        { path: "/profile", label: "Profile", file: "ProfileScreen" },
      ],
    };
  }
  if (/wallet|payment|pay|billing|stripe/.test(lower)) {
    return {
      kind: "wallet",
      label: "Wallet app",
      features: withResponsiveFeatures(["Balance card", "Transactions", "Send flow", "Settings"]),
      routes: [
        { path: "/", label: "Wallet", file: "WalletScreen" },
        { path: "/send", label: "Send", file: "SendScreen" },
        { path: "/settings", label: "Settings", file: "SettingsScreen" },
      ],
    };
  }
  if (/dashboard|admin|analytics|metrics/.test(lower)) {
    return {
      kind: "dashboard",
      label: "Dashboard app",
      features: withResponsiveFeatures(["KPI cards", "Activity feed", "Team panel", "API status"]),
      routes: [
        { path: "/", label: "Overview", file: "OverviewScreen" },
        { path: "/activity", label: "Activity", file: "ActivityScreen" },
        { path: "/settings", label: "Settings", file: "SettingsScreen" },
      ],
    };
  }
  if (/chat|message|inbox|dm/.test(lower)) {
    return {
      kind: "messages",
      label: "Messaging app",
      features: withResponsiveFeatures(["Conversation list", "Thread view", "Compose", "Profile"]),
      routes: [
        { path: "/", label: "Inbox", file: "InboxScreen" },
        { path: "/thread/:id", label: "Thread", file: "ThreadScreen" },
        { path: "/profile", label: "Profile", file: "ProfileScreen" },
      ],
    };
  }
  return {
    kind: "standard",
    label: "Standard app",
    features: withResponsiveFeatures(["Home feed", "Explore", "Profile", "Settings", "API health"]),
    routes: [
      { path: "/", label: "Home", file: "HomeScreen" },
      { path: "/explore", label: "Explore", file: "ExploreScreen" },
      { path: "/profile", label: "Profile", file: "ProfileScreen" },
    ],
  };
}

export function allocateDevPort(): number {
  const used = new Set(listProjectApps().map((a) => a.devPort).filter((p): p is number => typeof p === "number"));
  for (let port = 5174; port <= 5290; port += 1) {
    if (!used.has(port)) return port;
  }
  return 5174;
}

function screenContent(template: AppTemplateSpec, file: string, appName: string, appId: string): string {
  const screens: Record<string, string> = {
    HomeScreen: `import { useHealth } from "../hooks/useHealth";

export function HomeScreen() {
  const health = useHealth();
  return (
    <section className="screen">
      <header className="screen-head"><h1>${appName}</h1><p>Your home feed — fully runnable app.</p></header>
      <div className="card-grid">
        <article className="card"><h2>Live API</h2><p>{health.loading ? "Checking…" : health.ok ? "✓ Connected" : "Offline (start api-server)"}</p></article>
        <article className="card"><h2>App id</h2><p><code>${appId}</code></p></article>
      </div>
    </section>
  );
}`,
    ExploreScreen: `export function ExploreScreen() {
  const items = ["Design", "Media", "Live", "Wallet"];
  return (
    <section className="screen">
      <header className="screen-head"><h1>Explore</h1></header>
      <ul className="list">{items.map((i) => <li key={i} className="list-row">{i}</li>)}</ul>
    </section>
  );
}`,
    ProfileScreen: `import { useState } from "react";

export function ProfileScreen() {
  const [name, setName] = useState("You");
  return (
    <section className="screen">
      <header className="screen-head"><h1>Profile</h1></header>
      <label className="field"><span>Display name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <p className="muted">Changes are local — wire to API when ready.</p>
    </section>
  );
}`,
    DiscoverScreen: `export function DiscoverScreen() {
  const cards = ["Alex", "Jordan", "Sam", "Riley"];
  return (
    <section className="screen">
      <header className="screen-head"><h1>Discover</h1><p>Swipe-style feed scaffold</p></header>
      <div className="card-grid">{cards.map((c) => <article key={c} className="card swipe-card"><h2>{c}</h2><button type="button" className="btn primary">Like</button></article>)}</div>
    </section>
  );
}`,
    MatchesScreen: `export function MatchesScreen() {
  return (
    <section className="screen">
      <header className="screen-head"><h1>Matches</h1></header>
      <ul className="list"><li className="list-row">Alex — matched today</li><li className="list-row">Jordan — new message</li></ul>
    </section>
  );
}`,
    WalletScreen: `export function WalletScreen() {
  return (
    <section className="screen">
      <header className="screen-head"><h1>Wallet</h1></header>
      <article className="card balance"><h2>$1,248.50</h2><p className="muted">Available balance</p></article>
    </section>
  );
}`,
    SendScreen: `import { useState } from "react";

export function SendScreen() {
  const [amount, setAmount] = useState("10");
  return (
    <section className="screen">
      <header className="screen-head"><h1>Send</h1></header>
      <label className="field"><span>Amount</span><input value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <button type="button" className="btn primary">Send now</button>
    </section>
  );
}`,
    SettingsScreen: `export function SettingsScreen() {
  return (
    <section className="screen">
      <header className="screen-head"><h1>Settings</h1></header>
      <ul className="list"><li className="list-row">Notifications</li><li className="list-row">Privacy</li><li className="list-row">API keys (.env)</li></ul>
    </section>
  );
}`,
    OverviewScreen: `import { useHealth } from "../hooks/useHealth";

export function OverviewScreen() {
  const health = useHealth();
  const stats = [{ label: "Users", value: "12.4k" }, { label: "Sessions", value: "842" }, { label: "Errors", value: "3" }];
  return (
    <section className="screen">
      <header className="screen-head"><h1>Overview</h1><p>{health.ok ? "API online" : "API offline"}</p></header>
      <div className="card-grid">{stats.map((s) => <article key={s.label} className="card"><h2>{s.value}</h2><p>{s.label}</p></article>)}</div>
    </section>
  );
}`,
    ActivityScreen: `export function ActivityScreen() {
  return (
    <section className="screen">
      <header className="screen-head"><h1>Activity</h1></header>
      <ul className="list"><li className="list-row">User signed up</li><li className="list-row">Change set published</li></ul>
    </section>
  );
}`,
    InboxScreen: `export function InboxScreen() {
  const threads = [{ id: "1", name: "Alex", preview: "Hey!" }, { id: "2", name: "Team", preview: "Ship ready" }];
  return (
    <section className="screen">
      <header className="screen-head"><h1>Inbox</h1></header>
      <ul className="list">{threads.map((t) => <li key={t.id} className="list-row"><strong>{t.name}</strong><span>{t.preview}</span></li>)}</ul>
    </section>
  );
}`,
    ThreadScreen: `import { useRoute } from "wouter";

export function ThreadScreen() {
  const [, params] = useRoute("/thread/:id");
  return (
    <section className="screen">
      <header className="screen-head"><h1>Thread {params?.id}</h1></header>
      <div className="thread"><p className="bubble them">Hello!</p><p className="bubble me">Ready to build.</p></div>
    </section>
  );
}`,
  };
  return screens[file] || screens.HomeScreen;
}

export function buildReactWebAppFiles(input: {
  appId: string;
  appName: string;
  devPort: number;
  message: string;
  envExample: string;
  pipelineManifest: object;
  accessManifest: object;
  structureMap: object;
}): ScaffoldFileDef[] {
  const { appId, appName, devPort, message } = input;
  const template = inferAppTemplate(message);
  const pkgName = `@workspace/${appId}`;

  const platformsManifest = {
    appId,
    targets: [
      { id: "web", status: "ready", entry: "index.html", notes: "Vite + React — mobile, tablet, desktop" },
      { id: "pwa", status: "ready", entry: "public/manifest.webmanifest", notes: "Installable progressive web app" },
      { id: "ios", status: "extensible", wrapper: "capacitor", notes: "Reuse src/ — add Capacitor iOS shell" },
      { id: "android", status: "extensible", wrapper: "capacitor", notes: "Reuse src/ — add Capacitor Android shell" },
      { id: "desktop", status: "extensible", wrapper: "electron-or-tauri", notes: "Optional desktop shell" },
    ],
  };

  const responsiveManifest = {
    breakpoints: [
      { id: "mobile", minWidth: 0, maxWidth: 767, layout: "bottom-tabs", columns: 1, preview: "390×844" },
      { id: "tablet", minWidth: 768, maxWidth: 1023, layout: "bottom-tabs-wide", columns: 2, preview: "768×1024" },
      { id: "desktop", minWidth: 1024, maxWidth: null, layout: "sidebar", columns: 3, preview: "1280×800" },
    ],
    fluid: true,
    safeArea: "env(safe-area-inset-*)",
    minTouchTarget: "44px",
  };

  const routeImports = template.routes
    .map((r) => `import { ${r.file} } from "./routes/${r.file}";`)
    .join("\n");
  const routeSwitch = template.routes
    .map((r) => `        <Route path="${r.path}" component={${r.file}} />`)
    .join("\n");
  const navLinks = template.routes
    .map((r) => `        <Link href="${r.path}" className={loc === "${r.path}" ? "tab active" : "tab"}>${r.label}</Link>`)
    .join("\n");

  const files: ScaffoldFileDef[] = [
    {
      path: "README.md",
      role: "doc",
      description: "Run instructions and structure map",
      content: `# ${appName}

Fully functioning **${template.label}** — generated by the dev workspace agent.

## Run locally

\`\`\`bash
pnpm install
pnpm --filter ${pkgName} dev
\`\`\`

Open http://127.0.0.1:${devPort}

## Features

${template.features.map((f) => `- ${f}`).join("\n")}

## Pipeline

See \`pipeline/manifest.json\` — dev → typecheck → build → deploy

## Access

See \`access/manifest.json\` — viewer / editor / publisher roles

## Environment

Copy \`.env.example\` → \`.env.local\`
`,
    },
    {
      path: "structure.map.json",
      role: "config",
      description: "Machine-readable folder map",
      content: `${JSON.stringify({ ...input.structureMap, template: template.kind, features: template.features, devPort }, null, 2)}\n`,
    },
    { path: ".env.example", role: "env", description: "Environment template", content: input.envExample },
    {
      path: ".gitignore",
      role: "config",
      description: "Git ignore rules",
      content: "node_modules\ndist\n.env.local\n.tsbuildinfo\n",
    },
    {
      path: "package.json",
      role: "config",
      description: "Package manifest — runnable scripts",
      content: `${JSON.stringify(
        {
          name: pkgName,
          version: "0.0.0",
          private: true,
          type: "module",
          scripts: {
            dev: `vite --config vite.config.ts --port ${devPort} --host 0.0.0.0`,
            build: "vite build --config vite.config.ts",
            typecheck: "tsc -p tsconfig.json --noEmit",
            preview: `vite preview --config vite.config.ts --port ${devPort}`,
          },
          dependencies: {
            "@tanstack/react-query": "catalog:",
            "lucide-react": "catalog:",
            react: "catalog:",
            "react-dom": "catalog:",
            wouter: "catalog:",
          },
          devDependencies: {
            "@tailwindcss/vite": "catalog:",
            "@types/react": "catalog:",
            "@types/react-dom": "catalog:",
            "@vitejs/plugin-react": "catalog:",
            tailwindcss: "catalog:",
            typescript: "~5.9.3",
            vite: "catalog:",
          },
        },
        null,
        2,
      )}\n`,
    },
    {
      path: "tsconfig.json",
      role: "config",
      description: "TypeScript config",
      content: `${JSON.stringify(
        {
          extends: "../../tsconfig.base.json",
          include: ["src/**/*"],
          exclude: ["node_modules", "dist"],
          compilerOptions: {
            incremental: true,
            tsBuildInfoFile: ".tsbuildinfo",
            noEmit: true,
            lib: ["es2022", "dom", "dom.iterable"],
            jsx: "react-jsx",
            types: ["vite/client"],
            allowImportingTsExtensions: true,
          },
        },
        null,
        2,
      )}\n`,
    },
    {
      path: "vite.config.ts",
      role: "code",
      description: "Vite + API proxy",
      content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: ${devPort},
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://127.0.0.1:5001",
        changeOrigin: true,
      },
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
`,
    },
    {
      path: "index.html",
      role: "code",
      description: "HTML shell",
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#070b14" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <title>${appName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      path: "public/manifest.webmanifest",
      role: "config",
      description: "PWA manifest — installable on mobile/desktop",
      content: `${JSON.stringify(
        {
          name: appName,
          short_name: appName.slice(0, 12),
          start_url: "/",
          display: "standalone",
          background_color: "#070b14",
          theme_color: "#070b14",
          orientation: "any",
          icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
        },
        null,
        2,
      )}\n`,
    },
    {
      path: "public/icon.svg",
      role: "config",
      description: "App icon (SVG — scales all sizes)",
      content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#6ea8ff"/><text x="64" y="78" text-anchor="middle" font-size="48" font-family="system-ui" fill="#041024">${appName.charAt(0).toUpperCase()}</text></svg>\n`,
    },
    {
      path: "config/platforms.manifest.json",
      role: "config",
      description: "Platform targets — web, PWA, native extensible",
      content: `${JSON.stringify(platformsManifest, null, 2)}\n`,
    },
    {
      path: "config/responsive.manifest.json",
      role: "config",
      description: "Breakpoints — mobile, tablet, desktop",
      content: `${JSON.stringify(responsiveManifest, null, 2)}\n`,
    },
    {
      path: "config/capacitor.stub.json",
      role: "config",
      description: "Native shell stub — Capacitor iOS/Android extensible",
      content: `${JSON.stringify(
        {
          appId,
          note: "Add @capacitor/core + npx cap init to wrap this web app for iOS/Android",
          webDir: "dist",
          server: { androidScheme: "https" },
        },
        null,
        2,
      )}\n`,
    },
    {
      path: "src/main.tsx",
      role: "code",
      description: "React bootstrap",
      content: `import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </ErrorBoundary>,
);
`,
    },
    {
      path: "src/App.tsx",
      role: "code",
      description: "Router + layout shell",
      content: `import { Route, Switch, useLocation } from "wouter";
import { AppLayout } from "./components/AppLayout";
${routeImports}

export function App() {
  const [loc] = useLocation();
  return (
    <AppLayout activePath={loc}>
      <Switch>
${routeSwitch}
        <Route>404 — not found</Route>
      </Switch>
    </AppLayout>
  );
}
`,
    },
    {
      path: "src/index.css",
      role: "code",
      description: "Tailwind + app styles",
      content: `@import "tailwindcss";

:root {
  color-scheme: dark;
  --bg: #070b14;
  --card: #10182a;
  --line: #1e2a44;
  --text: #e8eeff;
  --muted: #8b9bc0;
  --accent: #6ea8ff;
  --shell-max: 100%;
  --nav-height: 56px;
  --sidebar-width: 220px;
  --content-cols: 1;
}

* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}

/* Mobile-first shell */
.app-shell {
  min-height: 100dvh;
  width: 100%;
  max-width: var(--shell-max);
  margin: 0 auto;
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: 1fr;
  grid-template-areas: "header" "main" "tabs";
}
.app-sidebar { display: none; grid-area: sidebar; }
.app-top { grid-area: header; padding: 12px 16px; border-bottom: 1px solid var(--line); font-weight: 600; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.app-main { grid-area: main; padding: 12px 16px calc(var(--nav-height) + 16px); min-width: 0; }
.app-tabs {
  grid-area: tabs;
  position: sticky;
  bottom: 0;
  display: flex;
  gap: 4px;
  padding: 8px;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
  background: #0b1020ee;
  backdrop-filter: blur(8px);
  border-top: 1px solid var(--line);
}
.tab {
  flex: 1;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--muted);
  text-decoration: none;
  font-size: 12px;
  padding: 8px 4px;
}
.tab.active { background: var(--card); color: var(--accent); font-weight: 600; }
.sidebar-link {
  display: block;
  padding: 10px 14px;
  min-height: 44px;
  border-radius: 8px;
  color: var(--muted);
  text-decoration: none;
  font-size: 13px;
}
.sidebar-link.active { background: var(--card); color: var(--accent); font-weight: 600; }
.device-badge {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 2px 8px;
}

/* Tablet */
@media (min-width: 768px) {
  :root { --shell-max: 768px; --content-cols: 2; }
  .app-main { padding: 16px 24px calc(var(--nav-height) + 20px); }
  .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* Desktop — sidebar layout */
@media (min-width: 1024px) {
  :root { --shell-max: 1280px; --content-cols: 3; --nav-height: 0px; }
  .app-shell {
    grid-template-columns: var(--sidebar-width) 1fr;
    grid-template-rows: auto 1fr;
    grid-template-areas: "sidebar header" "sidebar main";
  }
  .app-sidebar {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px 12px;
    border-right: 1px solid var(--line);
    background: #0b1020;
  }
  .app-tabs { display: none; }
  .app-main { padding: 20px 28px 28px; }
  .card-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

.screen-head h1 { margin: 0 0 4px; font-size: clamp(20px, 2.5vw, 28px); }
.screen-head p { margin: 0 0 12px; color: var(--muted); font-size: 13px; }
.card-grid { display: grid; gap: 10px; grid-template-columns: repeat(var(--content-cols, 1), minmax(0, 1fr)); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px; min-width: 0; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.list-row { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px; display: flex; justify-content: space-between; gap: 8px; min-height: 44px; align-items: center; }
.field { display: grid; gap: 6px; margin: 12px 0; max-width: 480px; }
.field input { padding: 12px 14px; min-height: 44px; border-radius: 8px; border: 1px solid var(--line); background: #0b1020; color: var(--text); font-size: 16px; }
.btn { border: 0; border-radius: 8px; padding: 12px 16px; min-height: 44px; cursor: pointer; font-size: 14px; }
.btn.primary { background: var(--accent); color: #041024; font-weight: 600; }
.muted { color: var(--muted); font-size: 12px; }
.balance h2 { margin: 0; font-size: clamp(24px, 4vw, 36px); }
.thread { display: grid; gap: 8px; max-width: 640px; }
.bubble { max-width: min(80%, 420px); padding: 10px 12px; border-radius: 12px; margin: 0; }
.bubble.them { background: var(--card); }
.bubble.me { background: #1a3058; justify-self: end; }
.swipe-card { display: flex; flex-direction: column; gap: 10px; }
`,
    },
    {
      path: "src/lib/env.ts",
      role: "code",
      description: "Typed env loader",
      content: `export const env = {
  apiUrl: import.meta.env.VITE_API_URL || "",
  appOrigin: import.meta.env.VITE_APP_ORIGIN || \`http://127.0.0.1:${devPort}\`,
  appId: "${appId}",
} as const;
`,
    },
    {
      path: "src/lib/api.ts",
      role: "code",
      description: "API client",
      content: `import { env } from "./env";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(\`/api\${path.startsWith("/") ? path : \`/\${path}\`}\`);
  if (!res.ok) throw new Error(\`API \${res.status}\`);
  return res.json() as Promise<T>;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/health");
    return res.ok;
  } catch {
    return false;
  }
}

export const appMeta = { id: env.appId, name: "${appName}" };
`,
    },
    {
      path: "src/hooks/useHealth.ts",
      role: "code",
      description: "Live API health hook",
      content: `import { useQuery } from "@tanstack/react-query";
import { checkApiHealth } from "../lib/api";

export function useHealth() {
  const q = useQuery({ queryKey: ["health"], queryFn: checkApiHealth, retry: false, staleTime: 30_000 });
  return { ok: Boolean(q.data), loading: q.isLoading, error: q.error };
}
`,
    },
    {
      path: "src/components/ErrorBoundary.tsx",
      role: "code",
      description: "Runtime error boundary",
      content: `import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info); }
  render() {
    if (this.state.error) {
      return <pre style={{ padding: 16, color: "#f0a0a0" }}>{this.state.error.message}</pre>;
    }
    return this.props.children;
  }
}
`,
    },
    {
      path: "src/hooks/useViewport.ts",
      role: "code",
      description: "Device class — mobile, tablet, desktop",
      content: `import { useEffect, useState } from "react";

export type ViewportClass = "mobile" | "tablet" | "desktop";

function classify(width: number): ViewportClass {
  if (width >= 1024) return "desktop";
  if (width >= 768) return "tablet";
  return "mobile";
}

export function useViewport(): ViewportClass {
  const [vp, setVp] = useState<ViewportClass>(() => classify(window.innerWidth));
  useEffect(() => {
    const onResize = () => setVp(classify(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return vp;
}
`,
    },
    {
      path: "src/components/DeviceBadge.tsx",
      role: "code",
      description: "Shows current responsive breakpoint",
      content: `import { useViewport } from "../hooks/useViewport";

export function DeviceBadge() {
  const vp = useViewport();
  return <span className="device-badge" data-viewport={vp}>{vp}</span>;
}
`,
    },
    {
      path: "src/components/AppLayout.tsx",
      role: "code",
      description: "Responsive shell — bottom tabs mobile/tablet, sidebar desktop",
      content: `import type { ReactNode } from "react";
import { Link } from "wouter";
import { DeviceBadge } from "./DeviceBadge";

type Props = { children: ReactNode; activePath: string };

const routes = ${JSON.stringify(template.routes)};

function isActive(activePath: string, path: string) {
  if (path === "/") return activePath === "/";
  return activePath === path || activePath.startsWith(path + "/");
}

export function AppLayout({ children, activePath }: Props) {
  return (
    <div className="app-shell" data-app-id="${appId}">
      <aside className="app-sidebar" aria-label="Sidebar">
        <strong style={{ padding: "8px 14px", marginBottom: 8 }}>${appName}</strong>
        {routes.map((r) => (
          <Link key={r.path} href={r.path} className={isActive(activePath, r.path) ? "sidebar-link active" : "sidebar-link"}>
            {r.label}
          </Link>
        ))}
      </aside>
      <header className="app-top">
        <span>${appName}</span>
        <DeviceBadge />
      </header>
      <main className="app-main">{children}</main>
      <nav className="app-tabs" aria-label="Main">
        {routes.map((r) => (
          <Link key={r.path} href={r.path} className={isActive(activePath, r.path) ? "tab active" : "tab"}>
            {r.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
`,
    },
    {
      path: "pipeline/manifest.json",
      role: "pipeline",
      description: "CI/CD pipeline stages",
      content: `${JSON.stringify(input.pipelineManifest, null, 2)}\n`,
    },
    {
      path: "access/manifest.json",
      role: "access",
      description: "Roles and permissions",
      content: `${JSON.stringify(input.accessManifest, null, 2)}\n`,
    },
    {
      path: "config/app.manifest.json",
      role: "config",
      description: "App metadata",
      content: `${JSON.stringify({ id: appId, name: appName, template: template.kind, devPort, routes: template.routes, platforms: platformsManifest.targets.map((t) => t.id), responsive: responsiveManifest.breakpoints.map((b) => b.id) }, null, 2)}\n`,
    },
  ];

  for (const route of template.routes) {
    files.push({
      path: `src/routes/${route.file}.tsx`,
      role: "code",
      description: `${route.label} screen`,
      content: `${screenContent(template, route.file, appName, appId)}\n`,
    });
  }

  return files;
}

export function buildAppFiles(input: {
  appId: string;
  appName: string;
  devPort: number;
  message: string;
  envExample: string;
  pipelineManifest: object;
  accessManifest: object;
  structureMap: object;
}): ScaffoldFileDef[] {
  const stack = inferAppStack(input.message);
  const template = inferAppTemplate(input.message);
  const ctx: StackBuildContext = { ...input, template, stack };
  const pkgName = `@workspace/${input.appId}`;
  const { manifest } = buildDeployPipeline({ appId: input.appId, appName: input.appName, stack: stack.stack, pkgName });

  let files: ScaffoldFileDef[];
  switch (stack.stack) {
    case "react-native":
      files = buildReactNativeAppFiles(ctx);
      break;
    case "flutter":
      files = buildFlutterAppFiles(ctx);
      break;
    case "ios-native":
      files = buildIosNativeAppFiles(ctx);
      break;
    case "android-native":
      files = buildAndroidNativeAppFiles(ctx);
      break;
    case "capacitor":
      files = buildCapacitorAppFiles(ctx, buildReactWebAppFiles(input));
      break;
    default:
      files = buildReactWebAppFiles(input);
  }

  return appendDeployScaffoldFiles(files, {
    appId: input.appId,
    appName: input.appName,
    stack: stack.stack,
    pkgName,
    manifest,
  });
}

/** @deprecated use buildAppFiles */
export function buildFullAppFiles(input: Parameters<typeof buildAppFiles>[0]): ScaffoldFileDef[] {
  return buildAppFiles(input);
}
