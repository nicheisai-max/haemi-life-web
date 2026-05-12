import React, { useEffect, useState, useCallback } from 'react';
import { Globe } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from './dialog';
import { Button } from './button';
import { TimezoneSelector } from './timezone-selector';
import { PremiumLoader } from './premium-loader';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useClinicTimezone } from '@/hooks/use-clinic-timezone';
import { logger } from '@/utils/logger';
import { updateClinicTimezone } from '@/services/doctor.service';
import {
    acknowledgeTimezoneDetection,
    isTimezoneDetectionAcknowledged,
    detectBrowserTimezone,
} from '@/utils/timezone-detection-storage';
import { dispatchClinicTimezoneUpdated } from '@/utils/clinic-timezone-events';

/**
 * 🌍 HAEMI LIFE — DOCTOR TIMEZONE DETECTION MODAL (Phase 4 — Timezone Sovereignty)
 *
 * Mirrors the Windows / macOS post-install pattern: when a doctor first
 * lands on their dashboard, the system detects their local IANA
 * timezone and — if it doesn't match their stored `clinic_timezone` —
 * presents a one-time prompt:
 *
 *   "We detected your timezone: Asia/Kolkata.
 *    Use detected, or pick a different one?"
 *
 * After any interaction (Use Detected / Pick Different / Dismiss) the
 * modal is suppressed forever on this device via a localStorage flag
 * (`haemi_tz_detection_acknowledged_v1`). Logout does not clear the
 * flag — re-prompting after logout is friction without value.
 *
 * Decision tree (all evaluated client-side, no extra round-trips
 * beyond the one profile fetch):
 *
 *   - Not a doctor                        → render nothing
 *   - Already acknowledged (flag set)     → render nothing
 *   - Profile fetch failed                → render nothing (silent
 *                                            degrade; doctor can still
 *                                            change TZ from Schedule
 *                                            Management page)
 *   - Stored TZ === detected TZ           → render nothing (no friction
 *                                            for doctors whose
 *                                            authoritative TZ already
 *                                            matches their device)
 *   - Otherwise                           → modal opens, awaiting one
 *                                            of three terminal actions
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`
 *   - Wire-boundary `unknown` from profile/update calls structurally
 *     narrowed via instanceof + record-shape guards
 *   - All errors via `logger`; no `console.*`
 *
 * Visual posture (project mandate):
 *   - No inline CSS, no `px` literals — every visual binds to a brand
 *     token via the `haemi-tz-detect-*` family in `index.css` or to
 *     existing Tailwind utility classes resolved through the theme.
 *   - Light + dark themes auto-resolve via `bg-card`, `text-foreground`,
 *     `text-muted-foreground`, `--sidebar-active`.
 *   - Mobile-to-desktop responsive: button row stacks vertically below
 *     `40rem`, lays out side-by-side at `sm:` and above.
 */

interface DetectionState {
    /** True once the dashboard mount-time check has finished. Modal is
     *  closed-by-design until this resolves. */
    readonly hydrated: boolean;
    /** Doctor's authoritative TZ from `doctor_profiles.clinic_timezone`. */
    readonly storedTimezone: string;
    /** Browser-detected TZ via `Intl.DateTimeFormat().resolvedOptions()`. */
    readonly detectedTimezone: string;
}

const TICK_INTERVAL_MS = 60_000;

/** Build the live preview line for the detected timezone. */
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

