import { createContext } from 'react';

export interface NetworkStatusContextValue {
    /**
     * Browser-level network connectivity (`navigator.onLine`). True when the
     * device has any network interface up. Does NOT imply the application
     * backend is reachable — see `isBackendReachable` for that.
     */
    isOnline: boolean;
    /**
     * `connection.effectiveType` is `slow-2g` or `2g`. Banner-only signal;
     * the application does not actively throttle features in this state.
     */
    isSlowConnection: boolean;
    /**
     * Application-layer reachability of the Haemi backend. Defaults to
     * `true`; flips to `false` when the axios circuit breaker transitions
     * to OPEN (sustained 5xx / network failures) or when the realtime
     * socket signals a sustained reconnect failure. Flips back to `true`
     * on the next successful API response or socket reconnection.
     *
     * Distinct from `isOnline` because the device can be online (Wi-Fi
     * connected) while our backend is unreachable (server down,
     * DNS resolution failure, firewall, etc.). The banner copy reflects
     * the difference so the user knows whether to check their own
     * connection or to wait for our service to recover.
     */
    isBackendReachable: boolean;
}

export const NetworkStatusContext = createContext<NetworkStatusContextValue>({
    isOnline: true,
    isSlowConnection: false,
    isBackendReachable: true,
});
