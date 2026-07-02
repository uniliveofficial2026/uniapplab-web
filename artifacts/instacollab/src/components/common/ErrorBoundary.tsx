import React from 'react';
import { chunkLoadUserMessage, isChunkLoadError } from '../../lib/lazyWithRetry';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Screen name for logging and isolated recovery */
  screen?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  retryCount: number;
}

const MAX_AUTO_RETRIES = 1;

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  state: ErrorBoundaryState = { hasError: false, message: '', retryCount: 0 };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    const raw = error instanceof Error ? error.message : 'Something went wrong';
    const message = isChunkLoadError(error) || isChunkLoadError(raw) ? chunkLoadUserMessage() : raw;
    return { hasError: true, message };
  }

  private handleRetry = () => {
    if (isChunkLoadError(this.state.message)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, message: '', retryCount: 0 });
  };

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    const label = this.props.screen ? `[${this.props.screen}]` : '';
    console.error(`UI error boundary${label}:`, error, info.componentStack);

    if (
      !isChunkLoadError(error) &&
      this.state.retryCount < MAX_AUTO_RETRIES &&
      !this.retryTimer
    ) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.setState((prev) => ({
          hasError: false,
          message: '',
          retryCount: prev.retryCount + 1,
        }));
      }, 500);
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
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
            {isChunkLoadError(this.state.message) ? 'Reload app' : 'Try again'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
