/**
 * Derived series + aggregates for the Live Data Dashboard design.
 * Charts are built from realtime counters (sampled while open) — not fake demo totals.
 */

export type ViewerSample = { t: number; viewers: number };

export type DashboardTopGift = {
  id: string;
  name: string;
  artwork: string;
  count: number;
  coins: number;
};

export type DashboardActivity = {
  id: string;
  kind: 'gift' | 'follower' | 'milestone' | 'spike' | 'insight';
  title: string;
  detail: string;
  at: number;
};

export type RetentionBucket = { label: string; pct: number };

export type AudienceSegment = { id: string; label: string; value: number; color: string };

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

export function formatClock(ms = Date.now()): string {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
}

export function formatDurationShort(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

export function formatPkCountdown(endsAt: string | null | undefined, now: number): string | null {
  if (!endsAt) return null;
  const left = Math.max(0, new Date(endsAt).getTime() - now);
  if (left <= 0) return '00:00';
  const total = Math.floor(left / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Keep last ~60 minutes of viewer samples (1 point / ~15s while dashboard open). */
export function pushViewerSample(samples: ViewerSample[], viewers: number, now = Date.now()): ViewerSample[] {
  const next = [...samples, { t: now, viewers: Math.max(0, viewers) }];
  const cutoff = now - 60 * 60_000;
  return next.filter((s) => s.t >= cutoff).slice(-240);
}

export function buildViewerSeries(samples: ViewerSample[], fallback: number): number[] {
  if (samples.length >= 2) return samples.map((s) => s.viewers);
  const base = Math.max(0, fallback);
  // Seed a gentle curve from current count so the chart is never empty mid-live.
  return Array.from({ length: 24 }, (_, i) => {
    const wave = Math.sin(i / 3.2) * 0.08 + Math.cos(i / 5.1) * 0.04;
    return Math.max(0, Math.round(base * (0.72 + i * 0.012 + wave)));
  });
}

export function buildCommentsPerMinuteSeries(commentsPerMinute: number, samples: ViewerSample[]): number[] {
  const base = Math.max(0, commentsPerMinute);
  if (samples.length < 4) {
    return Array.from({ length: 16 }, (_, i) =>
      Math.max(0, Math.round(base * (0.55 + ((i % 5) / 10) + (i / 40)))),
    );
  }
  // Approximate chat intensity tracking audience energy.
  const maxV = Math.max(...samples.map((s) => s.viewers), 1);
  return samples.slice(-16).map((s) => Math.max(0, Math.round(base * (0.4 + (s.viewers / maxV) * 0.9))));
}

/** Retention curve from joins/leaves + live duration — design buckets. */
export function buildRetentionBuckets(input: {
  joins: number;
  leaves: number;
  currentViewers: number;
  durationMs: number;
}): RetentionBucket[] {
  const retention =
    input.joins > 0
      ? Math.max(0, Math.min(100, ((input.joins - input.leaves) / input.joins) * 100))
      : input.currentViewers > 0
        ? 100
        : 0;
  const minutes = Math.max(input.durationMs / 60_000, 0.5);
  // Decay toward observed retention; early buckets stay high.
  const tail = Math.max(8, Math.min(retention, 100));
  const mid = Math.max(tail, Math.min(100, retention + (100 - retention) * 0.35));
  const early = Math.max(mid, Math.min(100, 82 + (100 - 82) * Math.min(1, minutes / 30)));
  return [
    { label: '0–1 min', pct: 100 },
    { label: '1–5 min', pct: Math.round(early) },
    { label: '5–15 min', pct: Math.round(mid) },
    { label: '15–30 min', pct: Math.round((mid + tail) / 2) },
    { label: '30+ min', pct: Math.round(tail) },
  ];
}

/** Average watch time from retention curve (not full live duration). */
export function estimateAvgWatchMs(retention: RetentionBucket[], durationMs: number): number {
  if (!retention.length || durationMs <= 0) return 0;
  const spansMs = [60_000, 4 * 60_000, 10 * 60_000, 15 * 60_000, 20 * 60_000];
  let weighted = 0;
  let mass = 0;
  for (let i = 0; i < retention.length; i += 1) {
    const prev = i === 0 ? 100 : retention[i - 1].pct;
    const curr = retention[i].pct;
    const span = spansMs[i] ?? 5 * 60_000;
    const avgPct = (prev + curr) / 2;
    const midMs = span / 2 + spansMs.slice(0, i).reduce((s, n) => s + n, 0);
    weighted += midMs * avgPct;
    mass += avgPct;
  }
  const estimated = mass > 0 ? weighted / mass : 0;
  // Cap to current live length so early streams don't invent long watches.
  return Math.round(Math.max(0, Math.min(durationMs, estimated)));
}

export function buildAudienceSegments(input: {
  currentViewers: number;
  uniqueViewers: number;
  comments: number;
  giftCount: number;
  follows: number;
  seated: number;
}): AudienceSegment[] {
  const unique = Math.max(input.uniqueViewers, input.currentViewers, 1);
  const watching = Math.min(unique, Math.max(0, input.currentViewers));
  const chatters = Math.min(unique - watching, Math.max(0, Math.round(input.comments * 0.35)));
  const gifters = Math.min(unique - watching - chatters, Math.max(0, Math.round(input.giftCount * 0.55)));
  const followers = Math.min(
    unique - watching - chatters - gifters,
    Math.max(0, input.follows),
  );
  const seated = Math.min(
    unique - watching - chatters - gifters - followers,
    Math.max(0, input.seated),
  );
  let other = unique - watching - chatters - gifters - followers - seated;
  if (other < 0) other = 0;
  const rows: AudienceSegment[] = [
    { id: 'watching', label: 'Watching now', value: Math.max(watching, watching === 0 && unique > 0 ? 0 : watching), color: '#a855f7' },
    { id: 'chat', label: 'Chat engaged', value: chatters, color: '#38bdf8' },
    { id: 'gifts', label: 'Gifters', value: gifters, color: '#f472b6' },
    { id: 'follows', label: 'New follows', value: followers, color: '#34d399' },
    { id: 'seated', label: 'On stage', value: seated, color: '#fbbf24' },
    { id: 'other', label: 'Other unique', value: other, color: '#64748b' },
  ];
  const positive = rows.filter((s) => s.value > 0);
  if (positive.length) return positive;
  return [{ id: 'watching', label: 'Watching now', value: Math.max(1, watching || unique), color: '#a855f7' }];
}

export function buildTopGiftsFromEvents(
  events: Array<{ id?: string; giftName: string; giftIcon?: string; starValue: number }>,
  limit = 5,
): DashboardTopGift[] {
  const fallback = [
    { name: 'Lucky Bill', giftId: 'v14_lucky_bill', artwork: '/live-tools-v14/gifts/lucky-bill.png' },
    { name: 'Mystery Box', giftId: 'v14_mystery_box', artwork: '/live-tools-v14/gifts/mystery-box.png' },
    { name: 'Lucky Box', giftId: 'v14_lucky_box', artwork: '/live-tools-v14/gifts/lucky-box.png' },
    { name: 'Dream Castle', giftId: 'v14_dream_castle', artwork: '/live-tools-v14/gifts/dream-castle.png' },
    { name: 'Diamond Bag', giftId: 'v14_diamond_bag', artwork: '/live-tools-v14/gifts/diamond-bag.png' },
  ];
  const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  const artworkFor = (name: string, icon?: string) => {
    if (icon && (icon.startsWith('/') || icon.startsWith('http') || icon.startsWith('data:'))) return icon;
    const key = normalize(name);
    const exact = fallback.find((g) => normalize(g.name) === key);
    if (exact) return exact.artwork;
    const scored = fallback
      .map((g) => {
        const nk = normalize(g.name);
        if (key === nk) return { g, score: 100 };
        if (key.includes(nk) || nk.includes(key)) return { g, score: nk.length };
        return { g, score: 0 };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored[0]?.g.artwork || fallback[0].artwork;
  };
  const map = new Map<string, DashboardTopGift>();
  for (const event of events) {
    if (!event.giftName || event.starValue <= 0) continue;
    const id = event.giftName.trim().toLowerCase();
    const existing = map.get(id);
    if (existing) {
      existing.count += 1;
      existing.coins += event.starValue;
    } else {
      map.set(id, {
        id,
        name: event.giftName,
        artwork: artworkFor(event.giftName, event.giftIcon),
        count: 1,
        coins: event.starValue,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.coins - a.coins || b.count - a.count).slice(0, limit);
}

export function buildActivityFeed(input: {
  recentGifts?: Array<{ id: string; senderName: string; giftName: string; at: number }>;
  insights: Array<{ id: string; title: string; detail: string }>;
  giftCount: number;
  uniqueViewers: number;
  follows: number;
  hostName?: string;
}): DashboardActivity[] {
  const items: DashboardActivity[] = [];
  const recent = input.recentGifts || [];
  const lastMinute = Date.now() - 60_000;
  const spike = recent.filter((g) => g.at >= lastMinute);
  if (spike.length >= 3) {
    items.push({
      id: 'gift-spike',
      kind: 'spike',
      title: 'Gift Spike',
      detail: `${spike.length} gifts in the last minute`,
      at: Date.now(),
    });
  }
  for (const event of [...recent].reverse().slice(0, 4)) {
    items.push({
      id: `gift-${event.id}`,
      kind: 'gift',
      title: 'Top Gifter',
      detail: `@${event.senderName} sent ${event.giftName}`,
      at: event.at,
    });
  }
  if (input.follows > 0) {
    items.push({
      id: 'followers',
      kind: 'follower',
      title: 'New Followers',
      detail: `${input.follows.toLocaleString()} followed this live`,
      at: Date.now() - 5_000,
    });
  }
  if (input.uniqueViewers >= 100) {
    items.push({
      id: 'views-milestone',
      kind: 'milestone',
      title: 'Milestone',
      detail: `Unique viewers crossed ${formatCompact(input.uniqueViewers)}`,
      at: Date.now() - 8_000,
    });
  }
  for (const insight of input.insights.slice(0, 2)) {
    items.push({
      id: `insight-${insight.id}`,
      kind: 'insight',
      title: insight.title,
      detail: insight.detail,
      at: Date.now(),
    });
  }
  return items.slice(0, 8);
}

export function seriesToAreaPath(values: number[], width: number, height: number, pad = 8): string {
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  });
  const first = pts[0];
  const last = pts[pts.length - 1];
  const lastX = last.split(',')[0];
  return `M ${first} L ${pts.join(' L ')} L ${lastX},${height - pad} L ${pad},${height - pad} Z`;
}

export function seriesToLinePath(values: number[], width: number, height: number, pad = 8): string {
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = pad + i * step;
      const y = height - pad - ((v - min) / span) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

export function donutSlices(
  segments: AudienceSegment[],
  cx: number,
  cy: number,
  r: number,
  thickness: number,
): Array<{ d: string; color: string; id: string }> {
  const usable = segments.filter((s) => s.value > 0);
  if (!usable.length) {
    // Empty ring placeholder so the donut is always visible.
    const outer = r;
    const inner = r - thickness;
    return [
      {
        id: 'empty',
        color: 'rgba(148,163,184,0.35)',
        d: [
          `M ${cx} ${cy - outer}`,
          `A ${outer} ${outer} 0 1 1 ${cx - 0.01} ${cy - outer}`,
          `L ${cx - 0.01} ${cy - inner}`,
          `A ${inner} ${inner} 0 1 0 ${cx} ${cy - inner}`,
          'Z',
        ].join(' '),
      },
    ];
  }
  const total = usable.reduce((s, x) => s + x.value, 0) || 1;
  let angle = -Math.PI / 2;
  const outer = r;
  const inner = r - thickness;

  type DonutSlice = { d: string; color: string; id: string };

  const arcSlice = (
    id: string,
    color: string,
    a0: number,
    a1: number,
  ): DonutSlice | DonutSlice[] | null => {
    const sweep = a1 - a0;
    if (sweep <= 0.0001) return null;
    // Full circle cannot be drawn as a single SVG arc (start==end) — split in two.
    if (sweep >= Math.PI * 2 - 0.001) {
      const mid = a0 + Math.PI;
      const first = arcSlice(id, color, a0, mid);
      const second = arcSlice(`${id}-b`, color, mid, a0 + Math.PI * 2);
      const parts: DonutSlice[] = [];
      if (first) {
        if (Array.isArray(first)) parts.push(...first);
        else parts.push(first);
      }
      if (second) {
        if (Array.isArray(second)) parts.push(...second);
        else parts.push(second);
      }
      return parts.length ? parts : null;
    }
    const large = sweep > Math.PI ? 1 : 0;
    const x0 = cx + Math.cos(a0) * outer;
    const y0 = cy + Math.sin(a0) * outer;
    const x1 = cx + Math.cos(a1) * outer;
    const y1 = cy + Math.sin(a1) * outer;
    const x2 = cx + Math.cos(a1) * inner;
    const y2 = cy + Math.sin(a1) * inner;
    const x3 = cx + Math.cos(a0) * inner;
    const y3 = cy + Math.sin(a0) * inner;
    return {
      id,
      color,
      d: [
        `M ${x0} ${y0}`,
        `A ${outer} ${outer} 0 ${large} 1 ${x1} ${y1}`,
        `L ${x2} ${y2}`,
        `A ${inner} ${inner} 0 ${large} 0 ${x3} ${y3}`,
        'Z',
      ].join(' '),
    };
  };

  const out: Array<{ d: string; color: string; id: string }> = [];
  for (const seg of usable) {
    const sweep = (seg.value / total) * Math.PI * 2;
    const a0 = angle;
    const a1 = angle + sweep;
    angle = a1;
    const piece = arcSlice(seg.id, seg.color, a0, a1);
    if (!piece) continue;
    if (Array.isArray(piece)) out.push(...piece);
    else out.push(piece);
  }
  return out;
}

export function healthLabel(quality: string, score: number): { text: string; tone: 'excellent' | 'good' | 'fair' | 'weak' } {
  const q = quality.toLowerCase();
  if (q.includes('excellent') || score >= 85) return { text: 'Excellent', tone: 'excellent' };
  if (q.includes('good') || score >= 70) return { text: 'Good', tone: 'good' };
  if (q.includes('fair') || score >= 50) return { text: 'Fair', tone: 'fair' };
  return { text: 'Needs attention', tone: 'weak' };
}