export const DoctorTimezoneDetectionModal: React.FC = () => {
    const { user } = useAuth();
    const toast = useToast();
    const { clinicTimezone, isHydrated: clinicTzHydrated } = useClinicTimezone();

    const [state, setState] = useState<DetectionState>({
        hydrated: false,
        storedTimezone: '',
        detectedTimezone: '',
    });
    const [open, setOpen] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [pickerOpen, setPickerOpen] = useState<boolean>(false);
    const [now, setNow] = useState<Date>(() => new Date());

    const isDoctor: boolean = user?.role === 'doctor';

    /**
     * Mismatch evaluation. Now reads the doctor's clinic timezone from
     * the shared `ClinicTimezoneContext` (hydrated once per session by
     * the provider) instead of issuing its own `getDoctorProfile`
     * round-trip. Re-evaluates whenever the context's `clinicTimezone`
     * changes — so a save from the schedule page (or a cross-tab
     * broadcast) immediately updates this modal's view of "should I
     * re-fire?" without coupling the two surfaces directly.
     */
    useEffect(() => {
        if (!isDoctor || !user?.id || !clinicTzHydrated) return;
        const userId: string = user.id;

        const detected: string = detectBrowserTimezone();
        const stored: string = clinicTimezone;
        const hasMismatch: boolean = stored.length > 0 && stored !== detected;
        const alreadyAcked: boolean = hasMismatch
            ? isTimezoneDetectionAcknowledged({
                userId,
                browserTz: detected,
                clinicTz: stored,
            })
            : false;

        setState({ hydrated: true, storedTimezone: stored, detectedTimezone: detected });
        setOpen(hasMismatch && !alreadyAcked);
    }, [isDoctor, user?.id, clinicTimezone, clinicTzHydrated]);

    // Tick the displayed current time at minute cadence so the doctor
    // sees a live preview while deciding.
    useEffect(() => {
        if (!open) return;
        const interval = window.setInterval(() => setNow(new Date()), TICK_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [open]);

    /**
     * Persist the ack against the mismatch tuple the doctor's decision
     * resolves to. `effectiveClinicTz` defaults to `state.storedTimezone`
     * for the "dismiss without change" path, but the "Use Detected" /
     * "Pick Different" paths pass the POST-update value — otherwise
     * we'd ack the pre-update tuple, and the next session would see
     * `(detected, NEW stored)` as a fresh mismatch and re-fire the
     * modal needlessly. Acking the post-update tuple matches what the
     * next session's profile fetch will return.
     */
    const finishAcknowledged = useCallback((effectiveClinicTz?: string): void => {
        const userId: string | undefined = user?.id;
        const clinicTz: string = effectiveClinicTz ?? state.storedTimezone;
        if (typeof userId === 'string' && userId.length > 0
            && state.detectedTimezone.length > 0
            && clinicTz.length > 0) {
            acknowledgeTimezoneDetection({
                userId,
                browserTz: state.detectedTimezone,
                clinicTz,
            });
        }
        setOpen(false);
    }, [user?.id, state.detectedTimezone, state.storedTimezone]);

    const handleUseDetected = useCallback(async (): Promise<void> => {
        const target: string = state.detectedTimezone;
        if (target.length === 0) return;
        setIsSaving(true);
        try {
            const result = await updateClinicTimezone(target);
            toast.success(`Clinic timezone set to ${result.clinicTimezone}`);
            // Broadcast to every consumer of the clinic timezone in
            // this tab (Schedule Management's <ClinicTimezoneCard>,
            // future dashboard widgets, etc.) so they refresh their
            // local state without waiting for a page reload. Routed
            // through the typed event module — no hardcoded event
            // name here.
            dispatchClinicTimezoneUpdated(result.clinicTimezone);
            // Ack the POST-update tuple — `result.clinicTimezone` is the
            // server's canonical echo, which is what the next mount's
            // profile fetch will return.
            finishAcknowledged(result.clinicTimezone);
        } catch (err: unknown) {
            const apiErr = err as { response?: { data?: { message?: string } } };
            const message: string = apiErr.response?.data?.message ?? 'Failed to update clinic timezone';
            toast.error(message);
            logger.error('[TZDetection] Use-detected update failed', {
                attempted: target,
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setIsSaving(false);
        }
    }, [state.detectedTimezone, toast, finishAcknowledged]);

    const handlePickerSelect = useCallback(async (chosen: string): Promise<void> => {
        setPickerOpen(false);
        if (chosen === state.storedTimezone) {
            // Doctor explicitly picked their existing TZ — no API write
            // needed, but they engaged with the prompt so we still
            // suppress future fires for this exact (browser, clinic)
            // mismatch in this session.
            finishAcknowledged();
            return;
        }
        setIsSaving(true);
        try {
            const result = await updateClinicTimezone(chosen);
            toast.success(`Clinic timezone set to ${result.clinicTimezone}`);
            // Broadcast to every consumer in this tab — see
            // `handleUseDetected` for rationale.
            dispatchClinicTimezoneUpdated(result.clinicTimezone);
            // Ack the POST-update tuple — see `handleUseDetected` for rationale.
            finishAcknowledged(result.clinicTimezone);
        } catch (err: unknown) {
            const apiErr = err as { response?: { data?: { message?: string } } };
            const message: string = apiErr.response?.data?.message ?? 'Failed to update clinic timezone';
            toast.error(message);
            logger.error('[TZDetection] Picker update failed', {
                attempted: chosen,
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setIsSaving(false);
        }
    }, [state.storedTimezone, toast, finishAcknowledged]);

    const handleOpenChange = useCallback((next: boolean): void => {
        if (next) return; // We only ever open from the mount-time effect.
        // Radix dialog dismiss (X / Esc / overlay click) — treat as
        // "asked but skipped"; the doctor's stored value stays as-is
        // and we don't re-prompt on this device.
        finishAcknowledged();
    }, [finishAcknowledged]);

    if (!isDoctor || !state.hydrated) return null;

    const preview = buildPreview(state.detectedTimezone, now);

    return (
        <>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="haemi-tz-detect-content">
                    <div className="haemi-tz-detect-header">
                        <span className="haemi-tz-detect-icon" aria-hidden="true">
                            <Globe className="haemi-tz-detect-icon-svg" />
                        </span>
                        <div className="haemi-tz-detect-header-text">
                            <DialogTitle className="haemi-tz-detect-title">Set Your Clinic Timezone</DialogTitle>
                            <DialogDescription className="haemi-tz-detect-description">
                                Confirm the timezone we detected so your scheduled slots and patient bookings render
                                in the right local time.
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="haemi-tz-detect-callout">
                        <span className="haemi-tz-detect-callout-label">We detected</span>
                        <span className="haemi-tz-detect-callout-iana">{state.detectedTimezone}</span>
                        <span className="haemi-tz-detect-callout-meta">
                            {preview.offset.length > 0 ? `${preview.offset} · ` : ''}Currently {preview.time}
                        </span>
                    </div>

                    <p className="haemi-tz-detect-current">
                        Your current saved timezone:{' '}
                        <span className="haemi-tz-detect-current-iana">{state.storedTimezone}</span>
                    </p>

                    <div className="haemi-tz-detect-actions">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPickerOpen(true)}
                            disabled={isSaving}
                            className="haemi-tz-detect-button"
                        >
                            Choose a different timezone
                        </Button>
                        <Button
                            type="button"
                            onClick={handleUseDetected}
                            disabled={isSaving}
                            className="haemi-tz-detect-button haemi-tz-detect-button-primary"
                        >
                            {isSaving ? (
                                <>
                                    <PremiumLoader size="xs" />
                                    Saving...
                                </>
                            ) : (
                                <>Use {state.detectedTimezone}</>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <TimezoneSelector
                value={state.storedTimezone}
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                onSelect={(zone: string) => { void handlePickerSelect(zone); }}
            />
        </>
    );
};
