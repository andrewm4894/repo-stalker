import { Component, type ErrorInfo, type ReactNode } from "react";

declare global {
  interface Window {
    posthog?: {
      captureException?: (error: unknown, properties?: Record<string, unknown>) => void;
    };
  }
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
    try {
      window.posthog?.captureException?.(error, {
        source: "react-error-boundary",
        component_stack: info.componentStack,
      });
    } catch (e) {
      console.error("Failed to report error to PostHog:", e);
    }
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        role="alert"
        className="min-h-screen flex items-center justify-center bg-background text-foreground p-6"
      >
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground text-sm">
            An unexpected error occurred. The issue has been reported.
          </p>
          {this.state.error?.message && (
            <pre className="text-xs text-left bg-muted p-3 rounded overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.reset}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}