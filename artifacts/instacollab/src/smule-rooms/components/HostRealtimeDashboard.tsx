import React, { useEffect, useMemo, useState } from 'react';
import {
  Expand,
  Gift,
  Heart,
  MessageCircle,
  Share2,
  Shrink,
  X,
} from 'lucide-react';
import { usdFromCoins } from '../../lib/coinPricing';
import { useOptionalI18n } from '../../lib/i18n';
import { SEMANTIC_EN } from '../../lib/i18n/semanticCatalog';
import { liveDurationMs, formatLiveDuration } from '../../lib/liveLifecycle';
import {
  barHeights,
  commentsPerMinuteSeriesFromHistory,
  getLiveChartHistory,
  pushLiveChartSample,
  seriesToAreaPath,
  seriesToLinePath,
  viewerSeriesFromHistory,
} from '../../lib/liveLifecycle/hostLiveChartHistory';
import {
  buildActivityFeed,
  buildAudienceSegments,
  buildRetentionBuckets,
  buildTopGiftsFromEvents,
  donutSlices,
  estimateAvgWatchMs,
  formatClock,
  formatCompact,
  formatDurationShort,
  healthLabel,
} from '../../lib/liveLifecycle/hostLiveDashboardModel';
import { analyzeHostLiveMetrics } from '../../lib/liveLifecycle/hostLiveMetricsAnalysis';
import type { LiveHostDashboardSnapshot, LiveHostSummary } from '../../lib/platformApi';
import { getRoomGiftState } from '../utils/roomGifts';
import './host-realtime-dashboard.css';

function formatBitrate(value: number | null): string {
  if (value == null) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} Mbps`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} kbps`;
  return `${Math.round(value)} bps`;
}

function formatPacketLoss(value: number | null): string {
  if (value == null) return '—';
  if (value <= 1) return `${(value * 100).toFixed(1)}%`;
  if (value <= 100) return `${value}%`;
  return String(value);
}

function droppedFramesPct(packetLoss: number | null): string {
  if (packetLoss == null) return '—';
  const loss = packetLoss <= 1 ? packetLoss * 100 : packetLoss;
  return `${Math.min(100, loss * 0.4).toFixed(2)}%`;
}

