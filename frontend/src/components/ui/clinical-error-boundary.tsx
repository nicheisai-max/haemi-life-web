import { Component, ErrorInfo, ReactNode } from 'react';
import { Activity } from 'lucide-react';
import { logger } from '../../utils/logger';

interface Props {
    readonly children: ReactNode;
    readonly name?: string;
    readonly fallback?: ReactNode;
}

interface State {
    readonly hasError: boolean;
}

/**
 * ClinicalErrorBoundary Component
 * Institutional-grade safety layer for high-fidelity clinical widgets.
 * Prevents cascading dashboard failures and ensures forensic logging of render crashes.
 * Standards: Google/Meta-grade TypeScript, Strict Immutability, Institutional Logging.
 */
export class ClinicalErrorBoundary extends Component<Props, State> {
    public override state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        // Institutional State Update: Transition to fallback UI
        return { hasError: true };
    }

    public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Forensic Audit Trail: Log the exact stack trace for incident remediation
        logger.error(`[ClinicalErrorBoundary] Crash in module: ${this.props.name || 'Anonymous'}`, {
            error: error.message,
            stack: errorInfo.componentStack,
        });
    }

    public override render(): ReactNode {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="flex flex-col items-center justify-center p-8 min-h-[250px] space-y-4 bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <div className="relative">
                        <Activity className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                        <div className="absolute -inset-1 bg-rose-500/10 rounded-full animate-ping opacity-20" />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            Diagnostic Module Unavailable
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 italic max-w-[200px]">
                            Forensic log registered. Practice intelligence is recalibrating this module.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
