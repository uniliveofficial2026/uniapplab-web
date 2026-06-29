import { useMemo } from 'react';
import type { User } from '../types';
import { db } from './db/localDb';
import { useDbRevision } from './useDB';

/** Stable deck inputs — avoids `db.datingState` object identity in useMemo deps. */
function buildDatingDeckFingerprint(): string {
  const s = db.datingState;
  const prefs = s.preferences;
  return [
    db.currentUserId ?? '',
    db.users.length,
    s.likedUserIds.join(','),
    s.passedUserIds.join(','),
    s.matchedUserIds.join(','),
    s.unmatchedUserIds.join(','),
    prefs.minAge,
    prefs.maxAge,
    prefs.maxDistanceKm,
    [...prefs.intents].sort().join(','),
    s.rankingTuning.distanceWeight,
    s.rankingTuning.affinityWeight,
    s.rankingTuning.profileQualityWeight,
    s.rankingTuning.completenessWeight,
    s.rankingTuning.learningWeight,
  ].join('|');
}

function buildMatchFingerprint(): string {
  return db.datingState.matchedUserIds.join(',');
}

export function useDatingCandidates(limit = 32): User[] {
  const revision = useDbRevision();
  const fingerprint = useMemo(() => buildDatingDeckFingerprint(), [revision]);

  return useMemo(() => {
    try {
      return db.getDatingCandidates(limit);
    } catch {
      return [];
    }
  }, [fingerprint, limit]);
}

export function useDatingMatches(): User[] {
  const revision = useDbRevision();
  const fingerprint = useMemo(() => buildMatchFingerprint(), [revision]);

  return useMemo(() => {
    try {
      return db.getDatingMatches();
    } catch {
      return [];
    }
  }, [fingerprint]);
}

export function useDatingLikesYou(limit = 40): User[] {
  const revision = useDbRevision();
  const deckFingerprint = useMemo(() => buildDatingDeckFingerprint(), [revision]);
  const tier = db.datingState.subscription.tier;

  return useMemo(() => {
    try {
      return db.getDatingLikesYou(limit);
    } catch {
      return [];
    }
  }, [deckFingerprint, tier, limit]);
}
