import React, { Suspense } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { ScreenFallback } from './ScreenFallback';
import { AppScreen } from '../layout/AppScreen';

type ScreenGuardProps = {
  /** Screen id for logging and isolated error recovery */
  screen: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /**
   * Edge-to-edge fill (default). Interactive chrome should use safe-area utilities.
   * Set false only when a screen must inset L/R content itself via AppScreen defaults.
   */
  immersive?: boolean;
};

/**
 * Suspense + per-screen error boundary + fullscreen AppScreen frame.
 * Every tab/route goes through this so the whole app is edge-to-edge and null-crash isolated.
 */
export function ScreenGuard({
  screen,
  children,
  fallback,
  immersive = true,
}: ScreenGuardProps) {
  return (
    <ErrorBoundary screen={screen}>
      <Suspense fallback={fallback ?? <ScreenFallback />}>
        <AppScreen
          immersive={immersive}
          className="min-h-0 flex-1 w-full max-w-full"
          data-screen={screen}
        >
          {children ?? null}
        </AppScreen>
      </Suspense>
    </ErrorBoundary>
  );
}
