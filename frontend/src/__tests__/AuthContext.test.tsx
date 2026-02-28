import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';

// Mock authService
vi.mock('../services/auth.service', () => ({
    authService: {
        waitForBackend: vi.fn(),
        refreshToken: vi.fn(),
        verifySession: vi.fn(),
        login: vi.fn(),
        logout: vi.fn(),
    }
}));

const TestComponent = () => {
    const { authStatus, user } = useAuth();
    return (
        <div>
            <span data-testid="status">{authStatus}</span>
            {user && <span data-testid="user-email">{user.email}</span>}
        </div>
    );
};

describe('AuthContext Lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        // Reset env config if needed
    });

    it('should transition to offline if backend is unreachable', async () => {
        vi.mocked(authService.waitForBackend).mockResolvedValueOnce(false); // Simulate health check fail

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        expect(screen.getByTestId('status')).toHaveTextContent('initializing');

        await waitFor(() => {
            expect(screen.getByTestId('status')).toHaveTextContent('offline');
        });

        // Ensure token refresh wasn't called
        expect(authService.refreshToken).not.toHaveBeenCalled();
    });

    it('should authenticate user if health check passes and refresh succeeds', async () => {
        vi.mocked(authService.waitForBackend).mockResolvedValueOnce(true);
        vi.mocked(authService.refreshToken).mockResolvedValueOnce({ authenticated: true, token: 'mock-token' });
        vi.mocked(authService.verifySession).mockResolvedValueOnce({
            user: { id: '1', email: 'test@example.com', role: 'doctor', name: 'Dr. Test' } as any
        });

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
            expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
        });
    });

    it('should transition to unauthenticated if refresh fails (401)', async () => {
        vi.mocked(authService.waitForBackend).mockResolvedValueOnce(true);
        vi.mocked(authService.refreshToken).mockResolvedValueOnce({ authenticated: false });

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
        });
    });
});
