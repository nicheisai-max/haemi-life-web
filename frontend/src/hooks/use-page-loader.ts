import { useContext, useEffect, useId } from 'react';
import {
    GlobalLoaderContext,
    type GlobalLoaderContextValue,
} from '@/context/global-loader-internal';

/**
 * 🛡️ HAEMI LIFE — Loader hooks
 *
 * Consumer-facing hooks for the application's single persistent loader
 * (mounted once by `GlobalLoaderProvider`). Lives in `hooks/` rather
 * than co-located with the provider to satisfy the project's
 * `react-refresh/only-export-components` convention — this file
 * exports hooks only; the provider/trigger components live in
 * `@/context/global-loader-context.tsx`.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - Hook signatures use plain primitive parameters; no narrowing
 *     gymnastics required at the call boundary.
 *   - The single useEffect dependency-array pattern is the standard
 *     React 18+ way to express "show on mount/dep-change, hide on
 *     cleanup". `show` and `hide` are memoised with empty-deps
 *     `useCallback` in the provider, so they are stable references —
 *     listing them in the dep array is correct and does not cause
 *     spurious effect re-runs.
 */

/**
 * Low-level imperative API. Most callers should prefer the declarative
 * `usePageLoader(active, message)` hook below — it handles token
 * lifecycle, message updates, and unmount cleanup automatically.
 *
 * Returns the full context value so test harnesses and exotic call
 * sites (e.g. error-boundary recovery flows) can drive the loader
 * outside React's render cycle.
 */
export function useGlobalLoader(): GlobalLoaderContextValue {
    const ctx = useContext(GlobalLoaderContext);
    if (ctx === null) {
        throw new Error(
            '[useGlobalLoader] No GlobalLoaderProvider found in the tree. '
            + 'Wrap the application root with <GlobalLoaderProvider> in main.tsx.'
        );
    }
    return ctx;
}

/**
 * Declarative page-loader hook. Pass an `active` boolean (typically the
 * page's own `loading` state) and a stable `message`; the hook will
 * register the request when `active` is true, update the message in
 * place when it changes, and release the request when `active` flips
 * false OR the consuming component unmounts.
 *
 * Usage (replaces `if (loading) return <MedicalLoader message="..." />`):
 *
 *     usePageLoader(loading, 'Hydrating clinical intelligence...');
 *     if (loading) return null;
 *     return <DashboardContent ... />;
 *
 * The `if (loading) return null` guard keeps the page subtree out of
 * the React tree while data is in flight (preserves the previous
 * "no data crashes" semantics). The persistent loader continues to
 * render at full opacity during this window.
 *
 * When `message` changes while `active` stays `true`, the same token's
 * request is updated in place — React batches the cleanup + effect
 * into a single commit, so the loader's `visible` flag never observes
 * the empty-Map intermediate state. No flicker.
 */
export function usePageLoader(active: boolean, message: string): void {
    const { show, hide } = useGlobalLoader();
    const id: string = useId();

    useEffect(() => {
        if (!active) return;
        show(id, message);
        return () => {
            hide(id);
        };
    }, [active, message, id, show, hide]);
}
