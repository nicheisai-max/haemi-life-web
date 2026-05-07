import { createContext } from 'react';

/**
 * 🛡️ HAEMI LIFE — GlobalLoaderContext (internal module)
 *
 * Lives in its own file to satisfy the project's
 * `react-refresh/only-export-components` rule: the lint stack treats
 * a `React.createContext` export as a "non-component, non-constant
 * runtime export", which would force every component change in the
 * provider file to do a full reload instead of a targeted Fast Refresh
 * update. Splitting the Context object out keeps the provider file
 * pure-components-and-constants and lets HMR work normally.
 *
 * Consumers: provider, trigger, and hooks all `import` from this file.
 * They never import from each other across the provider/hooks boundary
 * — the dependency graph is one-way: every leaf imports from here, so
 * there is no circular import.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - Context default value is `null`; consumers narrow with a
 *     `useContext + null-check throw` pattern (see `useGlobalLoader`)
 *     so missing-provider misuse fails loudly at runtime instead of
 *     silently no-oping.
 */

export interface GlobalLoaderContextValue {
    /**
     * Add or refresh a loader request. Calling `show` with an existing
     * token simply updates the message (the token's request stays
     * active). Use a stable token per component instance — typically
     * `useId()`. Multiple concurrent requests are reference-counted;
     * the loader stays visible until the last token is released.
     */
    readonly show: (token: string, message: string) => void;

    /**
     * Release a loader request. No-op if the token is not currently
     * active. The loader fades out only when the request map becomes
     * empty (last token released).
     */
    readonly hide: (token: string) => void;

    /** Reactive: whether the persistent loader is currently visible. */
    readonly visible: boolean;

    /** Reactive: the most recently set message (insertion-order last). */
    readonly message: string;
}

export const GlobalLoaderContext = createContext<GlobalLoaderContextValue | null>(null);
