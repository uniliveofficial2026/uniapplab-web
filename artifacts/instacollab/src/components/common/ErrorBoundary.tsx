import React from 'react';
import {
  chunkLoadUserMessage,
  invalidHookUserMessage,
  isChunkLoadError,
  isFirestoreStorageQuotaError,
  isRecoverableRenderError,
} from '../../lib/lazyWithRetry';
import { refreshCloudSystemsInPlace } from '../../lib/appCloudSystems';
import { stageAppUpdate } from '../../lib/invisibleReload';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  screen?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  recovering: boolean;
}

/**
 * Soft recover only — hard location.reload() caused blank-screen loops during HMR/dev.
 */
function softRecoverHint(): void {
  if (typeof window === 'undefined') return;
  try {
    refreshCloudSystemsInPlace('render-soft-recover');
  } catch {
    /* ignore */
  }
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '', recovering: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : 'Something went wrong';
    if (isFirestoreStorageQuotaError(error) || isFirestoreStorageQuotaError(raw)) {
      return { hasError: true, message: raw, recovering: true };
    }
    if (isRecoverableRenderError(error) || isRecoverableRenderError(raw)) {
      return { hasError: true, message: invalidHookUserMessage(), recovering: true };
    }
    const message = isChunkLoadError(error) || isChunkLoadError(raw) ? chunkLoadUserMessage() : raw;
    return { hasError: true, message, recovering: false };
  }

  private handleRetry = () => {
    if (isChunkLoadError(this.state.message)) {
      stageAppUpdate('chunk-retry');
      refreshCloudSystemsInPlace('chunk-retry');
    } else if (this.state.recovering) {
      softRecoverHint();
    }
    this.setState({ hasError: false, message: '', recovering: false });
  };

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    const label = this.props.screen ? `[${this.props.screen}]` : '';
    console.error(`UI error boundary${label}:`, error, info.componentStack);

    if (isFirestoreStorageQuotaError(error) || isFirestoreStorageQuotaError(this.state.message)) {
      void import('../../lib/firebase/app')
        .then((m) => m.purgeFirestoreWebStorage())
        .catch(() => {
          /* ignore */
        });
      this.setState({ recovering: true });
      window.setTimeout(() => {
        this.setState({ hasError: false, message: '', recovering: false });
      }, 50);
      return;
    }

    // Auto soft-retry once for HMR/hook desync — never hard-reload (that blanks the app).
    if (this.state.recovering) {
      window.setTimeout(() => {
        this.setState({ hasError: false, message: '', recovering: false });
      }, 50);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      // Still recovering — keep a painted shell, not a white void.
      if (this.state.recovering) {
        return (
          <div className="flex min-h-[40vh] w-full flex-1 items-center justify-center bg-background">
            <div className="h-9 w-9 animate-pulse rounded-full bg-muted/80" />
          </div>
        );
      }
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 bg-background p-6 text-center text-foreground">
          <p className="text-lg font-bold">Something went wrong</p>
          {this.props.screen ? (
            <p className="text-xs text-muted-foreground">Screen: {this.props.screen}</p>
          ) : null}
          <p className="max-w-md text-sm text-muted-foreground">{this.state.message}</p>
          <button
            type="button"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            onClick={this.handleRetry}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
