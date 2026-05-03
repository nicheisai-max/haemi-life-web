import React, { useState, useEffect, type ReactNode } from 'react';
import { WifiOff, SignalLow, ServerCrash } from 'lucide-react';
import { NetworkStatusContext } from './network-status-def';

interface NavigatorWithConnection extends Navigator {
    connection?: {
        effectiveType?: string;
        addEventListener: (type: string, listener: EventListener) => void;
        removeEventListener: (type: string, listener: EventListener) => void;
    };
}

interface NetworkStatusProviderProps {
    children: ReactNode;
}

/**
 * Custom-event channel name used by `api.ts` (axios circuit breaker) and
 * `socket.service.ts` (realtime reconnection logic) to notify the UI
 * layer that the Haemi backend is intermittently unreachable. The
 * NetworkStatusProvider listens for both events and toggles
 * `isBackendReachable` in context — keeping the actual UI render
 * decoupled from the failure-detection mechanism. New emitters can join
 * this channel without touching the provider.
 */
const BACKEND_DOWN_EVENT = 'haemi:backend-down';
const BACKEND_RECOVERED_EVENT = 'haemi:backend-recovered';

export const NetworkStatusProvider: React.FC<NetworkStatusProviderProps> = ({ children }) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSlowConnection, setIsSlowConnection] = useState(false);
    const [isBackendReachable, setIsBackendReachable] = useState(true);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check connection speed (basic detection)
        if ('connection' in navigator) {
            const connection = (navigator as NavigatorWithConnection).connection;
            if (connection) {
                const checkConnection = () => {
                    if (connection.effectiveType) {
                        // 'slow-2g', '2g', '3g', '4g'
                        setIsSlowConnection(['slow-2g', '2g'].includes(connection.effectiveType));
                    }
                };

                checkConnection();
                connection.addEventListener('change', checkConnection);

                return () => {
                    window.removeEventListener('online', handleOnline);
                    window.removeEventListener('offline', handleOffline);
                    connection.removeEventListener('change', checkConnection);
                };
            }
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    /**
     * Application-layer backend reachability tracker. Reacts to events
     * emitted by `api.ts` (circuit breaker transitions) and
     * `socket.service.ts` (sustained reconnection failures) without
     * requiring direct coupling to those modules. State flips back to
     * reachable on any successful recovery signal.
     */
    useEffect(() => {
        const handleBackendDown: EventListener = () => setIsBackendReachable(false);
        const handleBackendRecovered: EventListener = () => setIsBackendReachable(true);

        window.addEventListener(BACKEND_DOWN_EVENT, handleBackendDown);
        window.addEventListener(BACKEND_RECOVERED_EVENT, handleBackendRecovered);

        return () => {
            window.removeEventListener(BACKEND_DOWN_EVENT, handleBackendDown);
            window.removeEventListener(BACKEND_RECOVERED_EVENT, handleBackendRecovered);
        };
    }, []);

    return (
        <NetworkStatusContext.Provider value={{ isOnline, isSlowConnection, isBackendReachable }}>
            {children}
            {!isOnline && (
                <div className="fixed top-0 left-0 right-0 z-[10000] flex items-center justify-center gap-3 p-3 text-sm font-medium bg-red-600 text-white animate-in slide-in-from-top-full duration-300">
                    <WifiOff className="h-5 w-5" />
                    <span>You are offline. Some features may not work.</span>
                </div>
            )}
            {isOnline && isSlowConnection && (
                <div className="fixed top-0 left-0 right-0 z-[10000] flex items-center justify-center gap-3 p-3 text-sm font-medium bg-amber-500 text-black animate-in slide-in-from-top-full duration-300">
                    <SignalLow className="h-5 w-5" />
                    <span>Slow connection detected. Low data mode recommended.</span>
                </div>
            )}
            {/*
              Backend-unreachable banner. Shown only when the device IS
              online (so it doesn't stack on top of the WifiOff banner)
              AND the application-layer health signal has flipped to
              unreachable. Uses the brand semantic tokens
              `--destructive` / `--destructive-foreground` so light + dark
              themes auto-resolve from the index.css variable layer —
              visually equivalent to the existing red `bg-red-600` banner
              above (`#DC2626` ≡ Tailwind `red-600`) but binds to the
              brand token system properly. The ServerCrash icon
              differentiates the cause from a device-level outage so the
              user understands "their network is fine, our service is
              not" — distinct mental model.
            */}
            {isOnline && !isBackendReachable && (
                <div className="fixed top-0 left-0 right-0 z-[10000] flex items-center justify-center gap-3 p-3 text-sm font-medium bg-destructive text-destructive-foreground animate-in slide-in-from-top-full duration-300">
                    <ServerCrash className="h-5 w-5" />
                    <span>Connection to Haemi servers interrupted. Retrying automatically.</span>
                </div>
            )}
        </NetworkStatusContext.Provider>
    );
};
