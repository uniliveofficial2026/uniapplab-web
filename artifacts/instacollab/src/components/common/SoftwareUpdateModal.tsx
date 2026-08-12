import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, Download, Loader2, RefreshCw, Server, X } from 'lucide-react';
import { APP_DISPLAY_NAME } from '../../lib/appBrand';
import {
  applySoftwareUpdate,
  channelLabel,
  checkSoftwareUpdate,
  getSoftwareUpdateStatus,
  subscribeSoftwareUpdate,
  type SoftwareUpdateStatus,
  type SoftwareUpdateSystem,
} from '../../lib/softwareUpdate';

export type SoftwareUpdateModalProps = {
  onClose: () => void;
};

function formatCheckedAt(ts: number | null): string {
  if (!ts) return 'Not checked yet';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '—';
  }
}

function systemIcon(system: SoftwareUpdateSystem) {
  if (system.id === 'pwa') return Download;
  if (system.id === 'cloudSync') return Cloud;
  return Server;
}

function systemTone(status: SoftwareUpdateSystem['status']): string {
  if (status === 'ready') return 'text-emerald-500';
  if (status === 'unavailable') return 'text-muted-foreground';
  return 'text-sky-500';
}

function statusHeadline(status: SoftwareUpdateStatus): { title: string; detail: string } {
  if (status.state === 'checking') {
    return {
      title: 'Checking for updates…',
      detail: `Looking for a newer ${APP_DISPLAY_NAME} build.`,
    };
  }
  if (status.state === 'available') {
    return {
      title: 'Update available',
      detail: `A newer build is ready (${channelLabel(status.channel)}). Restart to apply it.`,
    };
  }
  if (status.state === 'upToDate') {
    return {
      title: 'You’re up to date',
      detail: `${APP_DISPLAY_NAME} is running the latest build.`,
    };
  }
  return {
    title: 'Software Update',
    detail: 'Check for updates from push, deploy, publish, or build releases.',
  };
}

export function SoftwareUpdateModal({ onClose }: SoftwareUpdateModalProps) {
  const [status, setStatus] = useState<SoftwareUpdateStatus>(() => getSoftwareUpdateStatus());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return subscribeSoftwareUpdate(setStatus);
  }, []);

  useEffect(() => {
    // First open: refresh status once without blocking UI.
    void checkSoftwareUpdate();
  }, []);

  const headline = statusHeadline(status);
  const canApply = status.state === 'available';

  const onCheck = async () => {
    setBusy(true);
    try {
      await checkSoftwareUpdate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      id="software-update-modal"
      className="fixed inset-y-0 right-0 left-0 md:left-[72px] lg:left-[244px] z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-card w-full max-w-lg mx-3 rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="software-update-title"
      >
        <div className="h-14 border-b border-border flex items-center justify-between px-5 shrink-0 bg-background">
          <h2 id="software-update-title" className="text-lg font-black tracking-tight flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Software Update
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close software update"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">
          <div className="rounded-2xl border border-border bg-secondary/20 p-4">
            <p className="text-base font-bold text-foreground">{headline.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{headline.detail}</p>
            {status.reason ? (
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                Channel: {channelLabel(status.channel)}
                <span className="opacity-60"> · </span>
                {status.reason}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Current build</p>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground truncate">
                {status.currentId || '—'}
              </p>
            </div>
            <div className="rounded-2xl border border-border p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Latest remote</p>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground truncate">
                {status.remoteId || '—'}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Last checked: {formatCheckedAt(status.checkedAt)}</p>

          <div>
            <h3 className="text-sm font-bold mb-2">Update systems</h3>
            <ul className="space-y-2">
              {status.systems.map((system) => {
                const Icon = systemIcon(system);
                return (
                  <li
                    key={system.id}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-card px-3 py-2.5"
                  >
                    <div className={`mt-0.5 ${systemTone(system.status)}`}>
                      {system.status === 'ready' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-foreground">{system.label}</p>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {system.status === 'ready'
                            ? 'Ready'
                            : system.status === 'unavailable'
                              ? 'Off'
                              : 'Active'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{system.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="border-t border-border p-4 flex flex-col sm:flex-row gap-2 shrink-0 bg-background">
          <button
            type="button"
            onClick={() => void onCheck()}
            disabled={busy || status.state === 'checking'}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm font-bold text-foreground hover:bg-secondary/80 disabled:opacity-60"
          >
            {busy || status.state === 'checking' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Check for updates
          </button>
          <button
            type="button"
            onClick={() => applySoftwareUpdate()}
            disabled={!canApply}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40 disabled:pointer-events-none"
          >
            <Download className="h-4 w-4" />
            Restart to update
          </button>
        </div>
      </div>
    </div>
  );
}
