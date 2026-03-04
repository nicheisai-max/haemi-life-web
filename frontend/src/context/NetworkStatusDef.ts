import { createContext } from 'react';

export interface NetworkStatusContextValue {
    isOnline: boolean;
    isSlowConnection: boolean;
}

export const NetworkStatusContext = createContext<NetworkStatusContextValue>({
    isOnline: true,
    isSlowConnection: false,
});
