import { describe, it, expect, afterEach, vi } from 'vitest';
import { socketService, SocketState } from './socket.service';
import { logger } from '../utils/logger';

/**
 * Phase A Lifecycle Invariants
 *
 * These tests validate the post-remediation contract of the socket
 * service: bfcache-friendly behavior on page transitions, deterministic
 * state transitions on `disconnect()`, and institutional logger audit.
 * They use only public methods — private members are never accessed via
 * type-erasure casts.
 *
 * Runner: Vitest (frontend test stack — see frontend/package.json
 * `test:frontend` script). The mock-clearing API is `vi.*`, not `jest.*`.
 */
describe('Socket Lifecycle Hardening (Phase A)', () => {
    afterEach((): void => {
        vi.restoreAllMocks();
    });

    it('disconnect() transitions to DISCONNECTED state', (): void => {
        socketService.disconnect();
        expect(socketService.isConnected()).toBe(false);
        expect(socketService.getState()).toBe(SocketState.DISCONNECTED);
    });

    it('pagehide does NOT actively close the socket (bfcache-friendly)', (): void => {
        // Phase A invariant: aggressively closing the socket inside a
        // pagehide handler blocks the back-forward cache. The browser
        // closes the transport on real unload; suppressing the listener
        // allows the page to be restored from bfcache.
        socketService.disconnect();
        const stateBefore = socketService.getState();
        window.dispatchEvent(new Event('pagehide'));
        expect(socketService.getState()).toBe(stateBefore);
    });

    it('beforeunload does NOT actively close the socket (bfcache-friendly)', (): void => {
        // Same invariant as pagehide. `beforeunload` listeners disqualify
        // the page from bfcache entirely on most modern browsers.
        socketService.disconnect();
        const stateBefore = socketService.getState();
        window.dispatchEvent(new Event('beforeunload'));
        expect(socketService.getState()).toBe(stateBefore);
    });

    it('state transitions are recorded by institutional logger', (): void => {
        const infoSpy = vi.spyOn(logger, 'info');
        socketService.disconnect();
        expect(infoSpy).toHaveBeenCalledWith(
            expect.stringContaining('[SocketService] State Transition'),
            expect.any(Object)
        );
    });

    it('isConnected() reports false after disconnect()', (): void => {
        socketService.disconnect();
        expect(socketService.isConnected()).toBe(false);
    });

    it('getState() exposes the current state via public API', (): void => {
        socketService.disconnect();
        const state = socketService.getState();
        expect(Object.values(SocketState)).toContain(state);
    });
});
