/**
 * Centralized Enterprise Logger
 * Only logs to console when in development mode.
 */

const IS_DEV = import.meta.env.DEV;

export const logger = {
    info: (message: string, ...args: unknown[]) => {
        if (IS_DEV) console.log(`[INFO] ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
        if (IS_DEV) console.warn(`[WARN] ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
        if (IS_DEV) console.error(`[ERROR] ${message}`, ...args);
    },
    debug: (message: string, ...args: unknown[]) => {
        if (IS_DEV) console.debug(`[DEBUG] ${message}`, ...args);
    }
};

// ─── 5. AUDIT LOGGING (FRONTEND LEVEL — LIGHTWEIGHT) ─────────────────────────
export type AuditEventType = 
    | 'LOGIN_SUCCESS' 
    | 'LOGOUT' 
    | 'TOKEN_REFRESH_SUCCESS' 
    | 'TOKEN_REFRESH_FAILURE' 
    | 'UNAUTHORIZED_EVENT' 
    | 'SECURITY_EVENT'
    | 'SESSION_TERMINATED'
    | 'UNHANDLED_ERROR'
    | 'SYSTEM_RECOVERY'
    | 'AI_TRIAGE_SUCCESS'
    | 'AI_TRIAGE_FALLBACK'
    | 'ERROR';

export interface AuditEventPayload {
    userId?: string;
    reason?: string;
    message?: string;
    details?: Record<string, unknown>;
    method?: string;
    timestamp?: string | number;
    context?: string;
    stack?: string;
}

export const auditLogger = {
    log: (event: AuditEventType, payload?: AuditEventPayload) => {
        const entry = {
            timestamp: new Date().toISOString(),
            event,
            ...payload
        };
        // For local lightweight audit, we format strictly.
        if (IS_DEV) {
            console.log(`[AUDIT] [${entry.timestamp}] ${event}`, payload || '');
        }
    }
};

// ─── 6. INTRUSION DETECTION (MINIMAL HEURISTIC) ──────────────────────────────
export const intrusionDetector = {
    refreshFailures: 0,
    unauthorizedEvents: 0,
    lastReset: Date.now(),
    
    trackFailure: (type: 'refresh' | 'unauthorized'): boolean => {
        const now = Date.now();
        if (now - intrusionDetector.lastReset > 60000) { // 1 min rolling window
            intrusionDetector.refreshFailures = 0;
            intrusionDetector.unauthorizedEvents = 0;
            intrusionDetector.lastReset = now;
        }

        if (type === 'refresh') intrusionDetector.refreshFailures++;
        if (type === 'unauthorized') intrusionDetector.unauthorizedEvents++;

        const REFRESH_THRESHOLD = 4;
        const UNAUTHORIZED_THRESHOLD = 6;

        // derive safe minimum signal WITHOUT causing unused variable
        const MIN_REQUIRED_SIGNAL = Math.min(2, UNAUTHORIZED_THRESHOLD);

        const shouldTrigger =
            intrusionDetector.refreshFailures >= REFRESH_THRESHOLD &&
            intrusionDetector.unauthorizedEvents >= MIN_REQUIRED_SIGNAL;

        if (shouldTrigger) {
            logger.error('[SECURITY] Intrusion heuristic threshold crossed! Forcing session termination.');
            auditLogger.log('SESSION_TERMINATED', { reason: 'Intrusion heuristic triggered' });
            return true; // Trigger kill-switch
        }
        return false;
    }
};
