import React from 'react';
import { createPortal } from 'react-dom';
import { Logo } from './logo';
import { cn } from '@/lib/utils';

/**
 * 🛡️ HAEMI LIFE — MedicalLoader
 *
 * Two-tier API:
 *
 *   1. `<MedicalLoaderContent>` — pure presentational content (logo + glow
 *      + status indicator + message). NO entrance animation, NO portal,
 *      NO fixed positioning. Used by `GlobalLoaderProvider` to render the
 *      single persistent application loader, AND directly inline by
 *      callers that need a localized panel-scope loader (chat-hub,
 *      pharmacist dispense modal, etc.).
 *
 *   2. `<MedicalLoader>` — the legacy compound API (content + wrapper +
 *      optional portal). Preserved for inline `variant='viewport'` use
 *      cases that render the loader inside a specific panel rather than
 *      as a full-screen overlay. **Page-level / full-screen loading
 *      transitions MUST go through the global provider** (see
 *      `usePageLoader` in `context/global-loader-context.tsx`) — never
 *      via this component, otherwise the unmount/remount cycle replays
 *      the entrance animation and creates the visual "jerk" the global
 *      provider is designed to eliminate.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - All visual concerns via Tailwind utility classes / index.css —
 *     no inline `style={{...}}`, no `px` values.
 *   - No CSS entrance animation classes on the *content* itself; the
 *     persistent provider controls entrance/exit via opacity transitions
 *     on its own wrapper, while inline-variant callers render the
 *     content within their own contextual transitions (Framer Motion
 *     panels etc.).
 */

export type MedicalLoaderSize = 'sm' | 'md' | 'nav' | 'auth' | 'lg' | 'xl' | 'xxl';

export interface MedicalLoaderContentProps {
    readonly message?: string;
    readonly size?: MedicalLoaderSize;
    readonly className?: string;
}

/**
 * Pure content component. The `GlobalLoaderProvider` and any inline
 * panel-scope caller render this directly without the wrapper.
 *
 * Note: NO `animate-in fade-in zoom-in-95` here — that was the source
 * of the "jerk" in the previous architecture. Entrance is now owned by
 * whichever wrapper renders this content (provider's opacity transition,
 * inline panel's Framer Motion entrance, etc.).
 */
export const MedicalLoaderContent: React.FC<MedicalLoaderContentProps> = ({
    message = 'Securing clinical data...',
    size,
    className,
}) => (
    <div className={cn(
        'flex flex-col items-center justify-center gap-[2.5rem] text-center',
        className
    )}>
        <div className="relative">
            {/* Subtle Glow Background: Institutional standard for depth */}
            <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full scale-150 animate-pulse functionality-reduced-motion:animate-none" />

            {/* Main Logo Container: Mirrored symmetry logic */}
            <div className="relative bg-background rounded-[calc(var(--card-radius)*0.5)] p-6 border border-border shadow-2xl ring-1 ring-black/5">
                <Logo size={size ?? 'auth'} />
            </div>

            {/* Status Indicator (Subtle Pulse) */}
            <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-2 shadow-lg border border-border flex items-center justify-center">
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
            </div>
        </div>

        <div className="space-y-4">
            <div className="flex flex-col items-center justify-center gap-2">
                <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Haemi Life Core
                </h3>
                <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm animate-pulse tracking-wide">
                {message}
            </p>
        </div>
    </div>
);

export interface MedicalLoaderProps extends MedicalLoaderContentProps {
    /**
     * 🧬 INSTITUTIONAL CENTERING VARIANTS
     *
     *   global   → `fixed inset-0` via React Portal for absolute viewport
     *              dominance. **DEPRECATED for new page-level loading**;
     *              use `usePageLoader` from the GlobalLoaderProvider
     *              instead. Retained for the small set of pre-provider
     *              guard / fallback call sites still in transition.
     *   viewport → `absolute inset-0` for localized container-bound
     *              centering. The legitimate use case for this component
     *              going forward (e.g. chat-hub panel, pharmacist
     *              dispense modal).
     */
    readonly variant?: 'global' | 'viewport';
}

export const MedicalLoader: React.FC<MedicalLoaderProps> = ({
    message,
    variant = 'global',
    className,
    size,
}) => {
    const isBrowser: boolean = typeof window !== 'undefined' && typeof document !== 'undefined';

    const wrapper = (
        <div className={cn(
            'z-[99998] flex items-center justify-center bg-background backdrop-blur-md',
            variant === 'global'
                ? 'fixed inset-0 w-screen h-[100dvh]'
                : 'absolute inset-0 w-full h-full'
        )}>
            <MedicalLoaderContent message={message} size={size} className={className} />
        </div>
    );

    if (variant === 'global' && isBrowser) {
        return createPortal(wrapper, document.body);
    }

    return wrapper;
};
