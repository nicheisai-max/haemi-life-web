import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/use-auth';
import { getClinicalCopilotEnabled } from '../services/clinical-copilot-admin.service';
import { socketService } from '../services/socket.service';
import { logger } from '../utils/logger';
import {
    ClinicalCopilotContext,
    type ClinicalCopilotContextValue,
} from './clinical-copilot-context-def';

/**
 * 🩺 HAEMI LIFE — CLINICAL COPILOT TOGGLE PROVIDER (AI cost-control)
 *
 * Owns the live state of the admin-controlled "is the Clinical AI
 * Copilot enabled" flag and propagates changes to every consumer
 * (the doctor chat widget, the admin toggle UI, future surfaces
 * that need to gate AI affordances) via React context.
 *
 * RESPONSIBILITIES
 *
 *   1. HYDRATION
 *      On every authenticated mount (regardless of role), fetch
 *      `GET /api/platform/clinical-copilot-enabled` once and seed
 *      the context with the server-canonical value. Unauthenticated
 *      sessions skip the fetch and remain on the optimistic default
 *      `true`.
 *
 *   2. LIVE SYNC
 *      Subscribe to the Socket.IO `'clinical-copilot:toggled'`
 *      event. When an admin flips the toggle in any tab on any
 *      device, the backend emits to EVERY connected socket; this
 *      provider receives it and updates context, cascading the
 *      change through every UI surface WITHOUT a reload.
 *
 *   3. AUTH-TRANSITION RESET (via `key` prop)
 *      The outer `<ClinicalCopilotProvider>` keys an inner
 *      `<ClinicalCopilotSession>` on the user's identity tuple.
 *      Login / logout / switch-user remounts the inner session —
 *      fresh initial state, zero leaked listeners.
 *
 * STRICT-TS POSTURE
 *
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`,
 *     zero `eslint-disable`.
 *   - Fetch errors narrowed via `instanceof Error`.
 *   - `setState` only in callbacks (.then / .catch / socket handler)
 *     — never in synchronous effect bodies. The `key`-prop pattern
 *     handles auth-transition reset without setState-in-effect.
 */

interface ClinicalCopilotProviderProps {
    readonly children: ReactNode;
}

/**
 * Outer wrapper — derives the identity key and forwards everything
 * else to the inner session component. The `key` is what triggers
 * the clean remount on auth transitions.
 */
export const ClinicalCopilotProvider: React.FC<ClinicalCopilotProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const sessionKey: string = `${user?.id ?? 'anon'}:${user?.role ?? 'none'}`;
    return (
        <ClinicalCopilotSession key={sessionKey}>
            {children}
        </ClinicalCopilotSession>
    );
};

const ClinicalCopilotSession: React.FC<ClinicalCopilotProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const isAuthenticated: boolean = typeof user?.id === 'string' && user.id.length > 0;

    /**
     * Initial state runs at mount time. Every role lands on the
     * optimistic default `true` (so a doctor's copilot doesn't flash
     * a "disabled" banner during the brief hydration window). The
     * network fetch flips it to the canonical server value;
     * unauthenticated sessions stay on the default and mark hydrated.
     */
    const [enabled, setEnabled] = useState<boolean>(true);
    const [isHydrated, setIsHydrated] = useState<boolean>(!isAuthenticated);

    /**
     * Hydration effect — fetches the canonical flag on every
     * authenticated mount. All `setState` calls happen inside
     * `.then` / `.catch` callbacks; the
     * `react-hooks/set-state-in-effect` rule passes cleanly.
     */
    useEffect(() => {
        if (!isAuthenticated) return;

        let cancelled: boolean = false;

        getClinicalCopilotEnabled()
            .then((value) => {
                if (cancelled) return;
                setEnabled(value);
                setIsHydrated(true);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                logger.warn('[ClinicalCopilotProvider] Fetch failed; falling back to optimistic default `true`', {
                    error: err instanceof Error ? err.message : String(err),
                });
                setIsHydrated(true);
            });

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    /**
     * Cross-CLIENT live sync via Socket.IO. When an admin flips the
     * toggle from any device, the backend emits
     * `'clinical-copilot:toggled'` to every connected socket. Every
     * other client (including this one) receives it and updates
     * context — the doctor's chat input disables instantly.
     */
    useEffect(() => {
        if (!isAuthenticated) return;

        const handler = (payload: { readonly enabled: boolean }): void => {
            if (typeof payload.enabled === 'boolean') {
                setEnabled(payload.enabled);
            }
        };

        socketService.on('clinical-copilot:toggled', handler);
        return () => {
            socketService.off('clinical-copilot:toggled', handler);
        };
    }, [isAuthenticated]);

    const value = useMemo<ClinicalCopilotContextValue>(
        () => ({ enabled, isHydrated }),
        [enabled, isHydrated],
    );

    return (
        <ClinicalCopilotContext.Provider value={value}>
            {children}
        </ClinicalCopilotContext.Provider>
    );
};
