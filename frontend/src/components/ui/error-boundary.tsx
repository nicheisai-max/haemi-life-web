import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger, auditLogger } from '@/utils/logger';
import { Card } from './card';
import { Button } from './button';
import { Logo } from './logo';

interface Props {
  children?: ReactNode;
  onReset?: () => void;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('[ERROR_BOUNDARY] Uncaught error:', error, errorInfo);
    
    auditLogger.log('UNHANDLED_ERROR', {
      message: error.message,
      details: {
        stack: error.stack,
        componentStack: errorInfo.componentStack
      }
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900">
          <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-2xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl">
            <div className="flex justify-center">
              <Logo className="h-12 w-auto" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Institutional Access Interrupted
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                A critical system exception has been logged. Our clinical integrity guards have intercepted the drift.
              </p>
            </div>

            <div className="p-4 bg-slate-100 dark:bg-slate-900/50 rounded-[var(--card-radius)] text-left border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Error Code</div>
              <code className="text-xs font-mono text-teal-600 dark:text-teal-400 break-all">
                {this.state.error?.message || 'UNKNOWN_EXC_001'}
              </code>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                onClick={this.handleReset}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20 h-12"
              >
                Restore System State
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => window.location.href = '/'}
                className="w-full text-slate-500 hover:text-slate-900 dark:hover:text-white h-12"
              >
                Return to Gateway
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
