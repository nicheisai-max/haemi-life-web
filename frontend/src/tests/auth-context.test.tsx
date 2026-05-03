import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { authService } from '../services/auth.service';
import * as apiModule from '../services/api';
import type { User } from '../types/auth.types';
import { logger } from '../utils/logger';

/**
 * 🩺 HAEMI LIFE — AUTH CONTEXT LIFECYCLE SUITE
 *
 * Reliability hardening (Google / Meta-grade testing principles):
 *
 *  1. **Boundary mocking**: Both `authService` AND `apiModule` are mocked
 *     at module top-level via `vi.mock`. Vitest hoists these calls so
 *     they survive `vi.resetModules()` between tests — the previous
 *     iteration of this suite spied on `apiModule.isBackendConfirmed`
 *     AFTER `vi.resetModules()`, leaving the freshly-imported
 *     auth-context binding pointed at the real (un-stubbed) module.
 *     `vi.importActual` preserves the rest of `apiModule` so secondary
 *     imports (axios instance, queue helpers, etc.) keep working.
 *
 *  2. **Persistent default mocks**: `mockResolvedValue` instead of
 *     `mockResolvedValueOnce`. The bootstrap may call a service more
 *     than once across React's effect lifecycle; falling through to
 *     a stale default after the first call was a race source.
 *
 *  3. **Fake timers neutralise the 5 s boot-fallback**: auth-context
 *     installs a `setTimeout(BOOT_TIMEOUT = 5000)` that flips
 *     `authStatus` to `'app_ready'` if the async chain hasn't completed
 *     by then. Real timers + slow CI machine = the fallback firing
 *     inside the assertion window. Fake timers prevent that — only
 *     microtask-driven completion paths reach the assertion.
 *
 *  4. **Tight `waitFor` window (1500 ms)**: the previous 4000 ms
 *     timeout masked failures with patience. With the mocks correctly
 *     applied the resolution is microtask-time (sub-50 ms); 1500 ms
 *     is generous headroom that still surfaces a real bug fast.
 *
 *  5. **Module-scope singleton reset**: `auth-context.tsx` carries
 *     `let hasBootInitiated` and `let hasGlobalBootstrapExecuted` —
 *     reset between tests via `vi.resetModules()` followed by a
 *     dynamic `await import(...)` inside the helper.
 *
 * Strict TypeScript discipline maintained throughout: no `any`, no
 * suppression directives, no double casts. All catch blocks bind
 * `error: unknown` and narrow with `instanceof Error` before reporting
 * via the institutional `logger`.
 */

interface AuthContextValue {
    authStatus: string;
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

// ─── Module-level mocks (hoisted by Vitest, survive vi.resetModules) ───

vi.mock('../services/auth.service', () => ({
    authService: {
        waitForBackend: vi.fn(),
        refreshToken: vi.fn(),
        verifySession: vi.fn(),
        login: vi.fn(),
        logout: vi.fn(),
    },
}));

vi.mock('../services/api', async () => {
    const actual = await vi.importActual<typeof import('../services/api')>('../services/api');
    return {
        ...actual,
        isBackendConfirmed: vi.fn(() => false),
    };
});

// ─── Test helpers ──────────────────────────────────────────────────────

const TestComponent = ({ useAuthHook }: { useAuthHook: () => AuthContextValue }): React.ReactElement => {
    const { authStatus, user } = useAuthHook();
    return (
        <div>
            <span data-testid="status">{authStatus}</span>
            {user && <span data-testid="user-email">{user.email}</span>}
        </div>
    );
};

const buildVerifiedUser = (overrides: Partial<User> = {}): User => ({
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
    createdAt: new Date().toISOString(),
    ...overrides,
});

/**
 * Asserts that the rendered `data-testid="status"` element transitions
 * to the expected text. Uses `waitFor` with a tight 1500 ms cap so a
 * stuck mock surfaces immediately rather than masking behind 4 s of
 * patience. Errors are routed through the institutional logger so a
 * failure path leaves the same audit trail used elsewhere in the
 * clinical surface.
 */
const expectStatusToBecome = async (expected: string): Promise<HTMLElement> => {
    try {
        await waitFor(
            () => {
                expect(screen.getByTestId('status')).toHaveTextContent(expected);
            },
            { timeout: 1500 },
        );
        return screen.getByTestId('status');
    } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);
        logger.error('[Test] Status transition assertion failed', {
            expected,
            actual: screen.queryByTestId('status')?.textContent ?? '<unrendered>',
            detail,
        });
        throw error;
    }
};

