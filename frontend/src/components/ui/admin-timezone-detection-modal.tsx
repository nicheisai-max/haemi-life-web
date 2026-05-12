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
import { usePlatformTimezone } from '@/hooks/use-platform-timezone';
import { logger } from '@/utils/logger';
import { updatePlatformTimezone } from '@/services/platform.service';
import {
    acknowledgeTimezoneDetection,
    isTimezoneDetectionAcknowledged,
    detectBrowserTimezone,
} from '@/utils/timezone-detection-storage';
import { dispatchPlatformTimezoneUpdated } from '@/utils/platform-timezone-events';

/**
 * 🌍 HAEMI LIFE — ADMIN TIMEZONE DETECTION MODAL
 *      (Phase 5 — Timezone Sovereignty, Platform-Wide)
 *
 * Replaces `<DoctorTimezoneDetectionModal>` with an admin-scoped
 * variant. Because the platform timezone now affects EVERY role
 * across the entire deployment, the modal asks for an explicit
 * TWO-CLICK confirmation — never a silent commit. The flow:
 *
 *   1. Mount-time evaluation on every admin landing in the clinical
 *      layout. We detect the admin's browser timezone via `Intl`
 *      and compare it to the live platform timezone from context.
 *   2. If they differ AND the admin hasn't acknowledged this exact
 *      mismatch tuple this session, the dialog opens with TWO
 *      affordances:
 *        a) "Use detected timezone" → confirm step → ONE more click
 *           to commit. Two clicks total.
 *        b) "Pick a different timezone" → opens the IANA picker.
 *   3. Dismissal (X / Esc / overlay click) records the mismatch
 *      tuple in session-scoped storage so the modal doesn't pester
 *      the admin again in the same tab.
 *
 * The two-click confirmation is the institutional UX move: the
 * platform timezone affects patient appointment reminders, doctor
 * schedule slots, pharmacist queue timestamps, audit log render,
 * and cron job trigger times. A single accidental click should NOT
 * be able to ripple a TZ change across an entire production
 * deployment. Admins explicitly opt in.
 *
 * STRICT-TS POSTURE
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`,
 *     zero `eslint-disable`.
 *   - Wire-boundary `unknown` (axios error shape) narrowed
 *     structurally via property-existence guards.
 *
 * VISUAL POSTURE
 *   - No inline CSS, no `px` literals — every visual binds to a
 *     brand token via the `haemi-tz-detect-*` family in `index.css`
 *     or to existing Tailwind utilities. Light + dark themes
 *     auto-resolve.
 *   - Mobile-to-desktop responsive: action row stacks vertically
 *     below 40rem, side-by-side at `sm:` and above.
 */

interface DetectionState {
    readonly hydrated: boolean;
    readonly storedTimezone: string;
    readonly detectedTimezone: string;
}

type ConfirmationStep = 'choice' | 'confirm-detected';

const TICK_INTERVAL_MS = 60_000;

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

