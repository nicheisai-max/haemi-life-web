import api, { normalizeResponse, type ExtendedRequestConfig } from './api';
import { logger } from '../utils/logger';
import { isAuthError, type LoginCredentials, type SignupCredentials, type AuthResponse, type User, type ApiResponse } from '../types/auth.types';
import axios from 'axios';

// Track backend check status for UI (optional, can be exported if needed)
let isCheckingBackend = false;
export const getIsCheckingBackend = () => isCheckingBackend;
const setIsCheckingBackend = (status: boolean) => { isCheckingBackend = status; };

export const authService = {
    login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
        logger.info('[AuthService] Initiating login sequence...');
        try {
            const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', credentials);
            const data = normalizeResponse(response);
            logger.info('[AuthService] Login successful', { userId: data.user.id, role: data.user.role });
            return data;
        } catch (error: unknown) {
            logger.error('[AuthService] Login failure', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    },

    signup: async (credentials: SignupCredentials): Promise<AuthResponse> => {
        logger.info('[AuthService] Initiating signup sequence...');
        try {
            const response = await api.post<ApiResponse<AuthResponse>>('/auth/signup', credentials);
            const data = normalizeResponse(response);
            logger.info('[AuthService] Signup successful', { userId: data.user.id, role: data.user.role });
            return data;
        } catch (error: unknown) {
            logger.error('[AuthService] Signup failure', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    },

    verifySession: async (options?: { silent?: boolean }): Promise<{ user: User; serverTime: string; sessionTimeout: number }> => {
        try {
            const response = await api.get<ApiResponse<{
                user: User;
                serverTime: string;
                sessionTimeout: number;
            }>>('/auth/verify', {
                __silent: options?.silent
            } as ExtendedRequestConfig);
            const data = normalizeResponse(response);
            return {
                user: data.user,
                serverTime: data.serverTime,
                sessionTimeout: data.sessionTimeout
            };
        } catch (error: unknown) {
            // P0 Fix (Root Cause #2): The response interceptor in api.ts wraps all
            // /auth/ 401 responses in a custom `AuthError` (not an AxiosError).
            // `axios.isAxiosError()` returns false for AuthError instances, which
            // caused the `silent: true` probe to ALWAYS log as [ERROR], and the
            // boot catch block to ALWAYS treat it as a system error instead of a
            // graceful "no session" fallback.
            //
            // Fix: Union-check both the raw AxiosError path (direct calls) AND
            // the AuthError path (interceptor-wrapped). Both are properly typed
            // type guards — no `any`, no `unknown` without narrowing.
            const isAuthFail: boolean =
                (axios.isAxiosError(error) && error.response?.status === 401)
                || isAuthError(error); // ← catches AuthError wrapping a 401

            if (options?.silent && isAuthFail) {
                logger.info('[AuthService] Session probe completed: No active session found.');
            } else {
                const errorMsg = error instanceof Error ? error.message : String(error);
                logger.error('[AuthService] Session verification failed', { error: errorMsg });
            }
            throw error;
        }
    },

    getMe: async (): Promise<{ user: User | null; authenticated: boolean }> => {
        try {
            const response = await api.get<ApiResponse<User>>('/profiles/me');
            const user = normalizeResponse(response);
            if (!user) return { user: null, authenticated: false };

            return {
                user,
                authenticated: true
            };
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error('[AuthService] getMe failure', { error: errorMsg });
            return { user: null, authenticated: false };
        }
    },

    waitForBackend: async (maxRetries = 5, baseInterval = 1000): Promise<boolean> => {
        setIsCheckingBackend(true);
        logger.info('[AuthService] Probing backend availability...');

        let interval = baseInterval;
        for (let i = 0; i < maxRetries; i++) {
            try {
                // Use absolute URL to bypass potentially unconfigured proxies during boot
                const healthUrl = `${import.meta.env.VITE_API_URL || ''}/api/health/ready`;
                const response = await axios.get(healthUrl, { timeout: 2500 });

                if (response.status === 200) {
                    logger.info('[AuthService] Backend confirmed online.');
                    setIsCheckingBackend(false);
                    return true;
                }
            } catch (error: unknown) {
                const errorMsg = error instanceof Error ? error.message : 'Timeout/Network issue';
                logger.warn(`[AuthService] Probe ${i + 1}/${maxRetries} deferred: ${errorMsg}`);

                if (i < maxRetries - 1) {
                    await new Promise(r => setTimeout(r, interval));
                    interval = Math.min(interval * 1.5, 3000);
                }
            }
        }

        logger.error('[AuthService] Backend connectivity unresolved after maximum retries.');
        setIsCheckingBackend(false);
        return false;
    },

    refreshToken: async (): Promise<{ token?: string; refreshToken?: string; authenticated: boolean }> => {
        try {
            const { performRefresh } = await import('./api');
            const token: string | null = await performRefresh();

            if (token !== null) {
                // P1.1: Atomic isolation — Strictly use sessionStorage for refresh token retrieval.
                const storedRefreshToken = sessionStorage.getItem('refreshToken');
                return {
                    token,
                    refreshToken: storedRefreshToken ?? undefined,
                    authenticated: true
                };
            }
            return { authenticated: false };
        } catch (error: unknown) {
            const errorMsg: string = error instanceof Error ? error.message : String(error);
            logger.error('[AuthService] Refresh token logic failure', { error: errorMsg });
            return { authenticated: false };
        }
    },

    logout: async (): Promise<void> => {
        logger.info('[AuthService] Executing institutional logout...');
        try {
            await api.post<ApiResponse<void>>('/auth/logout');
            logger.info('[AuthService] Remote session invalidated.');
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.warn('[AuthService] Remote logout issue (safely insulated)', { error: errorMsg });
        }
    },

    requestPasswordReset: async (identifier: string): Promise<{ message: string; devOtp?: string }> => {
        const response = await api.post<ApiResponse<{ message: string; devOtp?: string }>>('/password-reset/request-reset', { identifier });
        return normalizeResponse(response);
    },

    verifyOTP: async (identifier: string, otp: string): Promise<{ message: string; resetToken: string }> => {
        const response = await api.post<ApiResponse<{ message: string; resetToken: string }>>('/password-reset/verify-otp', { identifier, otp });
        return normalizeResponse(response);
    },

    resetPassword: async (resetToken: string, newPassword: string): Promise<{ message: string }> => {
        const response = await api.post<ApiResponse<{ message: string }>>('/password-reset/reset-password', { resetToken, newPassword });
        return normalizeResponse(response);
    },
};
