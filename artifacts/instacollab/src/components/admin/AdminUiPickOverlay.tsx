import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Tab } from '../../types';
import { isAdminMirrorFollower } from '../../lib/adminMirrorRole';
import {
  ADMIN_UI_PICK_HIGHLIGHT,
  ADMIN_UI_PICK_NAVIGATE,
  ADMIN_UI_PICK_PING,
  ADMIN_UI_PICK_READY,
  ADMIN_UI_PICK_SELECTED,
  ADMIN_UI_PICK_SET_ENABLED,
  ADMIN_UI_PICK_SNAPSHOT,
  ADMIN_UI_PICK_SNAPSHOT_REQUEST,
  ADMIN_UI_DEBUG_LOG,
  isAdminPanelMessage,
  resolveAdminPanelOrigin,
  type AdminUiPickNavigate,
  type AdminUiPickSelection,
} from '../../lib/adminUiPickProtocol';
import { capturePickPreview } from '../../lib/adminUiPickPreview';
import { resolvePickTarget, selectorForPick } from '../../lib/adminUiPickResolver';
import './admin-embed-app.css';

type HighlightBox = {
  top: number;
  left: number;
  width: number;
  height: number;
  label: string;
};

type AdminUiPickOverlayProps = {
  enabled: boolean;
  mode?: 'embed' | 'studio';
  onSelect?: (pick: AdminUiPickSelection) => void;
};

function dispatchNavigate(detail: AdminUiPickNavigate): void {
  window.dispatchEvent(new CustomEvent('admin-ui-navigate', { detail }));
}

function isMirrorFollower(): boolean {
  return isAdminMirrorFollower();
}