export const AdminTimezoneDetectionModal: React.FC = () => {
    const { user } = useAuth();
    const toast = useToast();
    const { platformTimezone, isHydrated: ctxHydrated } = usePlatformTimezone();

    const [state, setState] = useState<DetectionState>({
        hydrated: false,
        storedTimezone: '',
        detectedTimezone: '',
    });
    const [open, setOpen] = useState<boolean>(false);
    const [step, setStep] = useState<ConfirmationStep>('choice');
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [pickerOpen, setPickerOpen] = useState<boolean>(false);
    const [now, setNow] = useState<Date>(() => new Date());

    const isAdmin: boolean = user?.role === 'admin';

    // Mismatch evaluation. Re-runs whenever the context's TZ
    // changes — so a cross-tab save from this admin's other browser
    // immediately re-evaluates here without a refetch.
    useEffect(() => {
        if (!isAdmin || !user?.id || !ctxHydrated) return;
        const userId: string = user.id;

        const detected: string = detectBrowserTimezone();
        const stored: string = platformTimezone;
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
    }, [isAdmin, user?.id, platformTimezone, ctxHydrated]);

    // Tick the displayed current time at minute cadence so the
    // preview stays fresh while the admin deliberates.
    useEffect(() => {
        if (!open) return;
        const interval = window.setInterval(() => setNow(new Date()), TICK_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [open]);

    /**
     * Persist the ack against the EXACT mismatch tuple the admin
     * saw. If any field changes later (browser TZ, platform TZ, or
     * user identity), the next mount won't find a matching ack and
     * will re-fire the modal.
     */
    const finishAcknowledged = useCallback((effectiveTz?: string): void => {
        const userId: string | undefined = user?.id;
        const clinicTz: string = effectiveTz ?? state.storedTimezone;
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
        setStep('choice');
    }, [user?.id, state.detectedTimezone, state.storedTimezone]);

    const handleAdvanceToConfirm = useCallback((): void => {
        setStep('confirm-detected');
    }, []);

    const handleBackToChoice = useCallback((): void => {
        setStep('choice');
    }, []);

    const handleConfirmDetected = useCallback(async (): Promise<void> => {
        const target: string = state.detectedTimezone;
        if (target.length === 0) return;
        setIsSaving(true);
        try {
            const result = await updatePlatformTimezone(target);
            toast.success(`Platform timezone set to ${result.platformTimezone}`);
            // Broadcast to every consumer in this tab — backend
            // socket emit covers cross-tab + cross-client. The same-
            // tab dispatch makes the change observable BEFORE the
            // socket round-trip lands.
            dispatchPlatformTimezoneUpdated(result.platformTimezone);
            finishAcknowledged(result.platformTimezone);
        } catch (err: unknown) {
            const message: string = err instanceof Error ? err.message : 'Failed to update platform timezone';
            toast.error(message);
            logger.error('[AdminTZDetection] Confirm-detected update failed', {
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
            finishAcknowledged();
            return;
        }
        setIsSaving(true);
        try {
            const result = await updatePlatformTimezone(chosen);
            toast.success(`Platform timezone set to ${result.platformTimezone}`);
            dispatchPlatformTimezoneUpdated(result.platformTimezone);
            finishAcknowledged(result.platformTimezone);
        } catch (err: unknown) {
            const message: string = err instanceof Error ? err.message : 'Failed to update platform timezone';
            toast.error(message);
            logger.error('[AdminTZDetection] Picker update failed', {
                attempted: chosen,
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setIsSaving(false);
        }
    }, [state.storedTimezone, toast, finishAcknowledged]);

    const handleOpenChange = useCallback((next: boolean): void => {
        if (next) return; // We only ever open from the mount-time effect.
        finishAcknowledged();
    }, [finishAcknowledged]);

    if (!isAdmin || !state.hydrated) return null;

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
                            <DialogTitle className="haemi-tz-detect-title">
                                {step === 'choice' ? 'Update Platform Timezone?' : 'Confirm Platform Timezone Change'}
                            </DialogTitle>
                            <DialogDescription className="haemi-tz-detect-description">
                                {step === 'choice'
                                    ? 'Your browser timezone differs from the current platform timezone. As admin, you can update the platform-wide timezone — this affects every patient, doctor, and pharmacist across the deployment.'
                                    : 'You are about to change the timezone for the ENTIRE platform. Every role — patients, doctors, pharmacists — will see all dates and times in this new timezone. This action is audit-logged.'}
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
                        Current platform timezone:{' '}
                        <span className="haemi-tz-detect-current-iana">{state.storedTimezone}</span>
                    </p>

                    <div className="haemi-tz-detect-actions">
                        {step === 'choice' ? (
                            <>
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
                                    onClick={handleAdvanceToConfirm}
                                    disabled={isSaving}
                                    className="haemi-tz-detect-button haemi-tz-detect-button-primary"
                                >
                                    Use {state.detectedTimezone}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleBackToChoice}
                                    disabled={isSaving}
                                    className="haemi-tz-detect-button"
                                >
                                    Back
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleConfirmDetected}
                                    disabled={isSaving}
                                    className="haemi-tz-detect-button haemi-tz-detect-button-primary"
                                >
                                    {isSaving ? (
                                        <>
                                            <PremiumLoader size="xs" />
                                            Applying platform-wide...
                                        </>
                                    ) : (
                                        <>Confirm and apply to entire platform</>
                                    )}
                                </Button>
                            </>
                        )}
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
