import React, { useCallback, useEffect, useState } from 'react';
import { Card } from './card';
import { Button } from './button';
import { Globe, Pencil } from 'lucide-react';
import { TimezoneSelector } from './timezone-selector';
import { PremiumLoader } from './premium-loader';
import { usePageLoader } from '@/hooks/use-page-loader';

/**
 * 🌍 HAEMI LIFE — CLINIC TIMEZONE CARD (Phase 3 — Timezone Sovereignty)
 *
 * Presentational card that surfaces the doctor's authoritative
 * `clinic_timezone` and lets them change it. Behaviour is delegated up:
 *   - The parent owns the value (loaded from the doctor profile).
 *   - The parent owns the persistence (calls
 *     `updateClinicTimezone()` from `doctor.service.ts`).
 *   - The parent owns the success/error toast.
 *
 * The card itself stays declarative + small — it renders the current
 * value, a live preview line, and a single "Change timezone" affordance
 * that opens the cmdk-backed picker. This keeps the card reusable in
 * future surfaces (settings page, doctor onboarding flow, etc.) without
 * dragging the schedule page's network logic along.
 *
 * Visual posture:
 *   - Light + dark theme correct via `bg-card`, `text-foreground`,
 *     `text-muted-foreground` brand tokens.
 *   - No inline CSS, no `px` literals — every visual binds to a token
 *     via the `haemi-clinic-tz-card-*` family in `index.css` or
 *     existing Tailwind utilities resolved through the theme.
 *   - Mobile-to-desktop responsive: header + meta + action stack
 *     vertically below `sm`, side-by-side at `sm:` and above.
 */

interface ClinicTimezoneCardProps {
    /** Currently-selected IANA timezone (e.g. 'Africa/Gaborone'). */
    readonly value: string;
    /** Fires when the user picks a new timezone. Parent persists. */
    readonly onChange: (timezone: string) => void;
    /** When true, the action button shows a loader and is non-interactive. */
    readonly isUpdating: boolean;
}

const TICK_INTERVAL_MS = 30_000;

/** Computes the human-readable preview line for the displayed timezone. */
const buildPreview = (zone: string, instant: Date): { time: string; offset: string } => {
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

/**
 * Duration the full-page medical loader stays visible after the user
 * clicks "Change timezone" — masks the dialog's enter animation and
 * the picker's mount-time work behind a single intentional loader.
 * 300ms is the institutional minimum (felt intentional, not a flicker).
 */
const PICKER_OPEN_LOADER_MS = 300;

export const ClinicTimezoneCard: React.FC<ClinicTimezoneCardProps> = ({
    value,
    onChange,
    isUpdating,
}) => {
    const [pickerOpen, setPickerOpen] = useState<boolean>(false);
    const [isLoadingPicker, setIsLoadingPicker] = useState<boolean>(false);
    const [now, setNow] = useState<Date>(() => new Date());

    // Drive the global persistent loader while the picker is being
    // brought online. The loader is the only visible surface for
    // ~300ms while Radix Dialog mounts + the (already-cached) zone
    // list paints — same institutional pattern used elsewhere in the
    // app for surface transitions.
    usePageLoader(isLoadingPicker, 'Loading timezones...');

    // Tick the displayed current time at half-minute cadence so the
    // user sees a live preview without sub-minute DOM churn.
    useEffect(() => {
        const interval = window.setInterval(() => setNow(new Date()), TICK_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, []);

    const preview = buildPreview(value, now);

    const handleOpenPicker = useCallback((): void => {
        setIsLoadingPicker(true);
        setPickerOpen(true);
        // Yield a single macrotask so the loader paints first; then
        // hold it `PICKER_OPEN_LOADER_MS` to mask the dialog's enter
        // animation and any first-paint cost of the cached list.
        const timeout = window.setTimeout(
            () => setIsLoadingPicker(false),
            PICKER_OPEN_LOADER_MS
        );
        // Cleanup not strictly needed (the timeout is short and the
        // setter is safe on unmounted components in React 18+), but
        // documenting the intent for the next reader.
        void timeout;
    }, []);

    const handleSelect = (tz: string): void => {
        setPickerOpen(false);
        if (tz !== value) {
            onChange(tz);
        }
    };

    return (
        <>
            <Card className="haemi-clinic-tz-card">
                <div className="haemi-clinic-tz-card-row">
                    <div className="haemi-clinic-tz-card-icon" aria-hidden="true">
                        <Globe className="haemi-clinic-tz-card-icon-svg" />
                    </div>
                    <div className="haemi-clinic-tz-card-body">
                        <h2 className="haemi-clinic-tz-card-title">Clinic Timezone</h2>
                        <p className="haemi-clinic-tz-card-description">
                            All your scheduled slots are interpreted in this timezone. Patients see slot times converted from this anchor.
                        </p>
                        <div className="haemi-clinic-tz-card-current">
                            <span className="haemi-clinic-tz-card-iana">{value}</span>
                            <span className="haemi-clinic-tz-card-meta">
                                {preview.offset.length > 0 ? `${preview.offset} · ` : ''}Currently {preview.time}
                            </span>
                        </div>
                    </div>
                    <div className="haemi-clinic-tz-card-action">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleOpenPicker}
                            disabled={isUpdating || isLoadingPicker}
                            className="haemi-clinic-tz-card-button"
                            aria-label="Change clinic timezone"
                        >
                            {isUpdating ? (
                                <>
                                    <PremiumLoader size="xs" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Pencil className="haemi-clinic-tz-card-button-icon" />
                                    Change timezone
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </Card>

            <TimezoneSelector
                value={value}
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                onSelect={handleSelect}
            />
        </>
    );
};
