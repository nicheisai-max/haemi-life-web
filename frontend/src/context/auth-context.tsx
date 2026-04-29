import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

import { logger, auditLogger } from '../utils/logger';
import { authService } from '../services/auth.service';
import { setAccessToken, setAppInitialized, isBackendConfirmed } from '../services/api';
import { AuthContext } from './auth-context-def';
import { isAuthError, type User, type LoginCredentials, type SignupCredentials } from '../types/auth.types';
import {
    safeParseJSON,
    isRefreshTokenPayload,
    isUser
} from '../utils/type-guards';
import { decodeJWT } from '../utils/jwt';

interface AuthState {
    user: User | null;
    token: string | null;
    authStatus: 'initializing' | 'auth_check' | 'onboarding_check' | 'authenticated' | 'unauthenticated' | 'offline' | 'app_ready';
    profileImageVersion: number;
    serverOffset: number; // ms difference (server - client)
    sessionTimeout: number | null; // minutes
}



// ─── MODULE-LEVEL BOOTSTRAP GUARDS ─────────────────────────────────────────
let hasGlobalBootstrapExecuted = false;
let hasBootInitiated = false;
const OPTIMISTIC_TOKEN_MIN_TTL_SECONDS = 30 as const;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ─── 1. ISOLATED RENDER-SAFE STATE INIT ─────────────────────────────────────
    const [authState, setAuthState] = useState<AuthState>(() => {
        const initialUserJson = sessionStorage.getItem('user');
        const initialToken = sessionStorage.getItem('token');
        const user = initialUserJson ? safeParseJSON(initialUserJson, isUser) : null;
        const sanitizedUser = user ? { ...user, hasConsent: !!user.hasConsent } : null;

        return {
            user: sanitizedUser,
            token: initialToken,
            authStatus: 'initializing',
            profileImageVersion: Date.now(),
            serverOffset: 0,
            sessionTimeout: null
        };
    });

    const authStateRef = useRef<AuthState>(authState);
    useEffect(() => {
        authStateRef.current = authState;
    }, [authState]);

    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isTokenNearDeath, setIsTokenNearDeath] = useState(false);
    const isRefreshingRef = useRef<boolean>(false);
    const lastInteractionRef = useRef<number>(Date.now());

    /**
     * 🛡️ INSTITUTIONAL ATOMICITY GUARD:
     * Commits auth state to memory and sessionStorage (Strictly Tab-Bound).
     */
    const commitAuthState = useCallback((
        user: User | null, 
        token: string | null, 
        status: AuthState['authStatus'], 
        refreshToken?: string | null,
        serverTimeOrOffset?: string | number,
        sessionTimeout?: number | null
    ) => {
        setAccessToken(token);

        if (token && user) {
            sessionStorage.setItem('token', token);
            sessionStorage.setItem('user', JSON.stringify(user));
            if (refreshToken) {
                sessionStorage.setItem('refreshToken', refreshToken);
            }
        } else {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('refreshToken');
            sessionStorage.removeItem('user');
        }

        let offset: number;
        if (typeof serverTimeOrOffset === 'number') {
            offset = serverTimeOrOffset;
        } else {
            const serverMs = serverTimeOrOffset ? new Date(serverTimeOrOffset).getTime() : Date.now();
            offset = serverMs - Date.now();
        }

        setAuthState(prev => {
            const hasUserChanged = prev.user?.id !== user?.id;
            return {
                ...prev,
                user,
                token,
                authStatus: status,
                profileImageVersion: hasUserChanged ? Date.now() : prev.profileImageVersion,
                serverOffset: offset,
                sessionTimeout: sessionTimeout !== undefined ? sessionTimeout : prev.sessionTimeout
            };
        });
        
        logger.info(`[Auth] Identity Commit (Military Grade): ${status}`);
    }, []);

    const logout = useCallback(async (): Promise<void> => {
        try {
            await authService.logout();
            logger.info('[Auth] Remote session invalidated');
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    logger.warn('[Auth] Logout: Remote session already void');
                } else {
                    logger.error('[Auth] Remote logout failure', { error: error.message });
                }
            } else {
                logger.error('[Auth] Unknown error during logout', { error: String(error) });
            }
        }

        commitAuthState(null, null, 'unauthenticated');
    }, [commitAuthState]);

    const login = useCallback(async (credentials: LoginCredentials) => {
        const result = await authService.login(credentials);
        commitAuthState(result.user, result.token, 'authenticated', result.refreshToken, result.serverTime, result.sessionTimeout);
    }, [commitAuthState]);

    const signup = useCallback(async (credentials: SignupCredentials) => {
        const result = await authService.signup(credentials);
        commitAuthState(result.user, result.token, 'authenticated', result.refreshToken, result.serverTime, result.sessionTimeout);
    }, [commitAuthState]);

    const refreshUser = useCallback(async () => {
        try {
            const { user: verifiedUser } = await authService.verifySession();
            setAuthState(prev => ({ ...prev, user: verifiedUser, profileImageVersion: Date.now() }));
            sessionStorage.setItem('user', JSON.stringify(verifiedUser));
            logger.info('[Auth] User profile refreshed');
        } catch (error) {
            logger.error('[Auth] Failed to refresh user profile', error);
        }
    }, []);

    // ─── 3. INSTITUTIONAL EFFECTS ──────────────────────────────────────────────

    useEffect(() => {
        if (!hasGlobalBootstrapExecuted) {
            hasGlobalBootstrapExecuted = true;
            const token = sessionStorage.getItem('token');
            if (token) setAccessToken(token);
        }
    }, []);

    const checkRefreshNeeded = useCallback(async () => {
        const current = authStateRef.current;
        if (!current || !current.token) return;

        try {
            const decodedToken = decodeJWT(current.token);
            if (!decodedToken) return;

            const now = Math.floor((Date.now() + current.serverOffset) / 1000);
            const timeUntilExpiry = decodedToken.exp - now;

            setIsTokenNearDeath(timeUntilExpiry < 10);

            if (timeUntilExpiry < 300) {
                if (isRefreshingRef.current) return;
                isRefreshingRef.current = true;
                setIsRefreshing(true);
                
                try {
                    const { performRefresh } = await import('../services/api');
                    const refreshedToken = await performRefresh();
                    if (!refreshedToken && timeUntilExpiry <= 0) throw new Error('TERM_EXPIRY');
                } catch (innerError: unknown) {
                    const isTerminal = (innerError instanceof Error && innerError.message === 'TERM_EXPIRY') || timeUntilExpiry <= 0;
                    if (isTerminal) {
                        await logout();
                        return;
                    }
                }
            }

            const timeoutMinutes = current.sessionTimeout;
            if (timeoutMinutes) {
                const idleLimitMs = timeoutMinutes * 60 * 1000;
                const elapsed = Date.now() - lastInteractionRef.current;
                const timeRemaining = idleLimitMs - elapsed;
                if (timeRemaining > 0 && timeRemaining < 120000) {
                    window.dispatchEvent(new CustomEvent('auth:session-expiring', { detail: { timeLeft: Math.floor(timeRemaining / 1000) } }));
                }
            }
        } catch (error: unknown) {
            logger.error('[Auth] Proactive refresh engine failure', error);
        } finally {
            isRefreshingRef.current = false;
            setIsRefreshing(false);
        }
    }, [logout]);

    useEffect(() => {
        const cleanup = () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = null;
            }
        };
        cleanup();

        if (authState.authStatus !== 'authenticated' || !authState.token) return;

        const updateActivity = () => { lastInteractionRef.current = Date.now(); };
        const interactionEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
        
        interactionEvents.forEach(name => window.addEventListener(name, updateActivity, { passive: true }));

        const handleVisibilityChange = (): void => {
            if (document.visibilityState !== 'visible') return;
            updateActivity();

            // ── INSTITUTIONAL IDENTITY GUARD (Focus-Based) ─────────────────────
            // Even in a tab-isolated sessionStorage model, we validate that the
            // session hasn't been corrupted or terminated mid-background.
            const currentUser = authStateRef.current.user;
            if (currentUser !== null) {
                const storedRefreshToken = sessionStorage.getItem('refreshToken');

                if (storedRefreshToken === null) {
                    logger.warn('[Auth] Focus Security: Session token absent.', { userId: currentUser.id });
                    auditLogger.log('SESSION_TERMINATED', {
                        reason: 'TAB_FOCUS_TOKEN_ABSENT',
                        userId: currentUser.id,
                        details: { role: currentUser.role, trigger: 'visibilitychange' }
                    });
                    commitAuthState(null, null, 'unauthenticated');
                    return;
                }

                // Validate refresh token ownership (Institutional Standard)
                try {
                    const base64Url = storedRefreshToken.split('.')[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const decoded = safeParseJSON(atob(base64), isRefreshTokenPayload);

                    if (decoded !== null && decoded.id !== currentUser.id) {
                        logger.warn('[Auth] Focus Security: Identity drift detected.', {
                            currentId: currentUser.id,
                            tokenId: decoded.id
                        });
                        auditLogger.log('SECURITY_EVENT', {
                            reason: 'TAB_IDENTITY_DRIFT',
                            userId: currentUser.id,
                            details: { currentRole: currentUser.role, tokenOwnerId: decoded.id }
                        });
                        commitAuthState(null, null, 'unauthenticated');
                        return;
                    }
                } catch (decodeErr: unknown) {
                    logger.error('[Auth] Focus Security: Decode failure', decodeErr);
                }
            }

            checkRefreshNeeded().catch(err => logger.error('[Auth] Visibility sync failure', err));
        };

        refreshIntervalRef.current = setInterval(() => {
            checkRefreshNeeded().catch(err => logger.error('[Auth] Periodic sync failure', err));
        }, 15000); 

        window.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            cleanup();
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            interactionEvents.forEach(name => window.removeEventListener(name, updateActivity));
        };
    }, [authState.authStatus, authState.token, checkRefreshNeeded]);

    useEffect(() => {
        const handleUnauthorized = () => commitAuthState(null, null, 'unauthenticated');

        const handleTokenRefreshed = (event: Event) => {
            const customEvent = event as CustomEvent<{
                token: string;
                refreshToken: string | null | undefined;
                serverTime: string | undefined;
                sessionTimeout: number | undefined;
            }>;
            const { token, refreshToken, serverTime, sessionTimeout } = customEvent.detail;

            if (authStateRef.current.token === token) return;

            setAuthState(prev => ({
                ...prev,
                token,
                serverOffset: serverTime ? new Date(serverTime).getTime() - Date.now() : prev.serverOffset,
                sessionTimeout: sessionTimeout ?? prev.sessionTimeout
            }));

            sessionStorage.setItem('token', token);
            if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        window.addEventListener('auth:token-refreshed', handleTokenRefreshed);

        return () => {
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
            window.removeEventListener('auth:token-refreshed', handleTokenRefreshed);
        };
    }, [commitAuthState]);

    useEffect(() => {
        if (hasBootInitiated) return;
        hasBootInitiated = true;
        const BOOT_TIMEOUT = 5000;

        const initAuth = async () => {
            const timeoutGuard = setTimeout(() => {
                if (authStateRef.current.authStatus !== 'app_ready') {
                    setAuthState(prev => ({ ...prev, authStatus: 'app_ready' }));
                    setAppInitialized();
                }
            }, BOOT_TIMEOUT);

            try {
                const storedToken = sessionStorage.getItem('token');
                if (storedToken) {
                    const decoded = decodeJWT(storedToken);
                    if (decoded && decoded.exp > (Math.floor(Date.now() / 1000) + OPTIMISTIC_TOKEN_MIN_TTL_SECONDS)) {
                        const user = safeParseJSON(sessionStorage.getItem('user') || '', isUser);
                        if (user) {
                            commitAuthState(user, storedToken, 'authenticated');
                            clearTimeout(timeoutGuard);
                            setAppInitialized();
                            return;
                        }
                    }
                }
                
                const isReady = isBackendConfirmed() || await authService.waitForBackend(2, 500);
                if (!isReady) {
                    commitAuthState(null, null, 'offline');
                    return;
                }

                const refreshResult = await authService.refreshToken();
                if (refreshResult.authenticated && refreshResult.token) {
                    const verifyResult = await authService.verifySession({ silent: true });
                    commitAuthState(verifyResult.user, refreshResult.token, 'authenticated', refreshResult.refreshToken, verifyResult.serverTime, verifyResult.sessionTimeout);
                } else {
                    commitAuthState(null, null, 'unauthenticated');
                }
            } catch (error: unknown) {
                const isConfirmedAuthFailure = isAuthError(error) || (axios.isAxiosError(error) && error.response?.status === 401);
                if (isConfirmedAuthFailure) {
                    commitAuthState(null, null, 'unauthenticated');
                } else {
                    logger.error('[Boot] Non-auth initialization failure', { error: String(error) });
                    if (authStateRef.current.token === null) commitAuthState(null, null, 'unauthenticated');
                }
            } finally {
                clearTimeout(timeoutGuard);
                setAppInitialized();
                window.dispatchEvent(new CustomEvent('auth:ready'));
            }
        };
        initAuth();
    }, [commitAuthState]);

    const contextValue = React.useMemo(() => ({
        user: authState.user,
        token: authState.token,
        authStatus: authState.authStatus,
        profileImageVersion: authState.profileImageVersion,
        login,
        signup,
        logout,
        refreshUser,
        isRefreshing,
        isTokenNearDeath,
        isLoading: ['initializing', 'auth_check', 'onboarding_check'].includes(authState.authStatus),
        isAuthenticated: (() => {
            const isAuth = (
                authState.authStatus === 'authenticated' ||
                (authState.authStatus === 'app_ready' && authState.user !== null)
            ) && authState.token !== null;
            
            if (!isAuth || !authState.token) return false;
            
            try {
                const payload = decodeJWT(authState.token);
                if (!payload) return false;
                const now = Math.floor(Date.now() / 1000);
                return payload.exp > now;
            } catch (err: unknown) {
                logger.error('[Auth] Centralized expiry validation systemic failure', {
                    error: err instanceof Error ? err.message : String(err)
                });
                return false;
            }
        })()
    }), [
        authState.user, 
        authState.token, 
        authState.authStatus, 
        authState.profileImageVersion, 
        isRefreshing, 
        isTokenNearDeath,
        login, 
        signup, 
        logout, 
        refreshUser
    ]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};
