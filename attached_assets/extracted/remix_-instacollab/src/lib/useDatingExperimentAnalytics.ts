import { useEffect, useState } from 'react';
import { db } from './db/localDb';
import { useDbRevision } from './useDB';
import {
  EMPTY_EXPERIMENT_METRICS,
  type ExperimentWinner,
} from './db/domains/datingExperimentUtils';
import type { DatingState } from './db/domains/datingState';

const EMPTY_WINNER: ExperimentWinner = {
  bucket: null,
  reason: 'Experiment analytics unavailable',
  score: 0,
  confidence: 0,
  status: 'insufficient_data',
  minExposureRequired: 0,
  observedDelta: 0,
};

type Analytics = {
  summary: DatingState['experiment']['metrics'];
  winner: ExperimentWinner;
};

export function useDatingExperimentAnalytics(
  windowHours: 24 | 72 | 168,
  enabled: boolean
): { analytics: Analytics | null; loading: boolean } {
  const revision = useDbRevision();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setAnalytics(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(() => {
      try {
        const result = db.getDatingExperimentAnalytics(windowHours);
        if (!cancelled) {
          setAnalytics(result);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setAnalytics({
            summary: EMPTY_EXPERIMENT_METRICS,
            winner: EMPTY_WINNER,
          });
          setLoading(false);
        }
      }
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, windowHours, revision]);

  return { analytics, loading };
}
