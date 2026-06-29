export type DatingState = {
  likedUserIds: string[];
  passedUserIds: string[];
  matchedUserIds: string[];
  unmatchedUserIds: string[];
  preferences: {
    minAge: number;
    maxAge: number;
    maxDistanceKm: number;
    intents: string[];
  };
  usage: {
    dayKey: string;
    superLikesUsed: number;
  };
  subscription: {
    tier: 'free' | 'plus' | 'gold';
  };
  profile: {
    prompts: Array<{ question: string; answer: string }>;
    mediaUrls: string[];
    verified: boolean;
  };
  reports: Array<{ userId: string; reason: string; createdAt: number }>;
  matchMeta: Record<
    string,
    {
      matchedAt: number;
      lastActivityAt: number;
      expiresAt: number;
    }
  >;
  learnedSignals: {
    preferredAvgAge: number | null;
    preferredAvgDistanceKm: number | null;
    likesCount: number;
    passesCount: number;
  };
  rankingTuning: {
    distanceWeight: number;
    affinityWeight: number;
    profileQualityWeight: number;
    completenessWeight: number;
    learningWeight: number;
  };
  experiment: {
    mode: 'auto' | 'A' | 'B' | 'C';
    assignments: Record<string, 'A' | 'B' | 'C'>;
    metrics: Record<
      'A' | 'B' | 'C',
      {
        exposures: number;
        likes: number;
        passes: number;
        matches: number;
      }
    >;
    events: Array<{
      bucket: 'A' | 'B' | 'C';
      kind: 'exposure' | 'like' | 'pass' | 'match';
      at: number;
    }>;
    stability: {
      cooldownMinutes: number;
      minHoldMinutes: number;
      minExposurePerBucket: number;
      confidenceThreshold: number;
      minDelta: number;
    };
    presetAudit: {
      lastPreset: 'conservative' | 'balanced' | 'aggressive' | null;
      lastAppliedAt: number | null;
      lastAppliedBy: string | null;
    };
  };
};

export const EMPTY_DATING_STATE: DatingState = {
  likedUserIds: [],
  passedUserIds: [],
  matchedUserIds: [],
  unmatchedUserIds: [],
  preferences: {
    minAge: 21,
    maxAge: 39,
    maxDistanceKm: 80,
    intents: [],
  },
  usage: {
    dayKey: '',
    superLikesUsed: 0,
  },
  subscription: {
    tier: 'free',
  },
  profile: {
    prompts: [],
    mediaUrls: [],
    verified: false,
  },
  reports: [],
  matchMeta: {},
  learnedSignals: {
    preferredAvgAge: null,
    preferredAvgDistanceKm: null,
    likesCount: 0,
    passesCount: 0,
  },
  rankingTuning: {
    distanceWeight: 1,
    affinityWeight: 1,
    profileQualityWeight: 1,
    completenessWeight: 1,
    learningWeight: 1,
  },
  experiment: {
    mode: 'auto',
    assignments: {},
    metrics: {
      A: { exposures: 0, likes: 0, passes: 0, matches: 0 },
      B: { exposures: 0, likes: 0, passes: 0, matches: 0 },
      C: { exposures: 0, likes: 0, passes: 0, matches: 0 },
    },
    events: [],
    stability: {
      cooldownMinutes: 20,
      minHoldMinutes: 60,
      minExposurePerBucket: 30,
      confidenceThreshold: 0.95,
      minDelta: 0.02,
    },
    presetAudit: {
      lastPreset: null,
      lastAppliedAt: null,
      lastAppliedBy: null,
    },
  },
};

