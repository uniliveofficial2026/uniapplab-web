import React, { useMemo } from 'react';
import { isIosDevice, isPrivateDevHost } from '../../lib/pwaRegister';

export function MobileDevConnectBanner() {
  const hint = useMemo(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return null;
    const { hostname, protocol, port } = window.location;
    if (!isPrivateDevHost(hostname)) return null;

    const devPort = port || '5173';
    const httpUrl = `http://${hostname}:${devPort}/`;
    const onHttps = protocol === 'https:';

    if (onHttps && isIosDevice()) {
      return {
        title: 'iPhone/iPad — live dev (HTTPS)',
        body: `Accept the certificate warning, then edits on your Mac reload here. If Safari drops the connection, use HTTP on port 5173 instead.`,
        url: httpUrl,
      };
    }

    if (onHttps) {
      return {
        title: 'Live dev on mobile (HTTPS)',
        body: `Code changes hot-reload on this device. Same Wi‑Fi required. HTTP fallback: ${httpUrl}`,
        url: httpUrl,
      };
    }

    return null;
  }, []);

  if (!hint) return null;

  return (
    <div className="fixed left-3 right-3 top-[calc(8px+env(safe-area-inset-top))] z-[130] md:left-auto md:right-4 md:max-w-md">
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-foreground shadow-lg backdrop-blur-md">
        <p className="font-bold text-amber-200">{hint.title}</p>
        <p className="mt-1 leading-relaxed text-foreground/90">{hint.body}</p>
        <a
          href={hint.url}
          className="mt-2 inline-block font-semibold text-primary underline underline-offset-2"
        >
          Open HTTP dev URL
        </a>
      </div>
    </div>
  );
}
