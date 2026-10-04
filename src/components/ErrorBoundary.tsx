import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 bg-rose-50 border border-rose-200 rounded-2xl shadow-xs text-rose-900 max-w-2xl mx-auto my-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-rose-100 rounded-2xl text-rose-600">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-rose-950">
                {this.props.fallbackTitle || 'Cooperative Dashboard Component Error'}
              </h3>
              <p className="text-xs text-rose-700 font-medium">
                An unexpected error occurred while rendering this section. The rest of the application remains functional.
              </p>
            </div>
          </div>
          {this.state.error && (
            <div className="p-3 bg-rose-900/10 rounded-xl font-mono text-xs text-rose-900 mb-4 overflow-x-auto">
              {this.state.error.toString()}
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold font-mono uppercase rounded-xl transition-colors cursor-pointer inline-flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Try Reloading View
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
