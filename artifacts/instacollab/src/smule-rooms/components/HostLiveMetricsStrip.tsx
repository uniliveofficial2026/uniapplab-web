import React, { useEffect, useState } from 'react';
import { Activity, Clock, Gift, Heart, MessageCircle, UserPlus, Users } from 'lucide-react';
import { CoinIcon } from '../../components/common/CoinIcon';
import { useOptionalI18n } from '../../lib/i18n';
import { SEMANTIC_EN } from '../../lib/i18n/semanticCatalog';
import { formatLiveDuration } from '../../lib/liveLifecycle';

export type HostLiveMetrics = {
  startedAt: string;
  currentViewers: number;
  peakViewers?: number;
  comments?: number;
  likes?: number;
  follows?: number;
  gifts?: number;
  coinsReceived?: number;
  cashUsd?: number;
  seated?: number;
  connectionQuality?: string | null;
  onOpenDashboard?: () => void;
};

function label(i18n: ReturnType<typeof useOptionalI18n>, key: keyof typeof SEMANTIC_EN): string {
  return i18n?.t(key) || SEMANTIC_EN[key] || key;
}

/** Compact header pill is hidden; full dashboard remains behind host More / End Live flows. */
const HOST_LIVE_METRICS_STRIP_VISIBLE = false;

export function HostLiveMetricsStrip({ metrics }: { metrics: HostLiveMetrics }) {
  if (!HOST_LIVE_METRICS_STRIP_VISIBLE) return null;
  const i18n = useOptionalI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [metrics.startedAt]);

  const duration = formatLiveDuration(metrics.startedAt, now);
  const quality = metrics.connectionQuality && metrics.connectionQuality !== 'unknown'
    ? metrics.connectionQuality
    : null;

  return (
    <button
      type="button"
      onClick={metrics.onOpenDashboard}
      className="mt-1 flex max-w-full min-w-0 flex-wrap items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-2 py-1 text-left backdrop-blur-md"
      data-node-id="node.live.host.realtime-dashboard-trigger"
      aria-label={`${label(i18n, 'live.host.dashboard')}: ${duration}`}
    >
      <span
        className="inline-flex items-center gap-1 rounded-full bg-red-600/90 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white"
        data-node-id="node.live.host.live-duration"
      >
        <Clock size={10} aria-hidden />
        <span>{duration}</span>
      </span>
      <span
        className="inline-flex items-center gap-1 text-[10px] font-black text-white/90"
        data-node-id="node.live.host.current-viewers"
      >
        <Users size={10} aria-hidden />
        {metrics.currentViewers}
        {typeof metrics.peakViewers === 'number' && metrics.peakViewers > 0 ? (
          <span className="font-semibold text-white/50" data-node-id="node.live.host.peak-viewers">
            · {metrics.peakViewers} pk
          </span>
        ) : null}
      </span>
      {typeof metrics.comments === 'number' ? (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-white/80"
          data-node-id="node.live.host.comments-count"
        >
          <MessageCircle size={10} aria-hidden />
          {metrics.comments}
        </span>
      ) : null}
      {typeof metrics.likes === 'number' ? (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-200"
          data-node-id="node.live.host.likes-count"
          title={label(i18n, 'live.host.likes')}
        >
          <Heart size={10} className="fill-current" aria-hidden />
          {metrics.likes}
        </span>
      ) : null}
      {typeof metrics.follows === 'number' ? (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-cyan-200"
          data-node-id="node.live.host.follows-count"
          title={label(i18n, 'live.host.follows')}
        >
          <UserPlus size={10} aria-hidden />
          {metrics.follows}
        </span>
      ) : null}
      {typeof metrics.gifts === 'number' ? (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-200"
          data-node-id="node.live.host.gifts-count"
        >
          <Gift size={10} aria-hidden />
          {metrics.gifts}
        </span>
      ) : null}
      {typeof metrics.coinsReceived === 'number' ? (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-100"
          data-node-id="node.live.host.coins-received"
          title={label(i18n, 'live.host.coinsReceived')}
        >
          <CoinIcon className="h-2.5 w-2.5 shrink-0" />
          {metrics.coinsReceived}
        </span>
      ) : null}
      {typeof metrics.cashUsd === 'number' ? (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-200"
          data-node-id="node.live.host.cash-convertible"
          title={label(i18n, 'live.host.cashConvertible')}
        >
          ${metrics.cashUsd.toFixed(2)}
        </span>
      ) : null}
      {quality ? (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] font-bold capitalize text-emerald-200"
          data-node-id="node.live.host.network-quality"
        >
          <Activity size={10} aria-hidden />
          {quality}
        </span>
      ) : null}
    </button>
  );
}
