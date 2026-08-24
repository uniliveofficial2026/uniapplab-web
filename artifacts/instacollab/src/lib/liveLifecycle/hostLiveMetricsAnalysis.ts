/**
 * Live host dashboard metric analysis — scores + insights from realtime counters.
 */

export type HostMetricHealth = 'excellent' | 'good' | 'fair' | 'weak' | 'critical';

export type HostMetricArtKey =
  | 'liveScore'
  | 'audience'
  | 'engagement'
  | 'earnings'
  | 'network'
  | 'insights'
  | 'duration';

export type HostLiveMetricInput = {
  durationMs: number;
  currentViewers: number;
  peakViewers: number;
  uniqueViewers: number;
  joins: number;
  leaves: number;
  seated: number;
  seatRequests: number;
  comments: number;
  commentsPerMinute: number;
  likes: number;
  shares: number;
  follows: number;
  giftCount: number;
  coinsReceived: number;
  cashUsd: number;
  connectionQuality: string;
  uploadBitrate: number | null;
  framesPerSecond: number | null;
  packetLoss: number | null;
  roundTripTime: number | null;
};

export type HostLiveInsight = {
  id: string;
  artKey: HostMetricArtKey;
  tone: HostMetricHealth;
  title: string;
  detail: string;
};

export type HostLivePillar = {
  id: HostMetricArtKey;
  label: string;
  score: number;
  health: HostMetricHealth;
  /** Real metric drivers that produced the score — shown under artwork. */
  summary: string;
};

