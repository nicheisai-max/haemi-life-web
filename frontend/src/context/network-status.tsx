import React, { useState, useEffect, type ReactNode } from 'react';
import { WifiOff, SignalLow } from 'lucide-react';
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

export const NetworkStatusProvider: React.FC<NetworkStatusProviderProps> = ({ children }) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSlowConnection, setIsSlowConnection] = useState(false);

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

    return (
        <NetworkStatusContext.Provider value={{ isOnline, isSlowConnection }}>
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
        </NetworkStatusContext.Provider>
    );
};
