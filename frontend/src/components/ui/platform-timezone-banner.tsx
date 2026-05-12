import React, { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { detectBrowserTimezone } from '@/utils/timezone-detection-storage';
import { usePlatformTimezone } from '@/hooks/use-platform-timezone';

/**
 * 🌍 HAEMI LIFE — PLATFORM TIMEZONE BANNER (Phase 5 — Timezone Sovereignty)
 *
 * Patient-side contextual banner rendered near the slot grid on the
 * booking surface and any other patient-facing flow that displays
 * platform-anchored times. Replaces the per-doctor
 * `<DoctorTimezoneBanner>` with the new architecture: the platform
 * timezone is the SINGLE source of truth across every role, governed
 * exclusively by admin.
 *
 * The banner communicates the same critical fact as before: the
 * times the patient is about to commit to are in the platform's
 * timezone, not the patient's own. When the patient's browser
 * timezone differs from the platform's, a second muted line
 * surfaces the patient's local time alongside — defensive UX that
 * prevents "I booked 10 AM thinking it was MY 10 AM" mistakes
 * without forcing a dual-time-per-slot redesign.
 *
 * The component reads the platform TZ from context (no prop), so
 * any admin-side change propagates here in real time via the
 * provider's socket subscription — no banner-level refetch needed.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`.
 *   - All boolean state explicitly typed.
 *   - Failure-resilient: an invalid IANA string (theoretically
 *     impossible after server-side validation, but defensively
 *     narrowed) renders the empty fallback rather than crashing
 *     the booking page.
 *
 * Visual posture (project mandate):
 *   - No inline CSS, no `px` literals — every visual binds to a
 *     brand token via the `haemi-tz-banner-*` family in `index.css`
 *     or to existing Tailwind utilities resolved through the theme.
 *   - Light + dark themes auto-resolve via `--card`, `--border`,
 *     `--foreground`, `--muted-foreground`, `--sidebar-active`,
 *     `--card-radius`, `--muted`.
 *   - Mobile-to-desktop responsive: icon + text stacks vertically
 *     below `30rem` (the sub-lines wrap naturally inside flex),
 *     lays out icon-left + text-block at all wider widths.
 */

const TICK_INTERVAL_MS = 60_000;

interface TimezonePreview {
    readonly time: string;
    readonly offset: string;
}

const buildPreview = (zone: string, instant: Date): TimezonePreview => {
    try {
        const time: string = new Intl.DateTimeFormat('en-GB', {
            timeZone: zone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(instant);
        const offsetParts = new Intl.DateTimeFormat('en-GB', {
            timeZone: zone,
            timeZoneName: 'shortOffset',
        }).formatToParts(instant);
        const offset: string = offsetParts.find(p => p.type === 'timeZoneName')?.value ?? '';
        return { time, offset };
    } catch {
        return { time: '—', offset: '' };
    }
};

export const PlatformTimezoneBanner: React.FC = () => {
    const { platformTimezone } = usePlatformTimezone();
    const [now, setNow] = useState<Date>(() => new Date());
    const [browserTimezone] = useState<string>(() => detectBrowserTimezone());

    // Tick the displayed current time at minute cadence so the banner
    // stays fresh while the patient deliberates. The hook only mounts
    // once per banner instance and tears down on unmount — `useState`
    // with a lazy initializer handles the per-mount detection.
    useEffect(() => {
        const interval = window.setInterval(() => setNow(new Date()), TICK_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, []);

    if (platformTimezone.length === 0) return null;

    const platformPreview: TimezonePreview = buildPreview(platformTimezone, now);
    const showPatientLine: boolean = browserTimezone.length > 0 && browserTimezone !== platformTimezone;
    const patientPreview: TimezonePreview | null = showPatientLine
        ? buildPreview(browserTimezone, now)
        : null;

    return (
        <div className="haemi-tz-banner" role="note" aria-label="Timezone context">
            <span className="haemi-tz-banner-icon" aria-hidden="true">
                <Globe className="haemi-tz-banner-icon-svg" />
            </span>
            <div className="haemi-tz-banner-body">
                <p className="haemi-tz-banner-primary">
                    All times shown in the platform timezone:{' '}
                    <span className="haemi-tz-banner-iana">{platformTimezone}</span>{' '}
                    <span className="haemi-tz-banner-meta">
                        ({platformPreview.offset.length > 0 ? `${platformPreview.offset} · ` : ''}Currently {platformPreview.time})
                    </span>
                </p>
                {patientPreview !== null ? (
                    <p className="haemi-tz-banner-secondary">
                        Your local timezone:{' '}
                        <span className="haemi-tz-banner-iana-secondary">{browserTimezone}</span>{' '}
                        <span className="haemi-tz-banner-meta">
                            ({patientPreview.offset.length > 0 ? `${patientPreview.offset} · ` : ''}Currently {patientPreview.time})
                        </span>
                    </p>
                ) : null}
            </div>
        </div>
    );
};