export function AdminUiPickOverlay({ enabled, mode = 'embed', onSelect }: AdminUiPickOverlayProps) {
  const [armed, setArmed] = useState(enabled && !isMirrorFollower());
  const [hoverBox, setHoverBox] = useState<HighlightBox | null>(null);
  const [selectedBox, setSelectedBox] = useState<HighlightBox | null>(null);
  const parentOriginRef = useRef<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const captureInflightRef = useRef(false);

  useEffect(() => {
    // Mirror iframe is display-only — never arm pick UI there.
    if (isMirrorFollower()) {
      setArmed(false);
      setHoverBox(null);
      setSelectedBox(null);
      return;
    }
    setArmed(enabled);
    if (!enabled) {
      setHoverBox(null);
      setSelectedBox(null);
    }
  }, [enabled]);

  const postToParent = useCallback((type: string, payload?: unknown) => {
    if (!window.parent || window.parent === window) return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = resolveAdminPanelOrigin(params.get('adminOrigin'));
    const target = parentOriginRef.current || fromQuery || '*';
    try {
      window.parent.postMessage({ type, payload }, target);
    } catch {
      try {
        window.parent.postMessage({ type, payload }, '*');
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (isMirrorFollower()) return undefined;
    const forward = (level: 'log' | 'info' | 'warn' | 'error', args: unknown[]) => {
      const message = args
        .map((a) => {
          if (typeof a === 'string') return a;
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(' ');
      postToParent(ADMIN_UI_DEBUG_LOG, { level, message, at: new Date().toISOString(), source: 'console' });
    };
    const orig = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };
    console.log = (...args: unknown[]) => {
      forward('log', args);
      orig.log(...args);
    };
    console.info = (...args: unknown[]) => {
      forward('info', args);
      orig.info(...args);
    };
    console.warn = (...args: unknown[]) => {
      forward('warn', args);
      orig.warn(...args);
    };
    console.error = (...args: unknown[]) => {
      forward('error', args);
      orig.error(...args);
    };
    const onError = (event: ErrorEvent) => {
      forward('error', [event.message, event.filename, event.lineno]);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      forward('error', [String(event.reason)]);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      console.log = orig.log;
      console.info = orig.info;
      console.warn = orig.warn;
      console.error = orig.error;
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [postToParent]);

  const elementUnderPoint = useCallback((clientX: number, clientY: number): Element | null => {
    const overlay = overlayRef.current;
    if (!overlay) return null;
    overlay.style.pointerEvents = 'none';
    const el = document.elementFromPoint(clientX, clientY);
    overlay.style.pointerEvents = armed ? 'auto' : 'none';
    return el;
  }, [armed]);

  const highlightElement = useCallback((el: Element, label: string, selected = false) => {
    const rect = el.getBoundingClientRect();
    const box = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      label,
    };
    if (selected) setSelectedBox(box);
    else setHoverBox(box);
  }, []);

  const emitSelection = useCallback(
    (pick: AdminUiPickSelection, el: Element | null) => {
      setSelectedBox({
        top: pick.rect.top,
        left: pick.rect.left,
        width: pick.rect.width,
        height: pick.rect.height,
        label: pick.label,
      });
      onSelect?.(pick);
      if (mode === 'embed') {
        postToParent(ADMIN_UI_PICK_SELECTED, {
          ...pick,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        });
      }
      if (mode === 'embed' && el) {
        void capturePickPreview(el, pick).then((snap) => {
          if (snap) postToParent(ADMIN_UI_PICK_SNAPSHOT, snap);
        });
      }
    },
    [mode, onSelect, postToParent],
  );

  useEffect(() => {
    document.documentElement.classList.toggle('admin-ui-pick-active', armed);
    document.body.classList.toggle('admin-ui-pick-active', armed);

    const params = new URLSearchParams(window.location.search);
    parentOriginRef.current = resolveAdminPanelOrigin(params.get('adminOrigin')) ?? window.location.origin;

    if (mode === 'embed' && !isMirrorFollower()) {
      postToParent(ADMIN_UI_PICK_READY, {
        tab: params.get('appTab') || 'home',
        url: window.location.href,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
    }

    return () => {
      document.documentElement.classList.remove('admin-ui-pick-active');
      document.body.classList.remove('admin-ui-pick-active');
    };
  }, [armed, mode, postToParent]);

  useEffect(() => {
    if (mode !== 'embed') return undefined;

    const onMessage = (event: MessageEvent) => {
      if (!isAdminPanelMessage(event)) return;
      const data = event.data as { type?: string; payload?: unknown } | null;
      if (!data?.type) return;

      if (data.type === ADMIN_UI_PICK_PING) {
        parentOriginRef.current = event.origin;
        if (!isMirrorFollower()) {
          postToParent(ADMIN_UI_PICK_READY, {
            tab: '',
            url: window.location.href,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
          });
        }
        return;
      }

      if (data.type === ADMIN_UI_PICK_SET_ENABLED) {
        if (isMirrorFollower()) return;
        const next = Boolean((data.payload as { enabled?: boolean } | undefined)?.enabled);
        setArmed(next);
        if (!next) {
          setHoverBox(null);
          setSelectedBox(null);
        }
        return;
      }

      if (data.type === ADMIN_UI_PICK_NAVIGATE) {
        dispatchNavigate((data.payload || {}) as AdminUiPickNavigate);
        return;
      }

      if (data.type === ADMIN_UI_PICK_SNAPSHOT_REQUEST) {
        if (isMirrorFollower()) return;
        parentOriginRef.current = event.origin;
        const req = (data.payload || {}) as { mode?: string; pick?: AdminUiPickSelection };
        if (req.mode !== 'selection' || !req.pick) return;
        if (captureInflightRef.current) return;
        captureInflightRef.current = true;
        void (async () => {
          try {
            const selector = selectorForPick(req.pick!);
            const el = selector ? document.querySelector(selector) : null;
            const target = el || document.elementFromPoint(req.pick!.rect.left + 2, req.pick!.rect.top + 2);
            if (target instanceof Element) {
              const snap = await capturePickPreview(target, req.pick!);
              if (snap) postToParent(ADMIN_UI_PICK_SNAPSHOT, snap);
            }
          } finally {
            captureInflightRef.current = false;
          }
        })();
        return;
      }

      if (data.type === ADMIN_UI_PICK_HIGHLIGHT) {
        if (isMirrorFollower()) return;
        const pick = data.payload as AdminUiPickSelection | undefined;
        if (!pick) return;
        const selector = selectorForPick(pick);
        const el = selector ? document.querySelector(selector) : null;
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          highlightElement(el, pick.label, true);
        }
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [highlightElement, mode, postToParent]);

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<AdminUiPickNavigate & { tab?: Tab }>).detail;
      if (!detail) return;
      const tab = (detail.tab || detail.appTab) as Tab | undefined;
      if (tab) {
        window.dispatchEvent(
          new CustomEvent('admin-ui-set-tab', {
            detail: {
              tab,
              profileUserId: detail.profileUserId ?? null,
              chatId: detail.chatId ?? null,
              roomsPath: detail.roomsPath ?? undefined,
            },
          }),
        );
      }
    };

    window.addEventListener('admin-ui-navigate', onNavigate);
    return () => window.removeEventListener('admin-ui-navigate', onNavigate);
  }, []);

  useEffect(() => {
    if (!armed) return undefined;

    const onMove = (event: MouseEvent) => {
      const el = elementUnderPoint(event.clientX, event.clientY);
      const pick = resolvePickTarget(el);
      if (!pick) {
        setHoverBox(null);
        return;
      }
      setHoverBox({
        top: pick.rect.top,
        left: pick.rect.left,
        width: pick.rect.width,
        height: pick.rect.height,
        label: pick.label,
      });
    };

    const onClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const el = elementUnderPoint(event.clientX, event.clientY);
      const pick = resolvePickTarget(el);
      if (pick) emitSelection(pick, el);
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('click', onClick, true);
    };
  }, [armed, elementUnderPoint, emitSelection]);

  if (isMirrorFollower()) {
    return <div className="admin-ui-pick-overlay is-mirror" data-admin-ui-pick-overlay="" aria-hidden />;
  }

  if (!armed && mode === 'studio') return null;

  const renderBox = (box: HighlightBox, kind: 'hover' | 'selected') => (
    <div
      key={kind}
      className={`admin-ui-pick-box admin-ui-pick-box--${kind}`}
      style={{
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
      }}
    >
      <span className="admin-ui-pick-label">{box.label}</span>
    </div>
  );

  return (
    <div
      ref={overlayRef}
      className={`admin-ui-pick-overlay${armed ? '' : ' is-idle'}`}
      data-admin-ui-pick-overlay=""
      style={armed ? undefined : { pointerEvents: 'none' }}
    >
      {armed && hoverBox ? renderBox(hoverBox, 'hover') : null}
      {armed && selectedBox ? renderBox(selectedBox, 'selected') : null}
      {armed ? (
        <div className="admin-ui-pick-banner">
          Select on — click any button, icon, text, container, or detail
        </div>
      ) : null}
    </div>
  );
}
