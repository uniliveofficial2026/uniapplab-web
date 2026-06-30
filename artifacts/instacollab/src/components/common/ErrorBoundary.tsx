import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return { hasError: true, message };
  }

  private handleRetry = () => {
    if (/out of date after a deploy/i.test(this.state.message)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, message: '' });
  };

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('UI error boundary:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-lg font-bold text-foreground">Something went wrong</p>
          <p className="max-w-md text-sm text-muted-foreground">{this.state.message}</p>
          <button
            type="button"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            onClick={this.handleRetry}
          >
            {/out of date after a deploy/i.test(this.state.message) ? 'Reload app' : 'Try again'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
