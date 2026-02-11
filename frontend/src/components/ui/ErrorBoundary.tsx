import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Logo } from './Logo';

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
                <div style={{
                    height: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-body)',
                    padding: '2rem'
                }}>
                    <Card style={{ maxWidth: '500px', textAlign: 'center', padding: '3rem' }}>
                        <Logo size="lg" className="mb-6 mx-auto" />
                        <AlertTriangle style={{
                            fontSize: '4rem',
                            color: 'var(--color-error)',
                            marginBottom: '1.5rem'
                        }} />
                        <h1 style={{ marginBottom: '1rem' }}>Something went wrong</h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                            We've encountered an unexpected error. Don't worry, your data is safe.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <Button variant="default" onClick={this.handleReset}>
                                Back to Safety
                            </Button>
                            <Button variant="outline" onClick={() => window.location.reload()}>
                                Try Reloading
                            </Button>
                        </div>
                        {process.env.NODE_ENV === 'development' && (
                            <details style={{ marginTop: '2rem', textAlign: 'left', fontSize: '0.8rem' }}>
                                <summary>Error Details (Dev Only)</summary>
                                <pre style={{ overflow: 'auto', marginTop: '1rem', color: 'var(--color-error)' }}>
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
