import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { authService } from '../services/auth.service';
import * as apiModule from '../services/api';
import type { User } from '../types/auth.types';

/**
 * 🩺 HAEMI LIFE | AUTH CONTEXT TEST SUITE (ISOLATED)
 * Institutional Standard: Google/Meta-grade Verification with Module Sanity
 * Goal: Certify the authentication lifecycle with true module-level isolation.
 */

interface AuthContextValue {
    authStatus: string;
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

// 🏛️ Modular Mock Registry
vi.mock('../services/auth.service', () => ({
    authService: {
        waitForBackend: vi.fn(),
        refreshToken: vi.fn().mockResolvedValue({ authenticated: false }),
        verifySession: vi.fn(),
        login: vi.fn(),
        logout: vi.fn(),
    }
}));

const TestComponent = ({ useAuthHook }: { useAuthHook: () => AuthContextValue }) => {
    const { authStatus, user } = useAuthHook();
    return (
        <div>
            <span data-testid="status">{authStatus}</span>
            {user && <span data-testid="user-email">{user.email}</span>}
        </div>
    );
};

describe('AuthContext Lifecycle', () => {
    beforeEach(async () => {
        vi.resetModules();
        cleanup();
        vi.clearAllMocks();
        sessionStorage.clear();

        // Setup default spies after reset
        vi.spyOn(apiModule, 'isBackendConfirmed').mockReturnValue(false);
        vi.mocked(authService.refreshToken).mockResolvedValue({
            authenticated: false,
            token: undefined,
            refreshToken: undefined
        });
    });

    const renderWithIsolation = async () => {
        // P0 FIX: Institutional Module Isolation
        const { AuthProvider } = await import('../context/auth-context');
        const { useAuth } = await import('../hooks/use-auth');

        return render(
            <AuthProvider>
                <TestComponent useAuthHook={useAuth} />
            </AuthProvider>
        );
    };

    it('should transition to offline if backend is unreachable', async () => {
        vi.mocked(authService.waitForBackend).mockResolvedValueOnce(false);

        await renderWithIsolation();

        expect(screen.getByTestId('status')).toHaveTextContent('initializing');

        await waitFor(() => {
            expect(screen.getByTestId('status')).toHaveTextContent('offline');
        }, { timeout: 4000 });
    });

    it('should authenticate user if health check passes and refresh succeeds', async () => {
        vi.mocked(authService.waitForBackend).mockResolvedValueOnce(true);
        vi.mocked(authService.refreshToken).mockResolvedValueOnce({
            authenticated: true,
            token: 'mock-token',
            refreshToken: 'mock-refresh-token'
        });
        vi.mocked(authService.verifySession).mockResolvedValueOnce({
            user: {
                id: '1',
                email: 'test@example.com',
                role: 'doctor',
                name: 'Dr. Test',
                phoneNumber: '555-010-999',
                idNumber: '123456789',
                initials: 'DT',
                profileImage: null,
                profileImageMime: null,
                isVerified: true,
                hasConsent: false,
                status: 'ACTIVE',
                createdAt: new Date().toISOString()
            } as User,
            serverTime: new Date().toISOString(),
            sessionTimeout: 1440
        });

        await renderWithIsolation();

        await waitFor(() => {
            const status = screen.getByTestId('status');
            expect(status).toHaveTextContent('authenticated');
        }, { timeout: 4000 });

        expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });

    it('should transition to unauthenticated if refresh fails (401)', async () => {
        vi.mocked(authService.waitForBackend).mockResolvedValueOnce(true);
        vi.mocked(authService.refreshToken).mockResolvedValueOnce({
            authenticated: false,
            token: undefined,
            refreshToken: undefined
        });

        await renderWithIsolation();

        await waitFor(() => {
            expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
        }, { timeout: 4000 });
    });
});
