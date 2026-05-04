import React from 'react';

/**
 * 🛡️ HAEMI LIFE — LiveStatusPill
 *
 * Inline non-clickable status indicator that replaces the previous
 * button-shaped "Live / Polling" pill across all admin surfaces. Sits
 * alongside a heading (NOT inside an action row) so users do not
 * mistake it for a clickable control. The visual is small, animated
 * (a ping-style ring expanding outward from a tinted dot), and fully
 * theme-aware — every visual concern lives in `index.css` under
 * `.haemi-live-pill` / `.haemi-live-pill-on-dark`.
 *
 * Two variants:
 *   • `default` — for normal admin pages (Audit Logs, Security,
 *     Sessions, Verify Doctors, User Management). Uses brand-token
 *     `--sidebar-active` for the LIVE state so light + dark themes
 *     resolve automatically.
 *   • `onDark` — for the admin dashboard's always-dark hero gradient.
 *     Uses `--color-success` (emerald) for the LIVE tint so the chip
 *     differentiates from the nearby "ADMINISTRATOR ACCESS" pill.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - No inline styles, no pixel values, no Tailwind colour utilities —
 *     every visual concern in `index.css` (rem-based, brand-token-driven,
 *     light/dark contrast).
 *   - `cursor: default` + `user-select: none` (set in CSS) make the
 *     non-clickable affordance unambiguous.
 *
 * Accessibility:
 *   - `role="status"` so screen readers announce state changes.
 *   - `aria-live="polite"` so the change is voiced without
 *     interrupting the user.
 *   - Tooltip via `title` attribute carries the full disambiguation
 *     ("Live event stream connected" vs "Polling fallback").
 */

export interface LiveStatusPillProps {
    /** True when the socket is currently connected — drives the LIVE label and pulse. */
    readonly isConnected: boolean;
    /**
     * `default` for normal page surfaces (light + dark themes resolve from
     * `--sidebar-active`); `onDark` for surfaces that are always dark
     * (e.g. the admin dashboard hero gradient) and need an emerald tint.
     */
    readonly variant?: 'default' | 'onDark';
    /** Optional extra class names — composed with the base classes. */
    readonly className?: string;
}

export const LiveStatusPill: React.FC<LiveStatusPillProps> = ({
    isConnected,
    variant = 'default',
    className,
}) => {
    const baseClass: string = variant === 'onDark' ? 'haemi-live-pill-on-dark' : 'haemi-live-pill';
    const offlineClass: string = isConnected ? '' : 'haemi-live-pill-offline';
    const composed: string = [baseClass, offlineClass, className]
        .filter((part): part is string => typeof part === 'string' && part.length > 0)
        .join(' ');

    const tooltip: string = isConnected
        ? 'Live event stream connected'
        : 'Polling fallback (socket disconnected)';
    const label: string = isConnected ? 'Live' : 'Polling';

    return (
        <span
            className={composed}
            role="status"
            aria-live="polite"
            title={tooltip}
        >
            <span
                className="haemi-live-pill-dot"
                data-live={isConnected ? 'true' : 'false'}
                aria-hidden="true"
            />
            {label}
        </span>
    );
};
