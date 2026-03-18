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
                <div style={{
                    height: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-body)',
                    padding: '2rem'
                }}>
                    <Card style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
                        <Logo size="lg" className="mb-4 mx-auto" />
                        <h1 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>Something went wrong</h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                            We've encountered an unexpected error. Don't worry, your data is safe.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <Button variant="default" onClick={this.handleReset} className="w-[140px]">
                                Back to Safety
                            </Button>
                            <Button variant="outline" onClick={() => {
                                sessionStorage.clear();
                                localStorage.removeItem('token'); 
                                window.location.reload();
                            }} className="w-[140px]">
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
