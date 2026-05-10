import React, { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { detectBrowserTimezone } from '@/utils/timezone-detection-storage';

/**
 * 🌍 HAEMI LIFE — DOCTOR TIMEZONE BANNER (Phase 5 — Timezone Sovereignty)
 *
 * Patient-side contextual banner rendered near the slot grid on the
 * booking surface. Communicates a single critical fact: the times
 * the patient is about to commit to are in the DOCTOR'S clinic
 * timezone, not the patient's own. Locality-based booking (the
 * dominant case for Haemi Life) means doctor and patient share TZ
 * almost always, so the banner is informational reassurance — not
 * a conversion barrier.
 *
 * When the patient's browser timezone differs from the doctor's
 * clinic timezone (cross-locality booking, traveling patients), a
 * second muted line surfaces the patient's local time alongside —
 * defensive UX that prevents "I booked 10 AM thinking it was MY 10
 * AM" mistakes without forcing a dual-time-per-slot redesign.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`
 *   - All boolean state explicitly typed
 *   - Failure-resilient: an invalid IANA string from upstream
 *     (theoretically impossible after Phase 2's server-side
 *     validation, but defensively narrowed) renders the empty
 *     fallback rather than crashing the booking page.
 *
 * Visual posture (project mandate):
 *   - No inline CSS, no `px` literals — every visual binds to a
 *     brand token via the `haemi-tz-banner-*` family in `index.css`
 *     or to existing Tailwind utilities resolved through the theme.
 *   - Light + dark themes auto-resolve via `--card`, `--border`,
 *     `--foreground`, `--muted-foreground`, `--sidebar-active`,
 *     `--card-radius`, `--muted`.
 *   - Mobile-to-desktop responsive: icon + text stacks vertically
 *     below `30rem` (the sub-lines wrap naturally inside flex), lays
 *     out icon-left + text-block at all wider widths.
 */

interface DoctorTimezoneBannerProps {
    /** IANA timezone string for the doctor's clinic (canonical authority). */
    readonly doctorTimezone: string;
    /** Optional doctor name for personalized copy. Falls back to a
     *  generic phrasing so the banner stays consistent before the
     *  doctor profile resolves. */
    readonly doctorName?: string;
}

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

export const DoctorTimezoneBanner: React.FC<DoctorTimezoneBannerProps> = ({
    doctorTimezone,
    doctorName,
}) => {
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

    if (doctorTimezone.length === 0) return null;

    const doctorPreview: TimezonePreview = buildPreview(doctorTimezone, now);
    const showPatientLine: boolean = browserTimezone.length > 0 && browserTimezone !== doctorTimezone;
    const patientPreview: TimezonePreview | null = showPatientLine
        ? buildPreview(browserTimezone, now)
        : null;

    const ownerLabel: string = doctorName && doctorName.length > 0
        ? `${doctorName}'s clinic timezone`
        : "the doctor's clinic timezone";

    return (
        <div className="haemi-tz-banner" role="note" aria-label="Timezone context">
            <span className="haemi-tz-banner-icon" aria-hidden="true">
                <Globe className="haemi-tz-banner-icon-svg" />
            </span>
            <div className="haemi-tz-banner-body">
                <p className="haemi-tz-banner-primary">
                    All times shown in {ownerLabel}:{' '}
                    <span className="haemi-tz-banner-iana">{doctorTimezone}</span>{' '}
                    <span className="haemi-tz-banner-meta">
                        ({doctorPreview.offset.length > 0 ? `${doctorPreview.offset} · ` : ''}Currently {doctorPreview.time})
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
