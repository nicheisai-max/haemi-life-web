import React, { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastContext } from './toast-context-def';
import type { ToastType, Toast } from './toast-context-def';

interface ToastProviderProps {
    children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const [toasts, setToasts] = React.useState<Toast[]>([]);

    const removeToast = React.useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    // 🔒 INSTITUTIONAL UX LOCK: Minimum 5s visibility for all messages
    const MIN_TOAST_DURATION = 5000;

    const showToast = React.useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        const finalDuration =
            typeof duration === 'number' && duration > MIN_TOAST_DURATION
                ? duration
                : MIN_TOAST_DURATION;

        const id = crypto.randomUUID();
        const newToast: Toast = { id, message, type, duration: finalDuration };

        setToasts(prev => [...prev, newToast]);

        if (finalDuration > 0) {
            const timeoutId = window.setTimeout(() => {
                removeToast(id);
            }, finalDuration);

            // optional cleanup safety
            return () => window.clearTimeout(timeoutId);
        }
    }, [removeToast]);

    const success = React.useCallback((message: string, duration?: number) => {
        showToast(message, 'success', duration);
    }, [showToast]);

    const error = React.useCallback((message: string, duration?: number) => {
        showToast(message, 'error', duration);
    }, [showToast]);

    const warning = React.useCallback((message: string, duration?: number) => {
        showToast(message, 'warning', duration);
    }, [showToast]);

    const info = React.useCallback((message: string, duration?: number) => {
        showToast(message, 'info', duration);
    }, [showToast]);

    // Phase 4: Institutional Safety Layer - Global Error Listener
    React.useEffect(() => {
        const handleSystemError: EventListener = (e) => {
            const { message } = (e as CustomEvent<{ message?: string }>).detail;
            error(message || 'A critical system error occurred.');
        };

        window.addEventListener('system:error', handleSystemError);
        return () => window.removeEventListener('system:error', handleSystemError);
    }, [error]);

    const getIcon = (type: ToastType): React.ReactElement => {
        switch (type) {
            case 'success':
                return <CheckCircle2 className="h-5 w-5 text-green-600" />;
            case 'error':
                return <XCircle className="h-5 w-5 text-red-600" />;
            case 'warning':
                return <AlertTriangle className="h-5 w-5 text-amber-600" />;
            case 'info':
            default:
                return <Info className="h-5 w-5 text-blue-600" />;
        }
    };

    const getToastStyles = (type: ToastType) => {
        switch (type) {
            case 'success': return 'border-green-600';
            case 'error': return 'border-red-600';
            case 'warning': return 'border-amber-600';
            case 'info': default: return 'border-blue-600';
        }
    };

    return (
        <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
            {children}
            <div className="fixed top-24 right-4 z-[var(--z-toast)] flex flex-col gap-3 w-full max-w-[400px] pointer-events-none sm:right-4 sm:left-auto max-sm:left-2 max-sm:right-2 max-sm:w-auto">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <motion.div
                            key={toast.id}
                            layout
                            initial={{ opacity: 0, x: 50, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 20, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className={`flex items-center gap-3 p-4 bg-background rounded-[var(--card-radius)] shadow-lg border-l-4 cursor-pointer pointer-events-auto hover:opacity-95 ${getToastStyles(toast.type)}`}
                            onClick={() => removeToast(toast.id)}
                        >
                            <div className="flex-shrink-0 flex items-center justify-center">
                                {getIcon(toast.type)}
                            </div>
                            <span className="flex-1 text-sm font-medium text-foreground leading-snug">{toast.message}</span>
                            <button
                                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-sm hover:bg-muted text-muted-foreground transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeToast(toast.id);
                                }}
                                aria-label="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};
