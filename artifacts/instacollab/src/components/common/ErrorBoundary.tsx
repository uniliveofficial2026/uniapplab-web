import React from 'react';
import { chunkLoadUserMessage, isChunkLoadError } from '../../lib/lazyWithRetry';
import { reactToMlIssue } from '../../lib/mlReact';
import { stageAppUpdate } from '../../lib/invisibleReload';
import { checkForPwaUpdate } from '../../lib/pwaAutoUpdate';
import { trackUx } from '../../lib/uxTelemetry';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  screen?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : 'Something went wrong';
    const message = isChunkLoadError(error) || isChunkLoadError(raw) ? chunkLoadUserMessage() : raw;
    return { hasError: true, message };
  }

  private handleRetry = () => {
    if (isChunkLoadError(this.state.message)) {
      void checkForPwaUpdate();
      stageAppUpdate('boundary_chunk');
    }
    this.setState({ hasError: false, message: '' });
  };

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    const label = this.props.screen ? `[${this.props.screen}]` : '';
    console.error(`UI error boundary${label}:`, error, info.componentStack);

    const msg = error instanceof Error ? error.message : String(error);
    trackUx('error', msg.slice(0, 300), { boundary: true, stack: info.componentStack?.slice(0, 120) ?? '' });
    reactToMlIssue('boundary_error', msg, this.props.screen);

    if (isChunkLoadError(error)) {
      void checkForPwaUpdate();
      stageAppUpdate('boundary_chunk');
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
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
