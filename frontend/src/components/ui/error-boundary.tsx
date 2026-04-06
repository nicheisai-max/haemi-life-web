import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Logo } from './logo';

interface Props {
    children?: ReactNode;
    onReset?: () => void;
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
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false });
        if (this.props.onReset) {
            this.props.onReset();
        } else {
            window.location.href = '/dashboard';
        }
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary-root">
                    <Card className="error-boundary-card">
                        <Logo size="lg" className="mb-4 mx-auto" />
                        <h1 className="error-boundary-title">Something went wrong</h1>
                        <p className="error-boundary-text">
                            We've encountered an unexpected error. Don't worry, your data is safe.
                        </p>
                        <div className="error-boundary-actions">
                            <Button variant="default" onClick={this.handleReset} className="error-boundary-btn">
                                Back to Safety
                            </Button>
                            <Button variant="outline" onClick={() => {
                                sessionStorage.clear();
                                localStorage.removeItem('token'); 
                                window.location.reload();
                            }} className="error-boundary-btn">
                                Try Reloading
                            </Button>
                        </div>
                        {process.env.NODE_ENV === 'development' && (
                            <details className="error-boundary-dev-details">
                                <summary>Error Details (Dev Only)</summary>
                                <pre className="error-boundary-pre">
                                    {this.state.error?.toString()}
                                </pre>
                            </details>
                        )}
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}
