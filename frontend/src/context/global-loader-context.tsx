import React, {
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { MedicalLoaderContent } from '@/components/ui/medical-loader';
import { cn } from '@/lib/utils';
import {
    GlobalLoaderContext,
    type GlobalLoaderContextValue,
} from './global-loader-internal';

/**
 * 🛡️ HAEMI LIFE — GlobalLoaderProvider (Google/Meta Grade)
 *
 * Single persistent application-wide loader. Replaces the previous
 * architecture where every page / Suspense fallback / route guard
 * mounted its OWN `<MedicalLoader>` instance. With ~26 distinct call
 * sites and a 500 ms entrance animation per mount, transitions between
 * phases (auth check → lazy chunk → route guard → page data fetch)
 * caused the loader to unmount-and-remount up to 5 times in sequence,
 * each replay creating a perceptible "jerk".
 *
 * Architecture
 * ─────────────────────────────────────────────────────────────────────
 *   • The `<PersistentMedicalLoader>` is mounted exactly ONCE inside
 *     the provider, via React Portal to `document.body`. It never
 *     unmounts during the application lifetime.
 *   • Visibility is driven by an opacity transition on the wrapper
 *     (`opacity-100` ↔ `opacity-0` over `duration-300`). React keeps
 *     the same DOM node alive across all loading phases, so the
 *     entrance animation NEVER replays.
 *   • Multiple components can request the loader concurrently. Each
 *     request is keyed by a stable token (typically `useId()` from the
 *     consumer). When ANY request is active, the loader is visible.
 *     When the LAST request is released, it fades out. This
 *     reference-counted model prevents one component's `hide()` from
 *     killing another component's still-active `show()`.
 *
 * File layout
 * ─────────────────────────────────────────────────────────────────────
 *   • This file exports the Context object, the Provider component,
 *     and the `SuspenseLoaderTrigger` helper component.
 *   • The consumer hooks (`useGlobalLoader`, `usePageLoader`) live in
 *     `@/hooks/use-page-loader.ts` to satisfy the project's
 *     react-refresh/only-export-components convention (components and
 *     constants in one file; hooks in their own file).
 *
 * Strict-TS posture (project mandate)
 * ─────────────────────────────────────────────────────────────────────
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - State is `ReadonlyMap<string, string>`; mutations always
 *     produce a new Map (no in-place edits, no reference reuse).
 *   - All visual concerns via Tailwind utility classes — no inline
 *     `style={{...}}`, no `px` values; the wrapper composes existing
 *     `bg-background`, `transition-opacity`, `duration-300` tokens.
 *   - No `console.*`. The provider does not log; consumer pages log
 *     their own data-fetch failures via the project `logger`.
 */

// `GlobalLoaderContext` and `GlobalLoaderContextValue` are imported from
// `global-loader-internal.ts` so the provider/component file does not
// trip the lint rule against mixed component+context exports.

/**
 * Persistent loader — mounted once at the provider root. Lives outside
 * normal React tree positions via `createPortal(document.body)` so its
 * visibility never depends on which route is currently rendering. The
 * `opacity-0 pointer-events-none` collapse on hide ensures it neither
 * blocks clicks nor receives focus when inactive.
 */
interface PersistentMedicalLoaderProps {
    readonly visible: boolean;
    readonly message: string;
}

const PersistentMedicalLoader: React.FC<PersistentMedicalLoaderProps> = ({
    visible,
    message,
}) => {
    // Hold the LAST visible message even after `visible` flips to false,
    // so the fade-out animation does not show empty / reset text.
    //
    // Per React docs, setting state during render (conditionally) is the
    // preferred pattern for "store information from previous renders":
    // https://react.dev/reference/react/useState#storing-information-from-previous-renders
    // This avoids the cascading-render anti-pattern of doing it in an
    // effect body (which the project's lint rules also flag).
    const [displayMessage, setDisplayMessage] = useState<string>(message);
    if (visible && message.length > 0 && message !== displayMessage) {
        setDisplayMessage(message);
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return null;
    }

    const wrapper = (
        <div
            aria-hidden={!visible}
            className={cn(
                'fixed inset-0 z-[99998] w-screen h-[100dvh]',
                'bg-background backdrop-blur-md',
                'flex items-center justify-center',
                'transition-opacity duration-300 ease-in-out',
                visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
        >
            <MedicalLoaderContent message={displayMessage} />
        </div>
    );

    return createPortal(wrapper, document.body);
};

interface GlobalLoaderProviderProps {
    readonly children: ReactNode;
}

export const GlobalLoaderProvider: React.FC<GlobalLoaderProviderProps> = ({ children }) => {
    const [requests, setRequests] = useState<ReadonlyMap<string, string>>(() => new Map());

    const show = useCallback((token: string, message: string): void => {
        setRequests((prev) => {
            // Skip identical updates so React bails out of the render.
            if (prev.get(token) === message) return prev;
            const next = new Map(prev);
            next.set(token, message);
            return next;
        });
    }, []);

    const hide = useCallback((token: string): void => {
        setRequests((prev) => {
            if (!prev.has(token)) return prev;
            const next = new Map(prev);
            next.delete(token);
            return next;
        });
    }, []);

    const visible: boolean = requests.size > 0;

    // Insertion-order-last message wins. Map preserves insertion order
    // by spec, and `.values()` iterates in that order; the most recent
    // `show()` call is therefore the last item in the iterator.
    const message: string = useMemo<string>(() => {
        if (requests.size === 0) return '';
        let latest = '';
        for (const value of requests.values()) {
            latest = value;
        }
        return latest;
    }, [requests]);

    const value = useMemo<GlobalLoaderContextValue>(
        () => ({ show, hide, visible, message }),
        [show, hide, visible, message]
    );

    return (
        <GlobalLoaderContext.Provider value={value}>
            {children}
            <PersistentMedicalLoader visible={visible} message={message} />
        </GlobalLoaderContext.Provider>
    );
};

/**
 * Render-prop adapter for `<Suspense fallback={...}>`. Suspense
 * fallbacks are mounted/unmounted by React when the boundary's
 * children suspend / resolve, so we attach a token-scoped show/hide
 * via effect rather than rendering a heavy MedicalLoader UI directly
 * inside the fallback. The component itself renders nothing visible
 * — the persistent loader takes over the screen.
 *
 * Implemented with `useContext` directly (rather than via the
 * `usePageLoader` hook from `@/hooks/use-page-loader`) so this file
 * has no imports from the hooks file — keeping the dependency arrow
 * one-way (hooks → context, never back).
 *
 * Usage:
 *
 *     <Suspense fallback={<SuspenseLoaderTrigger message="Loading..." />}>
 *       <LazyComponent />
 *     </Suspense>
 */
interface SuspenseLoaderTriggerProps {
    readonly message: string;
}

export const SuspenseLoaderTrigger: React.FC<SuspenseLoaderTriggerProps> = ({ message }) => {
    const ctx = useContext(GlobalLoaderContext);
    const id: string = useId();

    useEffect(() => {
        if (ctx === null) return;
        const { show, hide } = ctx;
        show(id, message);
        return () => {
            hide(id);
        };
    }, [ctx, id, message]);

    return null;
};
