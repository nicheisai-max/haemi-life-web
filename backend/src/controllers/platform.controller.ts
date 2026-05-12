import { Request, Response } from 'express';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { auditService } from '../services/audit.service';
import { systemSettingsRepository } from '../repositories/system-settings.repository';
import { isValidIanaTimezone, INSTITUTIONAL_DEFAULT_TIMEZONE } from '../utils/timezone.utils';
import { getPlatformTimezone, invalidateStringConfigCache } from '../utils/config.util';
import { socketIO } from '../app';

/**
 * 🌍 HAEMI LIFE — PLATFORM CONTROLLER (Phase 5 — Timezone Sovereignty)
 *
 * Replaces the per-doctor `clinic_timezone` model with a single
 * platform-wide IANA timezone governed exclusively by the admin role.
 * Every other role (patient, doctor, pharmacist) READS this value
 * through `GET /api/platform/timezone` and renders date/time displays
 * against it; only the admin role can WRITE via
 * `PATCH /api/admin/platform/timezone`.
 *
 * RESPONSIBILITIES
 *
 *   1. Read endpoint exposes the live platform TZ to every
 *      authenticated user. Cached via `getPlatformTimezone()`
 *      (5-min TTL, mirrors `getSessionTimeoutMinutes` /
 *      `getJwtAccessExpiry`).
 *
 *   2. Write endpoint validates the incoming IANA string against
 *      `isValidIanaTimezone()` (delegates to `Intl.DateTimeFormat`'s
 *      ICU zone table — no allow-list maintenance burden), persists
 *      via `systemSettingsRepository.updateSetting`, invalidates the
 *      cache, audit-logs the transition, and broadcasts the new value
 *      to EVERY connected socket so every authenticated tab refreshes
 *      its TZ-aware UI in real time without a reload.
 *
 *   3. Audit trail: every admin-initiated change emits action
 *      `PLATFORM_TIMEZONE_UPDATED` with `previousValue` and `newValue`
 *      in metadata, plus the admin's `userId`, IP, and user-agent.
 *
 * STRICT-TS POSTURE (project mandate)
 *
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`.
 *   - Wire-boundary `unknown` (req.body, req.user) narrowed
 *     structurally with `typeof` + `in` guards.
 *   - Socket emit is fail-safe: a missing `socketIO` (server still
 *     bootstrapping, or runtime without sockets) logs and continues;
 *     the DB write is the source of truth, the broadcast is a UX
 *     accelerator.
 */

const PLATFORM_TIMEZONE_KEY = 'PLATFORM_TIMEZONE' as const;

/**
 * GET /api/platform/timezone — Returns the current platform-wide
 * IANA timezone. Open to ANY authenticated user (patient, doctor,
 * pharmacist, admin) because every role's UI needs to render dates
 * in this timezone.
 */
export const getPlatformTimezoneEndpoint = async (req: Request, res: Response) => {
    try {
        const userId: string | undefined = req.user?.id;
        if (typeof userId !== 'string' || userId.length === 0) {
            return sendError(res, 401, 'Unauthorized');
        }
        const platformTimezone: string = await getPlatformTimezone();
        return sendResponse(res, 200, true, 'Platform timezone fetched', {
            platformTimezone,
        });
    } catch (error: unknown) {
        logger.error('[Platform] Failed to fetch platform timezone', {
            error: error instanceof Error ? error.message : String(error),
        });
        return sendError(res, 500, 'Failed to fetch platform timezone');
    }
};

interface UpdatePlatformTimezoneBody {
    readonly timezone: string;
}

const isUpdateBody = (body: unknown): body is UpdatePlatformTimezoneBody => {
    return (
        typeof body === 'object'
        && body !== null
        && 'timezone' in body
        && typeof (body as { timezone: unknown }).timezone === 'string'
        && (body as { timezone: string }).timezone.length > 0
    );
};

/**
 * PATCH /api/admin/platform/timezone — Admin-only.
 * Body: `{ timezone: '<IANA>' }`. Validates against `isValidIanaTimezone`,
 * persists, invalidates the cache, audit-logs the transition, and
 * broadcasts to every connected socket.
 */
export const updatePlatformTimezoneEndpoint = async (req: Request, res: Response) => {
    const adminUserId: string | undefined = req.user?.id;
    try {
        if (typeof adminUserId !== 'string' || adminUserId.length === 0) {
            return sendError(res, 401, 'Unauthorized');
        }
        if (!isUpdateBody(req.body)) {
            return sendError(res, 400, 'Body must include a non-empty `timezone` string', 'INVALID_BODY');
        }
        const candidate: string = req.body.timezone.trim();
        if (!isValidIanaTimezone(candidate)) {
            return sendError(res, 400, `'${candidate}' is not a recognised IANA timezone`, 'INVALID_TIMEZONE');
        }

        // Snapshot the previous value BEFORE writing so the audit
        // record carries the full transition (forensic visibility).
        const previousValue: string = await getPlatformTimezone();

        await systemSettingsRepository.updateSetting(PLATFORM_TIMEZONE_KEY, candidate);
        // Drop the cached value so the next `getPlatformTimezone()`
        // call reads the freshly-written row instead of the stale
        // 5-minute cache.
        invalidateStringConfigCache(PLATFORM_TIMEZONE_KEY);

        // Audit-log the transition. Failure-tolerant — a failed audit
        // write must not block the response since the change is
        // already persisted. The audit service itself swallows DB
        // errors and logs them.
        await auditService.log({
            userId: adminUserId,
            actorRole: 'admin',
            action: 'PLATFORM_TIMEZONE_UPDATED',
            metadata: {
                previousValue: previousValue || INSTITUTIONAL_DEFAULT_TIMEZONE,
                newValue: candidate,
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });

        // Broadcast to every connected socket. Roomless emit reaches
        // patient, doctor, pharmacist, admin sockets alike — each
        // client's <PlatformTimezoneProvider> listens for this event
        // and updates context, which cascades through every TZ-aware
        // surface (registry dates, appointment cards, audit log
        // timestamps, …). Failure-tolerant: a missing socketIO
        // instance (server bootstrap, or sockets disabled in this
        // runtime) logs at debug and continues — the DB is the
        // source of truth; the broadcast is a real-time UX hop.
        try {
            if (socketIO !== undefined) {
                socketIO.emit('platform-timezone:updated', { platformTimezone: candidate });
            } else {
                logger.debug('[Platform] socketIO not ready; skipping real-time broadcast');
            }
        } catch (broadcastError: unknown) {
            logger.warn('[Platform] Broadcast emit failed; DB write succeeded', {
                error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError),
            });
        }

        return sendResponse(res, 200, true, 'Platform timezone updated', {
            platformTimezone: candidate,
        });
    } catch (error: unknown) {
        logger.error('[Platform] Failed to update platform timezone', {
            error: error instanceof Error ? error.message : String(error),
            adminUserId,
        });
        return sendError(res, 500, 'Failed to update platform timezone');
    }
};
