import React from 'react';
import {
  chunkLoadUserMessage,
  invalidHookUserMessage,
  isChunkLoadError,
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

const RENDER_RECOVERY_KEY = 'instacollab-render-recovery';

function recoverFromStaleRender(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const last = Number(sessionStorage.getItem(RENDER_RECOVERY_KEY) || '0');
    if (Date.now() - last < 15_000) return false;
    sessionStorage.setItem(RENDER_RECOVERY_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  window.location.reload();
  return true;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '', recovering: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : 'Something went wrong';
    if (isRecoverableRenderError(error) || isRecoverableRenderError(raw)) {
      return { hasError: true, message: invalidHookUserMessage(), recovering: true };
    }
    const message = isChunkLoadError(error) || isChunkLoadError(raw) ? chunkLoadUserMessage() : raw;
    return { hasError: true, message, recovering: false };
  }

  private handleRetry = () => {
    if (isChunkLoadError(this.state.message) || this.state.recovering) {
      stageAppUpdate(this.state.recovering ? 'render-retry' : 'chunk-retry');
      refreshCloudSystemsInPlace(this.state.recovering ? 'render-retry' : 'chunk-retry');
      if (this.state.recovering) {
        recoverFromStaleRender();
        return;
      }
      this.setState({ hasError: false, message: '', recovering: false });
      return;
    }
    this.setState({ hasError: false, message: '', recovering: false });
  };

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    const label = this.props.screen ? `[${this.props.screen}]` : '';
    console.error(`UI error boundary${label}:`, error, info.componentStack);

    if (isRecoverableRenderError(error) || this.state.recovering) {
      recoverFromStaleRender();
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-lg font-bold text-foreground">Something went wrong</p>
          {this.props.screen ? (
            <p className="text-xs text-muted-foreground">Screen: {this.props.screen}</p>
          ) : null}
          <p className="max-w-md text-sm text-muted-foreground">{this.state.message}</p>
          <button
            type="button"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            onClick={this.handleRetry}
          >
            {isChunkLoadError(this.state.message) || this.state.recovering ? 'Reload app' : 'Try again'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
