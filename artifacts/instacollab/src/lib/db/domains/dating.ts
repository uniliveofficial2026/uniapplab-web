import type { User } from '../../../types';
import type { DatingLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';
import {
  importDatingExperimentPayload,
  type ExperimentImportOutcome,
  type ImportMergeMode,
} from './datingExperimentPersistence';
import {
  EMPTY_DATING_STATE,
  normalizeDatingState,
  type DatingState,
} from './datingState';
import {
  computeAutoExperimentBucket,
  computeRecommendationScore,
  getPseudoAge,
  getPseudoDistance,
  matchesPreferences as matchesDatingPreferences,
  shouldAutoMatch as shouldAutoMatchBySeed,
} from './datingRanking';
import {
  buildExperimentPresetAudit,
  getExperimentPresetStability,
  type ExperimentPresetName,
  normalizeExperimentStabilityPatch,
} from './datingExperimentControls';
import {
  buildExperimentExportPayload,
  buildExperimentCsv,
  clampWindowHours,
  evaluateWinnerWithStability,
  type ExperimentExportPayload,
  type ExperimentWinner,
  summarizeEventsForRange,
} from './datingExperimentUtils';

/** One exposure count per profile per page session (avoids HMR / remount loops). */
const datingExposureSeen = new Set<string>();
let datingExposureQueue: string[] = [];
let datingExposureFlushTimer: ReturnType<typeof setTimeout> | null = null;
const DATING_EXPOSURE_FLUSH_MS = 450;

export function WithDating<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, DatingLayer> {
  return class extends Base {
    get datingState(): DatingState {
      const raw = this.load<DatingState>('dating_state', EMPTY_DATING_STATE);
      return normalizeDatingState(raw);
    }

    getDatingCandidates(limit = 40): User[] {
      const localDb = this.asLocalDB();
      const meId = localDb.currentUserId;
      if (!meId) return [];
      const state = this.datingState;
      const hidden = new Set<string>([
        ...state.likedUserIds,
        ...state.passedUserIds,
        ...state.matchedUserIds,
        ...state.unmatchedUserIds,
        meId,
      ]);
      const preferences = state.preferences;
      const pool = localDb.users
        .filter((u) => u?.id && !hidden.has(u.id))
        .filter((u) => matchesDatingPreferences(u, preferences));
      const scoreUser = this.createRecommendationScorer(state, meId);
      return pool
        .map((user) => {
          try {
            return { user, score: scoreUser(user) };
          } catch {
            return { user, score: 0 };
          }
        })
        .sort((a, b) => b.score - a.score)
        .map((item) => item.user)
        .slice(0, Math.max(1, limit));
    }

    private saveDatingState(next: DatingState) {
      this.save('dating_state', {
        likedUserIds: Array.from(new Set(next.likedUserIds)),
        passedUserIds: Array.from(new Set(next.passedUserIds)),
        matchedUserIds: Array.from(new Set(next.matchedUserIds)),
        unmatchedUserIds: Array.from(new Set(next.unmatchedUserIds)),
        preferences: next.preferences,
        usage: next.usage,
        subscription: next.subscription,
        profile: next.profile,
        reports: next.reports,
        matchMeta: next.matchMeta,
        learnedSignals: next.learnedSignals,
        rankingTuning: next.rankingTuning,
        experiment: next.experiment,
      });
    }

    private getPseudoAge(user: User): number {
      return getPseudoAge(user);
    }

    private getPseudoDistance(user: User): number {
      return getPseudoDistance(user);
    }

    private matchesPreferences(user: User): boolean {
      return matchesDatingPreferences(user, this.datingState.preferences);
    }

    private computeAutoExperimentBucket(userId: string): 'A' | 'B' | 'C' {
      return computeAutoExperimentBucket(`${this.asLocalDB().currentUserId}:${userId}`);
    }

    private getExperimentBucketForUser(userId: string): 'A' | 'B' | 'C' {
      const state = this.datingState;
      const assigned = state.experiment.assignments[userId];
      if (assigned) return assigned;
      if (state.experiment.mode !== 'auto') return state.experiment.mode;
      return this.computeAutoExperimentBucket(userId);
    }

    private getRecommendationScore(user: User): number {
      return this.createRecommendationScorer(this.datingState, this.asLocalDB().currentUserId)(user);
    }

    private createRecommendationScorer(state: DatingState, meId: string): (user: User) => number {
      if (!meId) return () => 0;
      const localDb = this.asLocalDB();
      const followerIds = new Set(localDb.getFollowerIds(meId));
      const followingIds = new Set(localDb.getFollowingIds(meId));
      const completenessCache = new Map<string, number>();
      const forcedMode = state.experiment.mode;
      const assignments = state.experiment.assignments;
      const computeBucket = (userId: string): 'A' | 'B' | 'C' => {
        const assigned = assignments[userId];
        if (assigned) return assigned;
        if (forcedMode !== 'auto') return forcedMode;
        return computeAutoExperimentBucket(`${meId}:${userId}`);
      };
      return (user: User) => {
        let profileCompleteness = completenessCache.get(user.id);
        if (profileCompleteness === undefined) {
          profileCompleteness = this.getDatingProfileCompleteness(user.id);
          completenessCache.set(user.id, profileCompleteness);
        }
        const bucket = computeBucket(user.id);
        try {
          return computeRecommendationScore({
            user,
            followerIds,
            followingIds,
            profileCompleteness,
            learnedSignals: {
              preferredAvgAge: state.learnedSignals.preferredAvgAge,
              preferredAvgDistanceKm: state.learnedSignals.preferredAvgDistanceKm,
            },
            bucket,
            baseTuning: state.rankingTuning,
          });
        } catch {
          return 0;
        }
      };
    }

    private updateLearnedSignalsForSwipe(userId: string, action: 'like' | 'pass'): void {
      const state = this.datingState;
      const user = this.asLocalDB().users.find((u) => u.id === userId);
      if (!user) return;
      const age = this.getPseudoAge(user);
      const distance = this.getPseudoDistance(user);
      const isLike = action === 'like';
      const prevCount = isLike ? state.learnedSignals.likesCount : state.learnedSignals.passesCount;
      const nextCount = prevCount + 1;
      const currentAge = state.learnedSignals.preferredAvgAge ?? age;
      const currentDistance = state.learnedSignals.preferredAvgDistanceKm ?? distance;
      const nextAge = isLike ? (currentAge * prevCount + age) / nextCount : currentAge;
      const nextDistance = isLike ? (currentDistance * prevCount + distance) / nextCount : currentDistance;
      this.saveDatingState({
        ...state,
        learnedSignals: {
          preferredAvgAge: nextAge,
          preferredAvgDistanceKm: nextDistance,
          likesCount: isLike ? nextCount : state.learnedSignals.likesCount,
          passesCount: isLike ? state.learnedSignals.passesCount : nextCount,
        },
      });
    }

    markDatingExposure(userId: string): void {
      if (!userId) return;
      if (datingExposureSeen.has(userId)) return;
      datingExposureSeen.add(userId);
      datingExposureQueue.push(userId);
      if (datingExposureFlushTimer != null) return;
      datingExposureFlushTimer = setTimeout(() => {
        datingExposureFlushTimer = null;
        this.flushDatingExposureQueue();
      }, DATING_EXPOSURE_FLUSH_MS);
    }

    private flushDatingExposureQueue(): void {
      const queue = datingExposureQueue;
      datingExposureQueue = [];
      if (queue.length === 0) return;

      const state = this.datingState;
      let events = state.experiment.events;
      let metrics = { ...state.experiment.metrics };
      let assignments = { ...state.experiment.assignments };

      for (const userId of queue) {
        const bucket =
          assignments[userId] ??
          (state.experiment.mode !== 'auto' ? state.experiment.mode : this.computeAutoExperimentBucket(userId));
        if (!assignments[userId]) {
          assignments = { ...assignments, [userId]: bucket };
        }
        const currentBucketMetrics = metrics[bucket];
        metrics = {
          ...metrics,
          [bucket]: {
            ...currentBucketMetrics,
            exposures: currentBucketMetrics.exposures + 1,
          },
        };
        events = [
          ...events,
          { bucket, kind: 'exposure' as const, at: Date.now() },
        ].slice(-3000);
      }

      this.saveDatingState({
        ...state,
        experiment: {
          ...state.experiment,
          assignments,
          metrics,
          events,
        },
      });
    }

    private trackDatingOutcome(userId: string, outcome: 'like' | 'pass' | 'match'): void {
      const state = this.datingState;
      const bucket = this.getExperimentBucketForUser(userId);
      const currentBucketMetrics = state.experiment.metrics[bucket];
      const nextBucketMetrics = {
        ...currentBucketMetrics,
        likes: outcome === 'like' ? currentBucketMetrics.likes + 1 : currentBucketMetrics.likes,
        passes: outcome === 'pass' ? currentBucketMetrics.passes + 1 : currentBucketMetrics.passes,
        matches: outcome === 'match' ? currentBucketMetrics.matches + 1 : currentBucketMetrics.matches,
      };
      this.saveDatingState({
        ...state,
        experiment: {
          ...state.experiment,
          assignments: state.experiment.assignments[userId]
            ? state.experiment.assignments
            : { ...state.experiment.assignments, [userId]: bucket },
          metrics: {
            ...state.experiment.metrics,
            [bucket]: nextBucketMetrics,
          },
          events: [
            ...state.experiment.events,
            { bucket, kind: outcome as 'like' | 'pass' | 'match', at: Date.now() },
          ].slice(-3000),
        },
      });
    }

    private shouldAutoMatch(userId: string): boolean {
      const meId = this.asLocalDB().currentUserId;
      if (!meId || !userId) return false;
      return shouldAutoMatchBySeed(`${meId}:${userId}`, userId, this.asLocalDB().getFollowerIds(meId));
    }

    likeDatingProfile(userId: string): { ok: boolean; matched: boolean } {
      if (!userId || userId === this.asLocalDB().currentUserId) return { ok: false, matched: false };
      const state = this.datingState;
      const next: DatingState = {
        likedUserIds: state.likedUserIds.filter((id) => id !== userId),
        passedUserIds: state.passedUserIds.filter((id) => id !== userId),
        matchedUserIds: [...state.matchedUserIds],
        unmatchedUserIds: state.unmatchedUserIds.filter((id) => id !== userId),
        preferences: state.preferences,
        usage: state.usage,
        subscription: state.subscription,
        profile: state.profile,
        reports: state.reports,
        matchMeta: state.matchMeta,
        learnedSignals: state.learnedSignals,
        rankingTuning: state.rankingTuning,
        experiment: state.experiment,
      };
      const isMatch = this.shouldAutoMatch(userId);
      this.updateLearnedSignalsForSwipe(userId, 'like');
      if (isMatch) {
        this.trackDatingOutcome(userId, 'match');
        next.matchedUserIds.push(userId);
        const now = Date.now();
        next.matchMeta[userId] = {
          matchedAt: now,
          lastActivityAt: now,
          expiresAt: now + 1000 * 60 * 60 * 24 * 14,
        };
        const actor = this.asLocalDB().users.find((u) => u.id === userId);
        this.asLocalDB().pushNotificationForUser(this.asLocalDB().currentUserId, {
          type: 'mention',
          actorUserId: userId,
          title: "It's a match!",
          text: actor ? `${actor.username} liked you back` : 'You have a new match',
          targetTab: 'dating',
          link: `dating:${userId}`,
        });
      } else {
        this.trackDatingOutcome(userId, 'like');
        next.likedUserIds.push(userId);
      }
      this.saveDatingState(next);
      return { ok: true, matched: isMatch };
    }

    passDatingProfile(userId: string): { ok: boolean } {
      if (!userId || userId === this.asLocalDB().currentUserId) return { ok: false };
      const state = this.datingState;
      this.saveDatingState({
        likedUserIds: state.likedUserIds.filter((id) => id !== userId),
        passedUserIds: [...state.passedUserIds.filter((id) => id !== userId), userId],
        matchedUserIds: state.matchedUserIds.filter((id) => id !== userId),
        unmatchedUserIds: state.unmatchedUserIds.filter((id) => id !== userId),
        preferences: state.preferences,
        usage: state.usage,
        subscription: state.subscription,
        profile: state.profile,
        reports: state.reports,
        matchMeta: Object.fromEntries(Object.entries(state.matchMeta).filter(([key]) => key !== userId)),
        learnedSignals: state.learnedSignals,
        rankingTuning: state.rankingTuning,
        experiment: state.experiment,
      });
      this.updateLearnedSignalsForSwipe(userId, 'pass');
      this.trackDatingOutcome(userId, 'pass');
      return { ok: true };
    }

    undoDatingAction(userId: string): { ok: boolean } {
      if (!userId || userId === this.asLocalDB().currentUserId) return { ok: false };
      const state = this.datingState;
      this.saveDatingState({
        likedUserIds: state.likedUserIds.filter((id) => id !== userId),
        passedUserIds: state.passedUserIds.filter((id) => id !== userId),
        matchedUserIds: state.matchedUserIds.filter((id) => id !== userId),
        unmatchedUserIds: state.unmatchedUserIds.filter((id) => id !== userId),
        preferences: state.preferences,
        usage: state.usage,
        subscription: state.subscription,
        profile: state.profile,
        reports: state.reports,
        matchMeta: Object.fromEntries(Object.entries(state.matchMeta).filter(([key]) => key !== userId)),
        learnedSignals: state.learnedSignals,
        rankingTuning: state.rankingTuning,
        experiment: state.experiment,
      });
      return { ok: true };
    }

    getDatingLikesYou(limit = 30): User[] {
      const localDb = this.asLocalDB();
      const meId = localDb.currentUserId;
      if (!meId) return [];
      const followers = new Set(localDb.getFollowerIds(meId));
      const state = this.datingState;
      const hidden = new Set([
        ...state.passedUserIds,
        ...state.matchedUserIds,
        ...state.unmatchedUserIds,
        meId,
      ]);
      return localDb.users
        .filter((u) => followers.has(u.id) && !hidden.has(u.id))
        .filter((u) => this.matchesPreferences(u))
        .slice(0, Math.max(1, limit));
    }

    getDatingTopPicks(limit = 10): User[] {
      return this.getDatingCandidates(100).slice(0, Math.max(1, limit));
    }

    setDatingPreferences(patch: Partial<DatingState['preferences']>): void {
      const state = this.datingState;
      const nextPrefs = {
        minAge: Math.max(18, Math.min(60, Number(patch.minAge ?? state.preferences.minAge))),
        maxAge: Math.max(18, Math.min(60, Number(patch.maxAge ?? state.preferences.maxAge))),
        maxDistanceKm: Math.max(
          5,
          Math.min(200, Number(patch.maxDistanceKm ?? state.preferences.maxDistanceKm))
        ),
        intents: Array.isArray(patch.intents)
          ? Array.from(new Set(patch.intents.filter((item): item is string => typeof item === 'string')))
          : state.preferences.intents,
      };
      if (nextPrefs.minAge > nextPrefs.maxAge) {
        nextPrefs.maxAge = nextPrefs.minAge;
      }
      this.saveDatingState({
        ...state,
        preferences: nextPrefs,
      });
    }

    consumeDatingSuperLike(limit = 5): { ok: boolean; remaining: number } {
      const state = this.datingState;
      const allowanceLimit = state.subscription.tier === 'gold' ? 10 : state.subscription.tier === 'plus' ? 7 : limit;
      const today = new Date().toISOString().slice(0, 10);
      const normalized =
        state.usage.dayKey === today
          ? state.usage
          : {
              dayKey: today,
              superLikesUsed: 0,
            };
      if (normalized.superLikesUsed >= allowanceLimit) {
        return { ok: false, remaining: 0 };
      }
      const nextUsage = {
        dayKey: today,
        superLikesUsed: normalized.superLikesUsed + 1,
      };
      this.saveDatingState({
        ...state,
        usage: nextUsage,
      });
      return { ok: true, remaining: Math.max(0, allowanceLimit - nextUsage.superLikesUsed) };
    }

    unmatchDatingProfile(userId: string): { ok: boolean } {
      if (!userId || userId === this.asLocalDB().currentUserId) return { ok: false };
      const state = this.datingState;
      this.saveDatingState({
        ...state,
        matchedUserIds: state.matchedUserIds.filter((id) => id !== userId),
        unmatchedUserIds: [...state.unmatchedUserIds.filter((id) => id !== userId), userId],
        matchMeta: Object.fromEntries(Object.entries(state.matchMeta).filter(([key]) => key !== userId)),
      });
      return { ok: true };
    }

    setDatingSubscriptionTier(tier: 'free' | 'plus' | 'gold'): void {
      const state = this.datingState;
      this.saveDatingState({
        ...state,
        subscription: { tier },
      });
    }

    updateDatingProfile(payload: {
      prompts?: Array<{ question: string; answer: string }>;
      mediaUrls?: string[];
      verified?: boolean;
    }): void {
      const state = this.datingState;
      const nextProfile = {
        prompts:
          Array.isArray(payload.prompts) && payload.prompts.length > 0
            ? payload.prompts
                .filter((item) => item.question.trim().length > 0 && item.answer.trim().length > 0)
                .slice(0, 3)
            : state.profile.prompts,
        mediaUrls:
          Array.isArray(payload.mediaUrls) && payload.mediaUrls.length > 0
            ? payload.mediaUrls.filter((url) => typeof url === 'string' && url.length > 0).slice(0, 6)
            : state.profile.mediaUrls,
        verified: typeof payload.verified === 'boolean' ? payload.verified : state.profile.verified,
      };
      this.saveDatingState({
        ...state,
        profile: nextProfile,
      });
    }

    reportDatingProfile(userId: string, reason: string): { ok: boolean } {
      if (!userId || userId === this.asLocalDB().currentUserId || !reason.trim()) return { ok: false };
      const state = this.datingState;
      const nextReports = [
        ...state.reports.filter((item) => item.userId !== userId),
        { userId, reason: reason.trim(), createdAt: Date.now() },
      ];
      this.saveDatingState({
        ...state,
        reports: nextReports.slice(-200),
        passedUserIds: [...state.passedUserIds.filter((id) => id !== userId), userId],
      });
      return { ok: true };
    }

    canRevealDatingLikesYou(): boolean {
      return this.datingState.subscription.tier === 'plus' || this.datingState.subscription.tier === 'gold';
    }

    getDatingConversationStarter(userId: string): string {
      const meId = this.asLocalDB().currentUserId || '';
      const target = this.asLocalDB().users.find((item) => item.id === userId);
      const starters = [
        `Hey @${target?.username ?? 'there'}, what are you building lately?`,
        'Glad we matched! What are you most excited about this week?',
        'You seem awesome — coffee chat or quick voice call sometime?',
      ];
      const seed = Math.abs(
        (userId + meId).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
      );
      return starters[seed % starters.length];
    }

    touchDatingMatchActivity(userId: string): void {
      const state = this.datingState;
      if (!state.matchedUserIds.includes(userId)) return;
      const now = Date.now();
      const current = state.matchMeta[userId];
      const nextMeta = {
        ...state.matchMeta,
        [userId]: {
          matchedAt: current?.matchedAt ?? now,
          lastActivityAt: now,
          expiresAt: now + 1000 * 60 * 60 * 24 * 14,
        },
      };
      this.saveDatingState({
        ...state,
        matchMeta: nextMeta,
      });
    }

    getDatingMatchMeta(userId: string): { matchedAt: number; lastActivityAt: number; expiresAt: number } | null {
      const state = this.datingState;
      const meta = state.matchMeta[userId];
      if (!meta) return null;
      return meta;
    }

    pruneExpiredDatingMatches(): number {
      const state = this.datingState;
      const now = Date.now();
      const expiredIds = state.matchedUserIds.filter((id) => {
        const meta = state.matchMeta[id];
        return Boolean(meta) && meta.expiresAt <= now;
      });
      if (expiredIds.length === 0) return 0;
      const expiredSet = new Set(expiredIds);
      const nextMeta = Object.fromEntries(
        Object.entries(state.matchMeta).filter(([key]) => !expiredSet.has(key))
      );
      this.saveDatingState({
        ...state,
        matchedUserIds: state.matchedUserIds.filter((id) => !expiredSet.has(id)),
        unmatchedUserIds: [...state.unmatchedUserIds, ...expiredIds],
        matchMeta: nextMeta,
      });
      return expiredIds.length;
    }

    getDatingReengagementNudges(limit = 5): User[] {
      const now = Date.now();
      const staleMs = 1000 * 60 * 60 * 24 * 3;
      const state = this.datingState;
      const staleIds = state.matchedUserIds
        .filter((id) => {
          const meta = state.matchMeta[id];
          return meta && now - meta.lastActivityAt >= staleMs;
        })
        .slice(0, limit);
      const staleSet = new Set(staleIds);
      return this.asLocalDB().users.filter((u) => staleSet.has(u.id));
    }

    getDatingProfileCompleteness(userId?: string): number {
      const targetId = userId || this.asLocalDB().currentUserId;
      if (targetId === this.asLocalDB().currentUserId) {
        const profile = this.datingState.profile;
        let score = 0;
        if (profile.prompts.length >= 1) score += 35;
        if (profile.prompts.length >= 2) score += 15;
        if (profile.mediaUrls.length >= 2) score += 25;
        if (profile.mediaUrls.length >= 4) score += 10;
        if (profile.verified) score += 15;
        return Math.min(100, score);
      }
      const user = this.asLocalDB().users.find((item) => item.id === targetId);
      if (!user) return 0;
      let score = 0;
      if (user.avatarUrl) score += 40;
      if (user.bio && user.bio.length > 20) score += 40;
      if (user.isVerified) score += 20;
      return score;
    }

    getDatingMatches(): User[] {
      this.pruneExpiredDatingMatches();
      const ids = this.datingState.matchedUserIds;
      const idSet = new Set(ids);
      return this.asLocalDB().users.filter((u) => idSet.has(u.id));
    }

    clearDatingState() {
      datingExposureSeen.clear();
      datingExposureQueue = [];
      if (datingExposureFlushTimer != null) {
        clearTimeout(datingExposureFlushTimer);
        datingExposureFlushTimer = null;
      }
      this.saveDatingState(EMPTY_DATING_STATE);
    }

    setDatingRankingTuning(patch: Partial<DatingState['rankingTuning']>): void {
      const state = this.datingState;
      const clamp = (value: number | undefined, fallback: number) =>
        Math.max(0, Math.min(2, typeof value === 'number' ? value : fallback));
      this.saveDatingState({
        ...state,
        rankingTuning: {
          distanceWeight: clamp(patch.distanceWeight, state.rankingTuning.distanceWeight),
          affinityWeight: clamp(patch.affinityWeight, state.rankingTuning.affinityWeight),
          profileQualityWeight: clamp(
            patch.profileQualityWeight,
            state.rankingTuning.profileQualityWeight
          ),
          completenessWeight: clamp(
            patch.completenessWeight,
            state.rankingTuning.completenessWeight
          ),
          learningWeight: clamp(patch.learningWeight, state.rankingTuning.learningWeight),
        },
      });
    }

    setDatingExperimentMode(mode: 'auto' | 'A' | 'B' | 'C'): void {
      const state = this.datingState;
      this.saveDatingState({
        ...state,
        experiment: {
          ...state.experiment,
          mode,
        },
      });
    }

    getDatingExperimentSummary(): DatingState['experiment']['metrics'] {
      return this.datingState.experiment.metrics;
    }

    resetDatingExperimentMetrics(): void {
      const state = this.datingState;
      this.saveDatingState({
        ...state,
        experiment: {
          ...state.experiment,
          metrics: {
            A: { exposures: 0, likes: 0, passes: 0, matches: 0 },
            B: { exposures: 0, likes: 0, passes: 0, matches: 0 },
            C: { exposures: 0, likes: 0, passes: 0, matches: 0 },
          },
          events: [],
        },
      });
    }

    getDatingExperimentSummaryForWindow(hours: number): DatingState['experiment']['metrics'] {
      const safeHours = clampWindowHours(hours);
      const since = Date.now() - safeHours * 60 * 60 * 1000;
      const until = Date.now();
      return summarizeEventsForRange(this.datingState.experiment.events, since, until);
    }

    getDatingExperimentAnalytics(hours: number): {
      summary: DatingState['experiment']['metrics'];
      winner: ExperimentWinner;
    } {
      const summary = this.getDatingExperimentSummaryForWindow(hours);
      const winner = evaluateWinnerWithStability({
        now: Date.now(),
        windowHours: hours,
        events: this.datingState.experiment.events,
        stability: this.datingState.experiment.stability,
        precomputedSummary: summary,
      });
      return { summary, winner };
    }

    getDatingExperimentWinner(hours: number): {
      bucket: 'A' | 'B' | 'C' | null;
      reason: string;
      score: number;
      confidence: number;
      status:
        | 'insufficient_data'
        | 'not_significant'
        | 'significant'
        | 'cooldown_locked'
        | 'hold_locked';
      minExposureRequired: number;
      observedDelta: number;
    } {
      return evaluateWinnerWithStability({
        now: Date.now(),
        windowHours: hours,
        events: this.datingState.experiment.events,
        stability: this.datingState.experiment.stability,
      });
    }

    setDatingExperimentStability(patch: {
      cooldownMinutes?: number;
      minHoldMinutes?: number;
      minExposurePerBucket?: number;
      confidenceThreshold?: number;
      minDelta?: number;
    }): void {
      const state = this.datingState;
      this.saveDatingState({
        ...state,
        experiment: {
          ...state.experiment,
          stability: normalizeExperimentStabilityPatch(patch, state.experiment.stability),
        },
      });
    }

    applyDatingExperimentPreset(preset: 'conservative' | 'balanced' | 'aggressive'): void {
      this.setDatingExperimentStability(getExperimentPresetStability(preset as ExperimentPresetName));
      const state = this.datingState;
      this.saveDatingState({
        ...state,
        experiment: {
          ...state.experiment,
          presetAudit: buildExperimentPresetAudit({
            preset,
            now: Date.now(),
            actorUserId: this.asLocalDB().currentUserId || null,
          }),
        },
      });
    }

    getDatingExperimentExport(hours: number): ExperimentExportPayload {
      const state = this.datingState;
      return buildExperimentExportPayload({
        now: Date.now(),
        windowHours: hours,
        actorUserId: this.asLocalDB().currentUserId || null,
        mode: state.experiment.mode,
        stability: state.experiment.stability,
        presetAudit: state.experiment.presetAudit,
        events: state.experiment.events,
      });
    }

    getDatingExperimentEventsCsv(hours: number): string {
      const payload = this.getDatingExperimentExport(hours);
      return buildExperimentCsv(payload);
    }

    importDatingExperimentExport(
      payload: unknown,
      mode: 'replace' | 'append' = 'append'
    ): {
      ok: boolean;
      importedEvents: number;
      message: string;
      schemaVersionUsed: number | null;
      migratedFrom: number | null;
    } {
      const state = this.datingState;
      const result: ExperimentImportOutcome = importDatingExperimentPayload(
        payload,
        mode as ImportMergeMode,
        {
          mode: state.experiment.mode,
          stability: state.experiment.stability,
          presetAudit: state.experiment.presetAudit,
          events: state.experiment.events,
        }
      );
      if (!result.ok) {
        return result;
      }
      this.saveDatingState({
        ...state,
        experiment: {
          ...state.experiment,
          mode: result.nextExperiment.mode,
          stability: result.nextExperiment.stability,
          presetAudit: result.nextExperiment.presetAudit,
          events: result.nextExperiment.events,
          metrics: result.nextExperiment.metrics,
        },
      });
      return {
        ok: result.ok,
        importedEvents: result.importedEvents,
        message: result.message,
        schemaVersionUsed: result.schemaVersionUsed,
        migratedFrom: result.migratedFrom,
      };
    }
  } as unknown as MixinCtor<T, DatingLayer>;
}

