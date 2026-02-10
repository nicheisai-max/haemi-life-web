import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import './NetworkStatus.css';

interface NetworkStatusContextValue {
    isOnline: boolean;
    isSlowConnection: boolean;
}

const NetworkStatusContext = createContext<NetworkStatusContextValue>({
    isOnline: true,
    isSlowConnection: false,
});

export const useNetworkStatus = () => useContext(NetworkStatusContext);

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
            const connection = (navigator as any).connection;
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

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <NetworkStatusContext.Provider value={{ isOnline, isSlowConnection }}>
            {children}
            {!isOnline && (
                <div className="network-status offline">
                    <span className="material-icons-outlined">wifi_off</span>
                    <span>You are offline. Some features may not work.</span>
                </div>
            )}
            {isOnline && isSlowConnection && (
                <div className="network-status slow">
                    <span className="material-icons-outlined">signal_cellular_alt_1_bar</span>
                    <span>Slow connection detected. Low data mode recommended.</span>
                </div>
            )}
        </NetworkStatusContext.Provider>
    );
};
