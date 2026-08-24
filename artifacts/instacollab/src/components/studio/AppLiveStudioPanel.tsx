import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminUiPickSelection } from '../../lib/adminUiPickProtocol';
import {
  resolveStudioResource,
  studioCreateDraft,
  studioResourceDetail,
  studioUploadMedia,
  type StudioResourceDetail,
} from '../../lib/appStudioApi';
import { appBasePath } from '../../lib/appShellRoutes';

type AppLiveStudioPanelProps = {
  pick: AdminUiPickSelection | null;
  pickEnabled: boolean;
  onPickEnabledChange: (enabled: boolean) => void;
};

export function AppLiveStudioPanel({ pick, pickEnabled, onPickEnabledChange }: AppLiveStudioPanelProps) {
  const [detail, setDetail] = useState<StudioResourceDetail | null>(null);
  const [hits, setHits] = useState<Array<{ resourceId: string; name: string; type: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pick) {
      setDetail(null);
      setHits([]);
      return;
    }
    let cancelled = false;
    setBusy(true);
    setMsg('');
    void resolveStudioResource(pick)
      .then((res) => {
        if (cancelled) return;
        setDetail(res.detail);
        setHits(res.hits);
        setMsg(res.detail ? 'Matched catalog resource' : 'Pick a catalog link below or upload a replacement');
      })
      .catch((e) => {
        if (!cancelled) setMsg(String(e));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pick]);

  const loadResource = useCallback(async (resourceId: string) => {
    setBusy(true);
    setMsg('');
    try {
      const next = await studioResourceDetail(resourceId);
      setDetail(next);
      setHits([]);
      setMsg(`Loaded ${resourceId}`);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const onMediaFile = async (file: File) => {
    setBusy(true);
    setMsg('');
    try {
      const assetId = detail?.resourceId ? `asset.${detail.resourceId}` : undefined;
      const rec = await studioUploadMedia(file, assetId);
      setMsg(`✓ Uploaded ${file.name}${rec.publicUrl ? '' : ' (local)'}`);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  const exitHref = `${appBasePath()}/?force_demo=1&launch=main`;

  return (
    <aside className="app-live-studio-panel" data-app-live-studio-panel="">
      <header className="app-live-studio-panel-head">
        <div>
          <strong>Live editor</strong>
          <p>Your real UniLive’s app — click any piece to replace it</p>
        </div>
        <a className="app-live-studio-exit" href={exitHref}>
          Exit
        </a>
      </header>

      <div className="app-live-studio-toolbar">
        <button
          type="button"
          className={pickEnabled ? 'active' : ''}
          onClick={() => onPickEnabledChange(!pickEnabled)}
        >
          {pickEnabled ? 'Pick mode on' : 'Pick mode off'}
        </button>
        <span className="app-live-studio-hint">Navigate anywhere — Feed, Live, Wallet, rooms — then pick</span>
      </div>

      {msg ? <p className={`app-live-studio-msg${msg.startsWith('✓') ? ' ok' : ''}`}>{msg}</p> : null}

      {pick ? (
        <section className="app-live-studio-section">
          <span className="app-live-studio-kicker">Selected</span>
          <h3>{pick.label}</h3>
          <p className="app-live-studio-path">{pick.domPath}</p>
          <dl className="app-live-studio-meta">
            <dt>Tag</dt>
            <dd>{pick.tagName}</dd>
            {pick.nodeId ? (
              <>
                <dt>Node</dt>
                <dd>{pick.nodeId}</dd>
              </>
            ) : null}
            {pick.componentId ? (
              <>
                <dt>Component</dt>
                <dd>{pick.componentId}</dd>
              </>
            ) : null}
            {pick.unilivesAttr ? (
              <>
                <dt>Brand</dt>
                <dd>{pick.unilivesAttr}</dd>
              </>
            ) : null}
          </dl>
        </section>
      ) : (
        <section className="app-live-studio-section muted">
          <p>Turn on pick mode and click any button, icon, card, layout region, or media in the live app.</p>
        </section>
      )}

      {detail ? (
        <section className="app-live-studio-section">
          <span className="app-live-studio-kicker">{detail.type.replace('ui.', '')}</span>
          <h3>{detail.name}</h3>
          <p className="app-live-studio-path">{detail.resourceId}</p>
          {detail.sourcePath ? <p className="app-live-studio-source">{detail.sourcePath}</p> : null}
          <div className="app-live-studio-actions">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => {
                void studioCreateDraft(detail.resourceId, {
                  name: detail.name,
                  note: 'Edited from live app studio',
                })
                  .then(() => setMsg(`✓ Draft created for ${detail.resourceId}`))
                  .catch((e) => setMsg(String(e)));
              }}
            >
              Edit / replace
            </button>
          </div>
        </section>
      ) : null}

      {!detail && hits.length > 0 ? (
        <section className="app-live-studio-section">
          <span className="app-live-studio-kicker">Catalog matches</span>
          <ul className="app-live-studio-list">
            {hits.map((hit) => (
              <li key={hit.resourceId}>
                <button type="button" disabled={busy} onClick={() => void loadResource(hit.resourceId)}>
                  {hit.name}
                </button>
                <span>{hit.resourceId}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="app-live-studio-section">
        <span className="app-live-studio-kicker">Replace media</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*,.svg,.webp,.png,.jpg,.jpeg,.gif,.mp4,.webm"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onMediaFile(file);
            e.target.value = '';
          }}
        />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
          Upload image / video / icon
        </button>
        <p className="app-live-studio-hint">Drop replaces the selected piece when linked to a catalog resource.</p>
      </section>
    </aside>
  );
}
