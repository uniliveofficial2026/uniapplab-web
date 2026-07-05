/** Committed at build time — used when /firebase-config.json is missing on the CDN. */
import bundledFirebaseConfig from '../../../public/firebase-config.json';

export type RuntimeFirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL?: string;
  measurementId?: string;
};

let runtime: RuntimeFirebaseConfig | null = null;
let networkRefreshStarted = false;

function isUsableConfig(value: unknown): value is RuntimeFirebaseConfig {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  const apiKey = String(row.apiKey || '').trim();
  const authDomain = String(row.authDomain || '').trim();
  const projectId = String(row.projectId || '').trim();
  const appId = String(row.appId || '').trim();
  if (!apiKey || !authDomain || !projectId || !appId) return false;
  if (/your[_-]?firebase/i.test(apiKey + authDomain + projectId)) return false;
  return true;
}

function applyConfig(data: RuntimeFirebaseConfig): void {
  runtime = {
    apiKey: data.apiKey.trim(),
    authDomain: data.authDomain.trim(),
    projectId: data.projectId.trim(),
    storageBucket: String(data.storageBucket || '').trim(),
    messagingSenderId: String(data.messagingSenderId || '').trim(),
    appId: data.appId.trim(),
    ...(data.databaseURL ? { databaseURL: data.databaseURL.trim() } : {}),
    ...(data.measurementId ? { measurementId: data.measurementId.trim() } : {}),
  };
}

export function ensureBundledFirebaseConfig(): void {
  if (runtime) return;
  if (isUsableConfig(bundledFirebaseConfig)) {
    applyConfig(bundledFirebaseConfig);
  }
}

export async function loadRuntimeFirebaseConfig(): Promise<void> {
  ensureBundledFirebaseConfig();
  if (networkRefreshStarted || typeof window === 'undefined') return;
  networkRefreshStarted = true;

  void (async () => {
    try {
      const res = await fetch('/firebase-config.json', { cache: 'no-store' });
      if (!res.ok) return;
      const data: unknown = await res.json();
      if (!isUsableConfig(data)) return;
      const next = {
        apiKey: data.apiKey.trim(),
        authDomain: data.authDomain.trim(),
        projectId: data.projectId.trim(),
        storageBucket: String(data.storageBucket || '').trim(),
        messagingSenderId: String(data.messagingSenderId || '').trim(),
        appId: data.appId.trim(),
        databaseURL: data.databaseURL?.trim(),
        measurementId: data.measurementId?.trim(),
      };
      if (
        runtime &&
        runtime.apiKey === next.apiKey &&
        runtime.projectId === next.projectId &&
        runtime.appId === next.appId
      ) {
        return;
      }
      applyConfig(data);
    } catch {
      /* keep bundled / env config */
    }
  })();
}

export function getRuntimeFirebaseConfig(): RuntimeFirebaseConfig | null {
  return runtime;
}

export function clearRuntimeFirebaseConfigForTests(): void {
  runtime = null;
  networkRefreshStarted = false;
}
