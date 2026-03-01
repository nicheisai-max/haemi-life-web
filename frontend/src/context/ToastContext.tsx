import React, { createContext, useContext, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';


type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

interface ToastProviderProps {
    children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const [toasts, setToasts] = React.useState<Toast[]>([]);

    const removeToast = React.useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const showToast = React.useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        const newToast: Toast = { id, message, type, duration };

        setToasts(prev => [...prev, newToast]);

        if (duration > 0) {
            setTimeout(() => removeToast(id), duration);
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
        const handleSystemError = (e: any) => {
            const { message } = e.detail;
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
            <div className="fixed top-24 right-4 z-[100] flex flex-col gap-3 w-full max-w-[400px] pointer-events-none sm:right-4 sm:left-auto max-sm:left-2 max-sm:right-2 max-sm:w-auto">
                <AnimatePresence mode="popLayout">
                    {toasts.map(toast => (
                        <motion.div
                            key={toast.id}
                            layout
                            initial={{ opacity: 0, x: 50, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 20, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className={`flex items-center gap-3 p-4 bg-background rounded-xl shadow-lg border-l-4 cursor-pointer pointer-events-auto hover:opacity-95 ${getToastStyles(toast.type)}`}
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
