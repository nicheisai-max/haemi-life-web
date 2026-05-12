import React, { useEffect, useState } from 'react';
import { Card } from './card';
import { Button } from './button';
import { Globe, Pencil, ShieldCheck } from 'lucide-react';
import { TimezoneSelector } from './timezone-selector';
import { PremiumLoader } from './premium-loader';

/**
 * 🌍 HAEMI LIFE — PLATFORM TIMEZONE CARD (Phase 5 — Timezone Sovereignty)
 *
 * Replaces the per-doctor `<ClinicTimezoneCard>` with a role-aware
 * surface for the platform-wide timezone:
 *
 *   - ADMIN MODE   (`editable={true}`):
 *       Picker opens on click, onChange fires when the admin selects
 *       a new IANA zone. Behaves identically to the legacy card.
 *
 *   - READ-ONLY MODE  (`editable={false}` — default):
 *       No picker. No change button. Replaced with a "Managed by
 *       admin" badge so doctors / patients / pharmacists understand
 *       why they can't edit it (and where to escalate if the value
 *       is wrong). This is the institutional UX move: the
 *       affordance is absent, not present-but-disabled — disabled
 *       controls invite "why won't this work?" support requests.
 *
 * Behaviour delegation is unchanged from the legacy card:
 *   - The parent owns the value (loaded from the platform context).
 *   - The parent owns persistence (admin calls
 *     `updatePlatformTimezone()` from `services/platform.service.ts`).
 *   - The parent owns success/error feedback.
 *
 * VISUAL POSTURE (project mandate)
 *   - Light + dark theme correct via `bg-card`, `text-foreground`,
 *     `text-muted-foreground` brand tokens.
 *   - No inline CSS, no `px` literals — every visual binds to a token
 *     via the `haemi-clinic-tz-card-*` family in `index.css` or
 *     existing Tailwind utilities resolved through the theme. The CSS
 *     class names retain the legacy `clinic-tz` prefix so this PR
 *     doesn't churn `index.css` unnecessarily; a future PR can
 *     rename the CSS surface in lockstep.
 *   - Mobile-to-desktop responsive: header + meta + action stack
 *     vertically below `sm`, side-by-side at `sm:` and above.
 */

interface PlatformTimezoneCardProps {
    /** Currently-selected IANA timezone (e.g. 'Africa/Gaborone'). */
    readonly value: string;
    /**
     * `true` to render with the change button + picker (admin role
     * only); `false` (default) renders the read-only "Managed by
     * admin" surface for non-admin roles.
     */
    readonly editable?: boolean;
    /**
     * Fires when an admin picks a new timezone. Required when
     * `editable === true`; ignored otherwise. The parent owns the
     * actual API call + broadcast.
     */
    readonly onChange?: (timezone: string) => void;
    /**
     * When true and `editable === true`, the action button shows a
     * loader and is non-interactive (used during the optimistic-write
     * round-trip).
     */
    readonly isUpdating?: boolean;
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

export const PlatformTimezoneCard: React.FC<PlatformTimezoneCardProps> = ({
    value,
    editable = false,
    onChange,
    isUpdating = false,
}) => {
    const [pickerOpen, setPickerOpen] = useState<boolean>(false);
    const [now, setNow] = useState<Date>(() => new Date());

    // Tick the displayed current time at half-minute cadence so the
    // user sees a live preview without sub-minute DOM churn.
    useEffect(() => {
        const interval = window.setInterval(() => setNow(new Date()), TICK_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, []);

    const preview = buildPreview(value, now);

    const handleSelect = (tz: string): void => {
        setPickerOpen(false);
        if (tz !== value && onChange !== undefined) {
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
                        <h2 className="haemi-clinic-tz-card-title">Platform Timezone</h2>
                        <p className="haemi-clinic-tz-card-description">
                            {editable
                                ? 'Sets the operating timezone for the entire platform. Every role — patients, doctors, pharmacists — sees dates and times converted from this anchor.'
                                : 'Set by your administrator. All scheduled slots, appointments, and clinical timestamps across the platform are interpreted in this timezone.'}
                        </p>
                        <div className="haemi-clinic-tz-card-current">
                            <span className="haemi-clinic-tz-card-iana">{value}</span>
                            <span className="haemi-clinic-tz-card-meta">
                                {preview.offset.length > 0 ? `${preview.offset} · ` : ''}Currently {preview.time}
                            </span>
                        </div>
                    </div>
                    <div className="haemi-clinic-tz-card-action">
                        {editable ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setPickerOpen(true)}
                                disabled={isUpdating}
                                className="haemi-clinic-tz-card-button"
                                aria-label="Change platform timezone"
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
                        ) : (
                            <div
                                className="haemi-clinic-tz-card-managed-badge"
                                role="status"
                                aria-label="This timezone is managed by your administrator"
                            >
                                <ShieldCheck className="haemi-clinic-tz-card-button-icon" aria-hidden="true" />
                                <span>Managed by admin</span>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {editable ? (
                <TimezoneSelector
                    value={value}
                    open={pickerOpen}
                    onOpenChange={setPickerOpen}
                    onSelect={handleSelect}
                />
            ) : null}
        </>
    );
};