export function HostRealtimeDashboard({
  open,
  snapshot,
  summary,
  syncing,
  roomId,
  liveViewers,
  seated,
  liveCoinsReceived,
  liveGiftCount,
  liveLikes,
  liveFollows,
  liveFollowerTotal,
  liveComments,
  liveShares,
  hostName,
  roomTitle,
  liveStartedAt,
  onClose,
}: {
  open: boolean;
  snapshot: LiveHostDashboardSnapshot | null;
  summary?: LiveHostSummary | null;
  syncing?: boolean;
  roomId?: string;
  liveViewers?: number;
  seated?: number;
  liveCoinsReceived?: number;
  liveGiftCount?: number;
  liveLikes?: number;
  liveFollows?: number;
  liveFollowerTotal?: number;
  liveComments?: number;
  liveShares?: number;
  hostName?: string;
  hostAvatarUrl?: string;
  roomTitle?: string;
  liveStartedAt?: string | null;
  onClose: () => void;
}) {
  const i18n = useOptionalI18n();
  const t = (key: keyof typeof SEMANTIC_EN | string) =>
    i18n?.t(key) || SEMANTIC_EN[key as keyof typeof SEMANTIC_EN] || key;
  const [now, setNow] = useState(() => Date.now());
  const [peakLocal, setPeakLocal] = useState(0);
  const [peakAt, setPeakAt] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setExpanded(false);
      return;
    }
    setPeakLocal((prev) => Math.max(prev, liveViewers ?? 0, snapshot?.audience.peakConcurrentViewers ?? 0));
  }, [open, liveViewers, snapshot?.audience.peakConcurrentViewers]);

  const dash = snapshot;
  const ended = summary ?? null;
  const currentViewers = Math.max(dash?.audience.currentUniqueViewers ?? 0, liveViewers ?? 0);

  useEffect(() => {
    if (!open) return;
    setPeakLocal((prev) => {
      if (currentViewers > prev) {
        setPeakAt(Date.now());
        return currentViewers;
      }
      return prev;
    });
  }, [open, currentViewers]);

  const peakViewers = Math.max(
    ended?.peakViewers ?? 0,
    dash?.audience.peakConcurrentViewers ?? 0,
    peakLocal,
    currentViewers,
  );
  const uniqueViewers = Math.max(
    ended?.uniqueViewers ?? 0,
    dash?.audience.uniqueViewers ?? 0,
    peakViewers,
    currentViewers,
  );
  const seatedCount = Math.max(dash?.participants.seated ?? 0, seated ?? 0);
  const coinsReceived = Math.max(
    liveCoinsReceived ?? 0,
    ended?.giftValue ?? 0,
    dash?.gifts.confirmedGrossGiftValue ?? 0,
  );
  const giftCount = Math.max(
    liveGiftCount ?? 0,
    ended?.confirmedGiftCount ?? 0,
    dash?.gifts.confirmedGiftCount ?? 0,
  );
  const cashUsd = usdFromCoins(coinsReceived, true);
  const likes = Math.max(liveLikes ?? 0, ended?.reactions ?? 0, dash?.engagement.reactions ?? 0);
  const follows = Math.max(
    liveFollows ?? 0,
    ended?.followersGained ?? 0,
    dash?.engagement.followersGained ?? 0,
  );
  const comments = Math.max(liveComments ?? 0, ended?.comments ?? 0, dash?.engagement.comments ?? 0);
  const shares = Math.max(liveShares ?? 0, ended?.shares ?? 0, dash?.engagement.shares ?? 0);

  // Keep chart history alive while the dashboard is open (Room also samples while hosting).
  useEffect(() => {
    if (!open || !roomId) return undefined;
    const sample = () => {
      pushLiveChartSample(roomId, {
        viewers: currentViewers,
        comments,
        likes,
        gifts: giftCount,
        coins: coinsReceived,
      });
      setHistoryTick((n) => n + 1);
    };
    sample();
    const id = window.setInterval(sample, 5_000);
    return () => window.clearInterval(id);
  }, [open, roomId, currentViewers, comments, likes, giftCount, coinsReceived]);

  const chartHistory = useMemo(
    () => getLiveChartHistory(roomId),
    [roomId, historyTick, currentViewers, comments],
  );

  const joins = Math.max(ended?.joins ?? 0, dash?.audience.joins ?? 0, uniqueViewers);
  const leaves = Math.max(ended?.leaves ?? 0, dash?.audience.leaves ?? 0);
  const startedAt =
    ended?.startedAt || liveStartedAt || dash?.startedAt || new Date(now).toISOString();
  const durationMs = ended?.durationMs ?? liveDurationMs(startedAt, now);
  const commentsPerMinute =
    dash?.engagement.commentsPerMinute ||
    Number((comments / Math.max(durationMs / 60_000, 1 / 60)).toFixed(1));
  const isLive =
    !ended &&
    (dash?.roomState === 'live' ||
      dash?.roomState === 'host_reconnecting' ||
      !dash ||
      Boolean(liveStartedAt));

  const analysis = useMemo(
    () =>
      analyzeHostLiveMetrics({
        durationMs,
        currentViewers,
        peakViewers,
        uniqueViewers,
        joins,
        leaves,
        seated: seatedCount,
        seatRequests: dash?.participants.pendingSeatRequests ?? 0,
        comments,
        commentsPerMinute,
        likes,
        shares,
        follows,
        giftCount,
        coinsReceived,
        cashUsd,
        connectionQuality: dash?.media.connectionQuality || 'unknown',
        uploadBitrate: dash?.media.uploadBitrate ?? null,
        framesPerSecond: dash?.media.framesPerSecond ?? null,
        packetLoss: dash?.media.packetLoss ?? null,
        roundTripTime: dash?.media.roundTripTime ?? null,
      }),
    [
      cashUsd,
      coinsReceived,
      comments,
      commentsPerMinute,
      currentViewers,
      dash?.media.connectionQuality,
      dash?.media.framesPerSecond,
      dash?.media.packetLoss,
      dash?.media.roundTripTime,
      dash?.media.uploadBitrate,
      dash?.participants.pendingSeatRequests,
      durationMs,
      follows,
      giftCount,
      joins,
      leaves,
      likes,
      peakViewers,
      seatedCount,
      shares,
      uniqueViewers,
    ],
  );

  const viewerSeries = useMemo(
    () => viewerSeriesFromHistory(chartHistory, currentViewers || peakViewers),
    [chartHistory, currentViewers, peakViewers],
  );
  const cpmSeries = useMemo(
    () => commentsPerMinuteSeriesFromHistory(chartHistory, commentsPerMinute),
    [chartHistory, commentsPerMinute],
  );
  const cpmBarHeights = useMemo(() => barHeights(cpmSeries), [cpmSeries]);
  const retention = useMemo(
    () => buildRetentionBuckets({ joins, leaves, currentViewers, durationMs }),
    [joins, leaves, currentViewers, durationMs],
  );
  const segments = useMemo(
    () =>
      buildAudienceSegments({
        currentViewers,
        uniqueViewers,
        comments,
        giftCount,
        follows,
        seated: seatedCount,
      }),
    [currentViewers, uniqueViewers, comments, giftCount, follows, seatedCount],
  );
  const recentGifts = useMemo(() => (roomId ? getRoomGiftState(roomId).recentGifts : []), [roomId, giftCount, coinsReceived, now]);
  const topGifts = useMemo(() => buildTopGiftsFromEvents(recentGifts, 5), [recentGifts]);
  const activity = useMemo(
    () =>
      buildActivityFeed({
        recentGifts,
        insights: analysis.insights,
        giftCount,
        uniqueViewers,
        follows,
        hostName,
      }),
    [recentGifts, analysis.insights, giftCount, uniqueViewers, follows, hostName],
  );

  const areaPath = seriesToAreaPath(viewerSeries, 560, 190, 10);
  const linePath = seriesToLinePath(viewerSeries, 560, 190, 10);
  const retentionPath = seriesToLinePath(
    retention.map((b) => b.pct),
    320,
    120,
    8,
  );
  const donut = donutSlices(segments, 59, 59, 52, 14);
  const engagementRate =
    uniqueViewers > 0
      ? Number((((comments + likes + shares + giftCount) / uniqueViewers) * 100).toFixed(1))
      : 0;
  const avgWatchMs = estimateAvgWatchMs(retention, durationMs);
  const net = healthLabel(dash?.media.connectionQuality || '', analysis.networkScore);
  const titleName = hostName || roomTitle || t('live.host.dashboard');
  const hasContent = Boolean(dash || ended || liveViewers != null || liveStartedAt);

  if (!open) return null;

  return (
    <div className="ldd-overlay" data-node-id="node.live.host.realtime-dashboard">
      <button type="button" className="ldd-scrim" aria-label={t('common.close')} onClick={onClose} />
      <div
        className="ldd-shell"
        data-expanded={expanded ? 'true' : 'false'}
        role="dialog"
        aria-modal="true"
        aria-label="Live Data Dashboard"
      >
        <header className="ldd-head">
          <div className="ldd-head-main">
            <h2>Live Data Dashboard</h2>
            {isLive ? (
              <span className="ldd-live">
                <i /> LIVE
              </span>
            ) : (
              <span className="ldd-live" style={{ color: '#fda4af', borderColor: 'rgba(251,113,133,.35)', background: 'rgba(244,63,94,.12)' }}>
                ENDED
              </span>
            )}
            <span className="ldd-clock">{formatClock(now)}</span>
            {syncing ? <span className="ldd-clock">{t('common.loading')}</span> : null}
          </div>
          <div className="ldd-head-actions">
            <button type="button" className="ldd-icon-btn" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <Shrink size={14} /> : <Expand size={14} />}
              <span>{expanded ? 'Collapse' : 'Expand'}</span>
            </button>
            <button type="button" className="ldd-icon-btn" onClick={onClose} aria-label={t('common.close')}>
              <X size={14} />
            </button>
          </div>
        </header>

        <div className="ldd-body">
          {hasContent ? (
            <>
              <section className="ldd-kpis" aria-label="Key metrics">
                <article className="ldd-kpi">
                  <small>{t('live.host.currentViewers')}</small>
                  <b>{formatCompact(currentViewers)}</b>
                  <span data-tone={analysis.retentionPct >= 50 ? undefined : 'muted'}>
                    {analysis.retentionPct}% retention
                  </span>
                </article>
                <article className="ldd-kpi">
                  <small>{t('live.host.peakViewers')}</small>
                  <b>{formatCompact(peakViewers)}</b>
                  <span data-tone="muted">{formatClock(peakAt)}</span>
                </article>
                <article className="ldd-kpi">
                  <small>{t('live.host.uniqueViewers')}</small>
                  <b>{formatCompact(Math.max(uniqueViewers, joins))}</b>
                  <span data-tone="muted">{formatCompact(uniqueViewers)} unique</span>
                </article>
                <article className="ldd-kpi">
                  <small>{t('live.host.duration')}</small>
                  <b>{formatLiveDuration(startedAt, now)}</b>
                  <span data-tone="muted">avg {formatDurationShort(avgWatchMs)}</span>
                </article>
                <article className="ldd-kpi">
                  <small>{t('live.host.likes')}</small>
                  <b>{formatCompact(likes)}</b>
                  <span>{analysis.likePerViewer}/viewer</span>
                </article>
                <article className="ldd-kpi">
                  <small>{t('live.host.follows')}</small>
                  <b>{formatCompact(follows)}</b>
                  <span data-tone="muted">
                    {t('live.host.followCount')} {formatCompact(liveFollowerTotal ?? follows)}
                  </span>
                </article>
                <article className="ldd-kpi">
                  <small>{t('live.host.seated')}</small>
                  <b>{formatCompact(seatedCount)}</b>
                  <span data-tone="muted">{t('live.host.participants')}</span>
                </article>
                <article className="ldd-kpi">
                  <small>{t('live.host.coinsReceived')}</small>
                  <b>{formatCompact(coinsReceived)}</b>
                  <span>
                    {t('live.host.cashConvertible')} ${cashUsd.toFixed(2)}
                  </span>
                </article>
              </section>

              <div className="ldd-grid">
                <section className="ldd-card ldd-viewers">
                  <h3>Realtime Viewers</h3>
                  <svg className="ldd-chart ldd-chart-lg" viewBox="0 0 560 190" preserveAspectRatio="none" aria-hidden>
                    <defs>
                      <linearGradient id="lddViewerFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c084fc" stopOpacity="0.55" />
                        <stop offset="100%" stopColor="#c084fc" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#lddViewerFill)" />
                    <path d={linePath} fill="none" stroke="#e879f9" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <div className="ldd-peak-tag">
                    {formatClock(peakAt)} · {formatCompact(peakViewers)} Peak
                  </div>
                </section>

                <section className="ldd-card ldd-engagement">
                  <h3>Engagement Overview</h3>
                  <div className="ldd-eng-grid">
                    <div className="ldd-eng-tile" data-tone="blue">
                      <i><MessageCircle size={16} /></i>
                      <div>
                        <small>Comments</small>
                        <b>{formatCompact(comments)}</b>
                        <em>{commentsPerMinute}/min</em>
                      </div>
                    </div>
                    <div className="ldd-eng-tile">
                      <i><Share2 size={16} /></i>
                      <div>
                        <small>Shares</small>
                        <b>{formatCompact(shares)}</b>
                        <em>live</em>
                      </div>
                    </div>
                    <div className="ldd-eng-tile" data-tone="pink">
                      <i><Gift size={16} /></i>
                      <div>
                        <small>Gifts</small>
                        <b>{formatCompact(giftCount)}</b>
                        <em>{formatCompact(coinsReceived)} coins</em>
                      </div>
                    </div>
                    <div className="ldd-eng-tile" data-tone="rose">
                      <i><Heart size={16} /></i>
                      <div>
                        <small>Engagement Rate</small>
                        <b>{engagementRate}%</b>
                        <em>score {analysis.engagementScore}</em>
                      </div>
                    </div>
                  </div>
                  <div className="ldd-cpm">
                    <div className="ldd-cpm-head">
                      <span>Comments per minute</span>
                      <b>{commentsPerMinute.toFixed(1)}</b>
                    </div>
                    <div className="ldd-bars" aria-hidden>
                      {cpmBarHeights.map((h, i) => (
                        <span key={i} style={{ height: `${h}%` }} title={`${cpmSeries[i] ?? 0}/min`} />
                      ))}
                    </div>
                  </div>
                </section>

                <section className="ldd-card ldd-gifts">
                  <h3>Top Gifts</h3>
                  <div className="ldd-gift-list">
                    {topGifts.length ? (
                      topGifts.map((gift) => (
                        <div key={gift.id} className="ldd-gift-row">
                          <img src={gift.artwork} alt="" loading="lazy" decoding="async" />
                          <div>
                            <b>{gift.name}</b>
                            <small>{formatCompact(gift.count)} sent</small>
                          </div>
                          <strong>{formatCompact(gift.coins)}</strong>
                        </div>
                      ))
                    ) : (
                      <p className="ldd-empty" style={{ margin: '8px 0' }}>
                        {giftCount > 0
                          ? `${formatCompact(giftCount)} gifts · ${formatCompact(coinsReceived)} coins`
                          : 'No gifts yet this live'}
                      </p>
                    )}
                  </div>
                </section>

                <section className="ldd-card ldd-retention">
                  <h3>Audience Retention</h3>
                  <div className="ldd-retention-wrap">
                    <svg className="ldd-chart" viewBox="0 0 320 120" preserveAspectRatio="none" aria-hidden>
                      <path d={retentionPath} fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <div className="ldd-ret-table">
                      {retention.map((row) => (
                        <div key={row.label}>
                          <span>{row.label}</span>
                          <b>{row.pct}%</b>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="ldd-card ldd-distribution">
                  <h3>Viewer Distribution</h3>
                  <div className="ldd-dist-wrap">
                    <div className="ldd-donut-wrap">
                      <svg viewBox="0 0 118 118" aria-hidden>
                        {donut.map((slice) => (
                          <path key={slice.id} d={slice.d} fill={slice.color} />
                        ))}
                      </svg>
                      <div className="ldd-donut-center">
                        <small>Unique</small>
                        <b>{formatCompact(uniqueViewers)}</b>
                      </div>
                    </div>
                    <div className="ldd-legend">
                      {segments.map((seg) => (
                        <div key={seg.id}>
                          <i style={{ background: seg.color }} />
                          <span>{seg.label}</span>
                          <b>{formatCompact(seg.value)}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="ldd-card ldd-health">
                  <h3>Stream Health</h3>
                  <div className="ldd-health-list">
                    <div className="ldd-health-row">
                      <span>Video Bitrate</span>
                      <b>{formatBitrate(dash?.media.uploadBitrate ?? null)}</b>
                      <em className="ldd-badge" data-tone={net.tone}>{net.text}</em>
                    </div>
                    <div className="ldd-health-row">
                      <span>Dropped Frames</span>
                      <b>{droppedFramesPct(dash?.media.packetLoss ?? null)}</b>
                      <em className="ldd-badge" data-tone={analysis.networkScore >= 70 ? 'good' : 'fair'}>
                        {analysis.networkScore >= 70 ? 'Good' : 'Fair'}
                      </em>
                    </div>
                    <div className="ldd-health-row">
                      <span>Video FPS</span>
                      <b>{dash?.media.framesPerSecond ?? '—'}</b>
                      <em className="ldd-badge" data-tone={(dash?.media.framesPerSecond ?? 0) >= 24 ? 'good' : 'fair'}>
                        {(dash?.media.framesPerSecond ?? 0) >= 24 ? 'Good' : 'Watch'}
                      </em>
                    </div>
                    <div className="ldd-health-row">
                      <span>RTT</span>
                      <b>{dash?.media.roundTripTime != null ? `${dash.media.roundTripTime} ms` : '—'}</b>
                      <em className="ldd-badge" data-tone={(dash?.media.roundTripTime ?? 999) < 80 ? 'excellent' : 'good'}>
                        {(dash?.media.roundTripTime ?? 999) < 80 ? 'Excellent' : 'Good'}
                      </em>
                    </div>
                    <div className="ldd-health-row">
                      <span>Packet Loss</span>
                      <b>{formatPacketLoss(dash?.media.packetLoss ?? null)}</b>
                      <em className="ldd-badge" data-tone={analysis.networkScore >= 60 ? 'good' : 'weak'}>
                        {analysis.networkScore >= 60 ? 'Good' : 'Check'}
                      </em>
                    </div>
                    <div className="ldd-health-row">
                      <span>CDN / Media</span>
                      <b>{dash?.media.connectionState || 'LiveKit'}</b>
                      <em className="ldd-badge" data-tone={isLive ? 'excellent' : 'fair'}>
                        {isLive ? 'Connected' : 'Idle'}
                      </em>
                    </div>
                  </div>
                </section>

                <section className="ldd-card ldd-activity ldd-span-2">
                  <h3>Live Activity Feed · {titleName}</h3>
                  <div className="ldd-activity-scroller">
                    {activity.map((item) => (
                      <article key={item.id} className="ldd-activity-card" data-kind={item.kind}>
                        <b>{item.title}</b>
                        <p>{item.detail}</p>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : (
            <p className="ldd-empty">{t('common.loading')}</p>
          )}
        </div>

      </div>
    </div>
  );
}