export function normalizeDatingState(raw: DatingState): DatingState {
  const toArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? Array.from(new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0)))
      : [];
  return {
    likedUserIds: toArray(raw?.likedUserIds),
    passedUserIds: toArray(raw?.passedUserIds),
    matchedUserIds: toArray(raw?.matchedUserIds),
    unmatchedUserIds: toArray(raw?.unmatchedUserIds),
    preferences: {
      minAge: Math.max(18, Math.min(60, Number(raw?.preferences?.minAge) || EMPTY_DATING_STATE.preferences.minAge)),
      maxAge: Math.max(18, Math.min(60, Number(raw?.preferences?.maxAge) || EMPTY_DATING_STATE.preferences.maxAge)),
      maxDistanceKm: Math.max(
        5,
        Math.min(200, Number(raw?.preferences?.maxDistanceKm) || EMPTY_DATING_STATE.preferences.maxDistanceKm)
      ),
      intents: toArray(raw?.preferences?.intents),
    },
    usage: {
      dayKey: typeof raw?.usage?.dayKey === 'string' ? raw.usage.dayKey : '',
      superLikesUsed: Math.max(0, Number(raw?.usage?.superLikesUsed) || 0),
    },
    subscription: {
      tier: raw?.subscription?.tier === 'plus' || raw?.subscription?.tier === 'gold' ? raw.subscription.tier : 'free',
    },
    profile: {
      prompts: Array.isArray(raw?.profile?.prompts)
        ? raw.profile.prompts
            .filter(
              (item): item is { question: string; answer: string } =>
                Boolean(item) &&
                typeof item.question === 'string' &&
                typeof item.answer === 'string' &&
                item.question.length > 0 &&
                item.answer.length > 0
            )
            .slice(0, 3)
        : [],
      mediaUrls: toArray(raw?.profile?.mediaUrls).slice(0, 6),
      verified: Boolean(raw?.profile?.verified),
    },
    reports: Array.isArray(raw?.reports)
      ? raw.reports
          .filter(
            (item): item is { userId: string; reason: string; createdAt: number } =>
              Boolean(item) &&
              typeof item.userId === 'string' &&
              typeof item.reason === 'string' &&
              typeof item.createdAt === 'number'
          )
          .slice(-200)
      : [],
    matchMeta:
      raw?.matchMeta && typeof raw.matchMeta === 'object'
        ? Object.fromEntries(
            Object.entries(raw.matchMeta).filter(
              ([key, value]) =>
                typeof key === 'string' &&
                Boolean(value) &&
                typeof value === 'object' &&
                typeof (value as { matchedAt?: unknown }).matchedAt === 'number' &&
                typeof (value as { lastActivityAt?: unknown }).lastActivityAt === 'number' &&
                typeof (value as { expiresAt?: unknown }).expiresAt === 'number'
            )
          )
        : {},
    learnedSignals: {
      preferredAvgAge:
        typeof raw?.learnedSignals?.preferredAvgAge === 'number' ? raw.learnedSignals.preferredAvgAge : null,
      preferredAvgDistanceKm:
        typeof raw?.learnedSignals?.preferredAvgDistanceKm === 'number'
          ? raw.learnedSignals.preferredAvgDistanceKm
          : null,
      likesCount: Math.max(0, Number(raw?.learnedSignals?.likesCount) || 0),
      passesCount: Math.max(0, Number(raw?.learnedSignals?.passesCount) || 0),
    },
    rankingTuning: {
      distanceWeight: Math.max(0, Math.min(2, Number(raw?.rankingTuning?.distanceWeight) || 1)),
      affinityWeight: Math.max(0, Math.min(2, Number(raw?.rankingTuning?.affinityWeight) || 1)),
      profileQualityWeight: Math.max(0, Math.min(2, Number(raw?.rankingTuning?.profileQualityWeight) || 1)),
      completenessWeight: Math.max(0, Math.min(2, Number(raw?.rankingTuning?.completenessWeight) || 1)),
      learningWeight: Math.max(0, Math.min(2, Number(raw?.rankingTuning?.learningWeight) || 1)),
    },
    experiment: {
      mode:
        raw?.experiment?.mode === 'A' || raw?.experiment?.mode === 'B' || raw?.experiment?.mode === 'C'
          ? raw.experiment.mode
          : 'auto',
      assignments:
        raw?.experiment?.assignments && typeof raw.experiment.assignments === 'object'
          ? Object.fromEntries(
              Object.entries(raw.experiment.assignments).filter(
                ([key, value]) => typeof key === 'string' && (value === 'A' || value === 'B' || value === 'C')
              )
            )
          : {},
      metrics: {
        A: {
          exposures: Math.max(0, Number(raw?.experiment?.metrics?.A?.exposures) || 0),
          likes: Math.max(0, Number(raw?.experiment?.metrics?.A?.likes) || 0),
          passes: Math.max(0, Number(raw?.experiment?.metrics?.A?.passes) || 0),
          matches: Math.max(0, Number(raw?.experiment?.metrics?.A?.matches) || 0),
        },
        B: {
          exposures: Math.max(0, Number(raw?.experiment?.metrics?.B?.exposures) || 0),
          likes: Math.max(0, Number(raw?.experiment?.metrics?.B?.likes) || 0),
          passes: Math.max(0, Number(raw?.experiment?.metrics?.B?.passes) || 0),
          matches: Math.max(0, Number(raw?.experiment?.metrics?.B?.matches) || 0),
        },
        C: {
          exposures: Math.max(0, Number(raw?.experiment?.metrics?.C?.exposures) || 0),
          likes: Math.max(0, Number(raw?.experiment?.metrics?.C?.likes) || 0),
          passes: Math.max(0, Number(raw?.experiment?.metrics?.C?.passes) || 0),
          matches: Math.max(0, Number(raw?.experiment?.metrics?.C?.matches) || 0),
        },
      },
      events: Array.isArray(raw?.experiment?.events)
        ? raw.experiment.events
            .filter(
              (
                item
              ): item is {
                bucket: 'A' | 'B' | 'C';
                kind: 'exposure' | 'like' | 'pass' | 'match';
                at: number;
              } =>
                Boolean(item) &&
                (item.bucket === 'A' || item.bucket === 'B' || item.bucket === 'C') &&
                (item.kind === 'exposure' ||
                  item.kind === 'like' ||
                  item.kind === 'pass' ||
                  item.kind === 'match') &&
                typeof item.at === 'number'
            )
            .slice(-3000)
        : [],
      stability: {
        cooldownMinutes: Math.max(5, Math.min(180, Number(raw?.experiment?.stability?.cooldownMinutes) || 20)),
        minHoldMinutes: Math.max(15, Math.min(24 * 60, Number(raw?.experiment?.stability?.minHoldMinutes) || 60)),
        minExposurePerBucket: Math.max(
          8,
          Math.min(2000, Number(raw?.experiment?.stability?.minExposurePerBucket) || 30)
        ),
        confidenceThreshold: Math.max(
          0.5,
          Math.min(0.999, Number(raw?.experiment?.stability?.confidenceThreshold) || 0.95)
        ),
        minDelta: Math.max(0, Math.min(0.2, Number(raw?.experiment?.stability?.minDelta) || 0.02)),
      },
      presetAudit: {
        lastPreset:
          raw?.experiment?.presetAudit?.lastPreset === 'conservative' ||
          raw?.experiment?.presetAudit?.lastPreset === 'balanced' ||
          raw?.experiment?.presetAudit?.lastPreset === 'aggressive'
            ? raw.experiment.presetAudit.lastPreset
            : null,
        lastAppliedAt:
          typeof raw?.experiment?.presetAudit?.lastAppliedAt === 'number'
            ? raw.experiment.presetAudit.lastAppliedAt
            : null,
        lastAppliedBy:
          typeof raw?.experiment?.presetAudit?.lastAppliedBy === 'string'
            ? raw.experiment.presetAudit.lastAppliedBy
            : null,
      },
    },
  };
}
