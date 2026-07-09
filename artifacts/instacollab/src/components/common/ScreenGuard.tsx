import React, { Suspense } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { instantSuspenseFallback } from '../../lib/instantCachePolicy';

type ScreenGuardProps = {
  /** Screen id for logging and isolated error recovery */
  screen: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

/** Suspense + per-screen error boundary — isolates failures across tabs/screens. */
export function ScreenGuard({ screen, children, fallback }: ScreenGuardProps) {
  return (
    <ErrorBoundary screen={screen}>
      <Suspense fallback={fallback ?? instantSuspenseFallback()}>{children}</Suspense>
    </ErrorBoundary>
  );
}
