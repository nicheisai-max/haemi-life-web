import React, { type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastContext } from './toast-context-def';
import type { ToastType, Toast } from './toast-context-def';
import { isPublicAuthRoute } from '../routes/paths';
import { useAuth } from '../hooks/use-auth';
import { logger } from '../utils/logger';

interface ToastProviderProps {
    children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const [toasts, setToasts] = React.useState<Toast[]>([]);
    const { pathname } = useLocation();
    const { isAuthenticated } = useAuth();

    /**
     * 🔒 AUTH-SURFACE TOAST SUPPRESSION
     *
     * No toast (success, error, warning, info) may render while the user
     * is on a public/auth route (login, signup, forgot-password,
     * onboarding, root identity-gate) OR while the session is in an
     * unauthenticated state. This prevents the prior-session-leak bug
     * where an in-flight async handler from a just-logged-out role
     * fires a `system:error` / `useToast().error(…)` after the route
     * has already transitioned to `/login`, surfacing a doctor-role
     * (or any role-specific) message to the next user who is about to
     * sign in. The gate is enforced HERE rather than at every call
     * site so individual components remain dumb — `useToast()` and
     * `system:*` CustomEvents continue to be the only public API.
     *
     * Single source of truth for the route list lives in
     * `routes/paths.ts` via `isPublicAuthRoute(pathname)` — no
     * hardcoded path strings here.
     */
    const shouldSuppress: boolean = !isAuthenticated || isPublicAuthRoute(pathname);

    /**
     * Mirror `shouldSuppress` into a ref so `showToast`'s `useCallback`
     * closure can read the latest value without listing it in the dep
     * array. Without this, every consumer that lists `showToast` in its
     * own deps would re-run on every navigation — the function would
     * change identity each time the suppress flag flipped. The ref
     * pattern keeps `showToast` referentially stable while still
     * honoring the live suppression state.
     */
    const shouldSuppressRef = React.useRef<boolean>(shouldSuppress);
    React.useEffect(() => {
        shouldSuppressRef.current = shouldSuppress;
    }, [shouldSuppress]);

    /**
     * When the user enters a suppressed state, drain any toasts that
     * were already on screen. Covers the timing window where a toast
     * was queued just before the route flipped to `/login` — the
     * setState completed but the render hadn't, so without this
     * cleanup the user would still see one frame of leftover content.
     */
    React.useEffect(() => {
        if (shouldSuppress) setToasts([]);
    }, [shouldSuppress]);

    const removeToast = React.useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    // 🔒 INSTITUTIONAL UX LOCK: Minimum 5s visibility for all messages
    const MIN_TOAST_DURATION = 5000;

    const showToast = React.useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        if (shouldSuppressRef.current) {
            // Caller fired a toast on a public/auth surface or while
            // unauthenticated. Drop silently — `logger.debug` keeps the
            // signal available for forensics without surfacing anything
            // to the user.
            logger.debug('[ToastProvider] Suppressed toast on auth surface', { message, type });
            return;
        }

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
            // Defensive narrowing: the event detail crosses a custom-event
            // boundary so its shape is not statically known. Treat it as
            // `unknown`, structurally check the message field, and fall
            // through to the safe default if the payload is malformed —
            // strict-TS posture without a double-cast.
            const detail: unknown = (e as CustomEvent<unknown>).detail;
            const message: string | undefined =
                typeof detail === 'object'
                && detail !== null
                && typeof (detail as { message?: unknown }).message === 'string'
                    ? (detail as { message: string }).message
                    : undefined;
            error(message ?? 'A critical system error occurred.');
        };

        window.addEventListener('system:error', handleSystemError);
        return () => window.removeEventListener('system:error', handleSystemError);
    }, [error]);

    // Symmetric success channel — mirrors `system:error` so admin
    // mutations (screening reorder, doctor verify, user status update) can
    // dispatch a single CustomEvent and surface a consistent toast UX
    // without each call site importing and using the toast context
    // directly. Detail shape: `{ message: string }`. Other shapes are
    // ignored after a structural check (no double-cast).
    React.useEffect(() => {
        const handleSystemSuccess: EventListener = (e) => {
            const detail: unknown = (e as CustomEvent<unknown>).detail;
            const message: string | undefined =
                typeof detail === 'object'
                && detail !== null
                && typeof (detail as { message?: unknown }).message === 'string'
                    ? (detail as { message: string }).message
                    : undefined;
            if (message === undefined) {
                logger.warn('[ToastProvider] system:success dispatched without a string message; ignoring');
                return;
            }
            success(message);
        };

        window.addEventListener('system:success', handleSystemSuccess);
        return () => window.removeEventListener('system:success', handleSystemSuccess);
    }, [success]);

    // Symmetric warning channel — completes the success/error/warning trio
    // so non-blocking advisory signals (e.g. doctor's appointment overdue
    // nudge from the backend cron) can fire a single CustomEvent without
    // every call site importing the toast context. Detail shape:
    // `{ message: string }`. Malformed payloads are logged and ignored —
    // never `console.*`, always `logger`.
    React.useEffect(() => {
        const handleSystemWarning: EventListener = (e) => {
            const detail: unknown = (e as CustomEvent<unknown>).detail;
            const message: string | undefined =
                typeof detail === 'object'
                && detail !== null
                && typeof (detail as { message?: unknown }).message === 'string'
                    ? (detail as { message: string }).message
                    : undefined;
            if (message === undefined) {
                logger.warn('[ToastProvider] system:warning dispatched without a string message; ignoring');
                return;
            }
            warning(message);
        };

        window.addEventListener('system:warning', handleSystemWarning);
        return () => window.removeEventListener('system:warning', handleSystemWarning);
    }, [warning]);

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