export type HostLiveAnalysis = {
  overallScore: number;
  overallHealth: HostMetricHealth;
  overallSummary: string;
  audienceScore: number;
  engagementScore: number;
  earningsScore: number;
  networkScore: number;
  retentionPct: number;
  giftPerViewer: number;
  likePerViewer: number;
  commentPerViewer: number;
  coinsPerMinute: number;
  pillars: HostLivePillar[];
  insights: HostLiveInsight[];
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function healthFromScore(score: number): HostMetricHealth {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'weak';
  return 'critical';
}

function qualityScore(quality: string): number {
  const q = String(quality || '').toLowerCase();
  if (q.includes('excellent') || q === '5') return 100;
  if (q.includes('good') || q === '4') return 82;
  if (q.includes('fair') || q.includes('average') || q === '3') return 60;
  if (q.includes('poor') || q === '2') return 35;
  if (q.includes('lost') || q.includes('fail') || q === '1' || q === '0') return 10;
  return 45;
}

function formatPacketLossPct(value: number | null): string {
  if (value == null) return '—';
  if (value <= 1) return `${(value * 100).toFixed(1)}%`;
  return `${value}%`;
}

export function analyzeHostLiveMetrics(input: HostLiveMetricInput): HostLiveAnalysis {
  const minutes = Math.max(input.durationMs / 60_000, 1 / 60);
  const audienceBase = Math.max(input.uniqueViewers, input.peakViewers, input.currentViewers, 1);
  const retentionPct =
    input.joins > 0
      ? clamp(((input.joins - input.leaves) / input.joins) * 100)
      : input.currentViewers > 0
        ? 100
        : 0;
  const giftPerViewer = input.coinsReceived / audienceBase;
  const likePerViewer = input.likes / audienceBase;
  const commentPerViewer = input.comments / audienceBase;
  const coinsPerMinute = input.coinsReceived / minutes;

  const audienceScore = clamp(
    input.currentViewers * 12 +
      input.peakViewers * 4 +
      Math.min(input.uniqueViewers, 40) * 1.2 +
      retentionPct * 0.35 +
      input.seated * 6,
  );

  const engagementScore = clamp(
    Math.min(input.commentsPerMinute, 30) * 2.2 +
      Math.min(likePerViewer, 20) * 3 +
      Math.min(commentPerViewer, 10) * 4 +
      input.shares * 3 +
      input.follows * 5 +
      (input.seatRequests > 0 ? 8 : 0),
  );

  const earningsScore = clamp(
    Math.min(giftPerViewer, 80) * 0.9 +
      Math.min(coinsPerMinute, 120) * 0.45 +
      Math.min(input.giftCount, 40) * 1.4 +
      Math.min(input.cashUsd, 50) * 1.2,
  );

  let networkScore = qualityScore(input.connectionQuality);
  if (input.framesPerSecond != null) {
    if (input.framesPerSecond >= 24) networkScore += 8;
    else if (input.framesPerSecond < 15) networkScore -= 18;
  }
  if (input.packetLoss != null) {
    const loss = input.packetLoss <= 1 ? input.packetLoss * 100 : input.packetLoss;
    if (loss > 8) networkScore -= 25;
    else if (loss > 3) networkScore -= 12;
    else networkScore += 5;
  }
  if (input.roundTripTime != null) {
    if (input.roundTripTime > 250) networkScore -= 18;
    else if (input.roundTripTime > 140) networkScore -= 8;
    else if (input.roundTripTime < 80) networkScore += 6;
  }
  if (input.uploadBitrate != null) {
    if (input.uploadBitrate >= 1_500_000) networkScore += 8;
    else if (input.uploadBitrate < 400_000) networkScore -= 15;
  }
  networkScore = clamp(networkScore);

  const overallScore = clamp(
    audienceScore * 0.28 + engagementScore * 0.32 + earningsScore * 0.22 + networkScore * 0.18,
  );
  const overallHealth = healthFromScore(overallScore);

  const audienceHealth = healthFromScore(audienceScore);
  const engagementHealth = healthFromScore(engagementScore);
  const earningsHealth = healthFromScore(earningsScore);
  const networkHealth = healthFromScore(networkScore);

  const pillars: HostLivePillar[] = [
    {
      id: 'audience',
      label: 'Audience',
      score: Math.round(audienceScore),
      health: audienceHealth,
      summary: `${input.currentViewers} live · ${input.peakViewers} peak · ${Math.round(retentionPct)}% retain`,
    },
    {
      id: 'engagement',
      label: 'Engagement',
      score: Math.round(engagementScore),
      health: engagementHealth,
      summary: `${input.comments} chat · ${input.likes} likes · ${input.commentsPerMinute.toFixed(1)}/min`,
    },
    {
      id: 'earnings',
      label: 'Gifts',
      score: Math.round(earningsScore),
      health: earningsHealth,
      summary: `${input.giftCount} gifts · ${Math.round(input.coinsReceived).toLocaleString()} coins · $${input.cashUsd.toFixed(2)}`,
    },
    {
      id: 'network',
      label: 'Network',
      score: Math.round(networkScore),
      health: networkHealth,
      summary: `${input.connectionQuality || 'unknown'} · ${input.framesPerSecond ?? '—'} fps · loss ${formatPacketLossPct(input.packetLoss)}`,
    },
  ];

  const insights: HostLiveInsight[] = [];

  if (input.currentViewers <= 0 && minutes > 1) {
    insights.push({
      id: 'no-audience',
      artKey: 'audience',
      tone: 'weak',
      title: 'No active viewers',
      detail: 'Share the room or invite friends to bring the first viewers in.',
    });
  } else if (retentionPct >= 75 && input.joins >= 3) {
    insights.push({
      id: 'retention-strong',
      artKey: 'audience',
      tone: 'excellent',
      title: 'Strong audience retention',
      detail: `${Math.round(retentionPct)}% stay rate — viewers are sticking with this live.`,
    });
  } else if (retentionPct < 40 && input.joins >= 4) {
    insights.push({
      id: 'retention-low',
      artKey: 'audience',
      tone: 'fair',
      title: 'Viewers are leaving early',
      detail: 'Try greeting newcomers, starting a game, or posting a clear topic in chat.',
    });
  }

  if (engagementScore >= 70) {
    insights.push({
      id: 'engagement-hot',
      artKey: 'engagement',
      tone: 'excellent',
      title: 'Engagement is hot',
      detail: `${input.likes.toLocaleString()} likes and ${input.comments.toLocaleString()} comments fueling the room.`,
    });
  } else if (input.commentsPerMinute < 0.4 && minutes >= 2 && input.currentViewers > 0) {
    insights.push({
      id: 'chat-quiet',
      artKey: 'engagement',
      tone: 'fair',
      title: 'Chat is quiet',
      detail: 'Ask a question, drop a sticker prompt, or start Game Center to spark replies.',
    });
  }

  if (coinsPerMinute >= 20 || giftPerViewer >= 15) {
    insights.push({
      id: 'gifts-strong',
      artKey: 'earnings',
      tone: 'excellent',
      title: 'Gift flow is strong',
      detail: `≈${Math.round(coinsPerMinute)} coins/min · $${input.cashUsd.toFixed(2)} convertible so far.`,
    });
  } else if (input.giftCount === 0 && minutes >= 3 && input.currentViewers > 0) {
    insights.push({
      id: 'gifts-cold',
      artKey: 'earnings',
      tone: 'fair',
      title: 'No gifts yet',
      detail: 'Pin a product, thank early gifters, or open Lucky gifts to seed momentum.',
    });
  }

  if (networkScore >= 80) {
    insights.push({
      id: 'network-good',
      artKey: 'network',
      tone: 'good',
      title: 'Stream health looks solid',
      detail: `Quality ${input.connectionQuality || 'good'} with stable uplink telemetry.`,
    });
  } else if (networkScore < 45) {
    insights.push({
      id: 'network-weak',
      artKey: 'network',
      tone: 'critical',
      title: 'Network needs attention',
      detail: 'Move closer to Wi‑Fi, lower beauty load, or reduce guest cams if packet loss spikes.',
    });
  }

  if (input.seated >= 2) {
    insights.push({
      id: 'guests-active',
      artKey: 'audience',
      tone: 'good',
      title: 'Guests on stage',
      detail: `${input.seated} seated · ${input.seatRequests} waiting — keep the co-host energy going.`,
    });
  }

  if (!insights.length) {
    insights.push({
      id: 'warming',
      artKey: 'insights',
      tone: 'good',
      title: 'Live is warming up',
      detail: 'Metrics update in realtime as viewers, chat, gifts, and stream health change.',
    });
  }

  return {
    overallScore: Math.round(overallScore),
    overallHealth,
    overallSummary: `${input.currentViewers} live · ${input.giftCount} gifts · ${Math.round(input.coinsReceived).toLocaleString()} coins`,
    audienceScore: Math.round(audienceScore),
    engagementScore: Math.round(engagementScore),
    earningsScore: Math.round(earningsScore),
    networkScore: Math.round(networkScore),
    retentionPct: Math.round(retentionPct),
    giftPerViewer: Number(giftPerViewer.toFixed(1)),
    likePerViewer: Number(likePerViewer.toFixed(1)),
    commentPerViewer: Number(commentPerViewer.toFixed(2)),
    coinsPerMinute: Number(coinsPerMinute.toFixed(1)),
    pillars,
    insights: insights.slice(0, 5),
  };
}
