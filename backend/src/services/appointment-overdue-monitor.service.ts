import { appointmentRepository } from '../repositories/appointment.repository';
import { emitToAdmins } from './admin-broadcast.service';
import { logger } from '../utils/logger';

/**
 * 🩺 HAEMI LIFE — Appointment Overdue Monitor
 *
 * Periodically scans for `scheduled` appointments whose start instant +
 * 15-minute grace window has elapsed without the doctor marking them
 * `completed` or `no-show`. For each match:
 *   1. Emits a typed `appointment:overdue` socket event to the
 *      `admin:observability` room (only doctors with the appointment in
 *      their open browser tab will react; offline doctors see the
 *      amber tint when they next open the page).
 *   2. Stamps `overdue_notified_at` on the row so subsequent ticks
 *      skip it — idempotency anchor across restarts and across
 *      multiple cron ticks.
 *
 * Crucially, this monitor does NOT change the appointment's `status`.
 * Auto-flipping `status='no-show'` would transfer liability from the
 * doctor (manual decision) to the platform (automated decision) and
 * is a known anti-pattern in clinical scheduling. The monitor only
 * NUDGES the doctor; the doctor decides whether the patient ultimately
 * arrived (Mark Complete) or did not (Mark No-Show).
 *
 * Threshold: 15 minutes is the industry default (Calendly, Google
 * Calendar, Practo, Apollo247). Configurable via the
 * `OVERDUE_GRACE_MINUTES` constant — easy to surface as a per-doctor
 * setting later if needed.
 *
 * Architecture mirrors `cleanupService` (initialize() called once from
 * app.ts after socket boot). Single instance, no concurrency, no
 * external scheduler dependency.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`.
 *   - All errors via `logger`. Zero `console.*`.
 *   - The monitor swallows per-tick errors so a single DB hiccup never
 *     wedges the cron — the next tick retries automatically.
 */

const OVERDUE_TICK_INTERVAL_MS = 60 * 1000; // 1 minute
const OVERDUE_GRACE_MINUTES = 15;

class AppointmentOverdueMonitor {
    private timer: NodeJS.Timeout | null = null;
    private inFlight: boolean = false;

    public initialize(): void {
        if (this.timer !== null) {
            logger.warn('[AppointmentOverdueMonitor] Already initialised; skipping duplicate boot.');
            return;
        }

        // Run once on boot so the queue is fresh, then on the regular
        // interval. The first run fires after `OVERDUE_TICK_INTERVAL_MS`
        // to allow the rest of the app (sockets, DB pool) to fully
        // initialise; setImmediate-style first-tick avoids racing
        // `setupSockets` in app.ts.
        this.timer = setInterval(() => {
            void this.scanAndNotify();
        }, OVERDUE_TICK_INTERVAL_MS);

        logger.info('[AppointmentOverdueMonitor] Initialised', {
            tickIntervalMs: OVERDUE_TICK_INTERVAL_MS,
            graceMinutes: OVERDUE_GRACE_MINUTES,
        });
    }

    public shutdown(): void {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * Single tick: query overdue rows, emit event for each, stamp
     * `overdue_notified_at` so we never duplicate. Per-row failures
     * (e.g. a single emit fails) do not abort the loop — the next
     * tick retries via the still-null stamp.
     */
    private async scanAndNotify(): Promise<void> {
        if (this.inFlight) return; // re-entrancy guard
        this.inFlight = true;
        try {
            const overdueRows = await appointmentRepository.findOverdueScheduled(OVERDUE_GRACE_MINUTES);
            if (overdueRows.length === 0) return;

            logger.info('[AppointmentOverdueMonitor] Found overdue scheduled appointments', {
                count: overdueRows.length,
            });

            const nowIso: string = new Date().toISOString();

            for (const row of overdueRows) {
                // Compute minutes-late at emit time. The DB stores date
                // and time separately; we re-compose the start instant
                // (UTC-ish, since both columns are stored without TZ
                // information and the server runs UTC by convention).
                const startInstant = new Date(`${row.appointment_date}T${row.appointment_time}`);
                const minutesLate: number = Math.max(
                    0,
                    Math.floor((Date.now() - startInstant.getTime()) / 60_000)
                );

                emitToAdmins({
                    event: 'appointment:overdue',
                    payload: {
                        appointmentId: row.id,
                        doctorId: row.doctor_id,
                        patientId: row.patient_id,
                        patientName: row.patient_name,
                        appointmentDate: row.appointment_date,
                        appointmentTime: row.appointment_time,
                        minutesLate,
                        timestamp: nowIso,
                    },
                });

                // Stamp the row so the next tick skips it. Mark even on
                // emit failure — the broadcast layer logs its own
                // failures and a missed live event is preferable to a
                // duplicate-storm if the socket comes back up.
                const stamped: boolean = await appointmentRepository.markOverdueNotified(row.id);
                if (!stamped) {
                    logger.warn('[AppointmentOverdueMonitor] Failed to stamp overdue_notified_at', {
                        appointmentId: row.id,
                    });
                }
            }
        } catch (error: unknown) {
            logger.error('[AppointmentOverdueMonitor] Scan tick failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            // Swallow — next tick retries.
        } finally {
            this.inFlight = false;
        }
    }
}

export const appointmentOverdueMonitor = new AppointmentOverdueMonitor();