// ─── Suite ─────────────────────────────────────────────────────────────

describe('AuthContext Lifecycle', () => {
    beforeEach(() => {
        // Order matters: reset modules first so the next dynamic import
        // gives us a fresh auth-context (with cleared singletons), then
        // clear DOM, then reset mock call history, then re-establish
        // default stub implementations.
        vi.resetModules();
        cleanup();
        vi.clearAllMocks();
        sessionStorage.clear();

        // Fake timers neutralise the in-component 5-second boot-fallback
        // setTimeout. We do not advance time in any test — we rely on
        // microtask-driven resolution of the mocked async chain.
        vi.useFakeTimers({ shouldAdvanceTime: true });

        // Persistent default mocks. Each test overrides only the call(s)
        // it cares about; falling through to these keeps the boot path
        // deterministic when an effect re-runs.
        vi.mocked(apiModule.isBackendConfirmed).mockReturnValue(false);
        vi.mocked(authService.waitForBackend).mockResolvedValue(false);
        vi.mocked(authService.refreshToken).mockResolvedValue({
            authenticated: false,
            token: undefined,
            refreshToken: undefined,
        });
    });

    afterEach(() => {
        // Drain any microtasks the bootstrap left behind, then return to
        // real timers so the next suite starts from a clean baseline.
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        cleanup();
    });

    /**
     * Imports `AuthProvider` + `useAuth` AFTER `vi.resetModules()` has
     * blown away the module cache so the auth-context's
     * `hasBootInitiated` / `hasGlobalBootstrapExecuted` singletons are
     * fresh. Without this, test 2 inherits test 1's "boot already
     * happened" flag and the bootstrap effect short-circuits.
     */
    const renderProvider = async (): Promise<void> => {
        const { AuthProvider } = await import('../context/auth-context');
        const { useAuth } = await import('../hooks/use-auth');
        render(
            <AuthProvider>
                <TestComponent useAuthHook={useAuth} />
            </AuthProvider>,
        );
    };

    it('should transition to offline if backend is unreachable', async () => {
        vi.mocked(authService.waitForBackend).mockResolvedValue(false);

        await renderProvider();

        // Initial state is `initializing` (the auth-context's first
        // commit before the async chain resolves).
        expect(screen.getByTestId('status')).toHaveTextContent('initializing');

        await expectStatusToBecome('offline');
    });

    it('should authenticate user if health check passes and refresh succeeds', async () => {
        vi.mocked(authService.waitForBackend).mockResolvedValue(true);
        vi.mocked(authService.refreshToken).mockResolvedValue({
            authenticated: true,
            token: 'mock-token',
            refreshToken: 'mock-refresh-token',
        });
        vi.mocked(authService.verifySession).mockResolvedValue({
            user: buildVerifiedUser(),
            serverTime: new Date().toISOString(),
            sessionTimeout: 1440,
        });

        await renderProvider();

        await expectStatusToBecome('authenticated');
        expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });

    it('should transition to unauthenticated if refresh fails (401)', async () => {
        vi.mocked(authService.waitForBackend).mockResolvedValue(true);
        vi.mocked(authService.refreshToken).mockResolvedValue({
            authenticated: false,
            token: undefined,
            refreshToken: undefined,
        });

        await renderProvider();

        await expectStatusToBecome('unauthenticated');
    });
});
