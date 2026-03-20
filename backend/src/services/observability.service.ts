import { socketIO } from '../app';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import {
    SessionStartedEventSchema,
    SessionEndedEventSchema,
    LoginSuccessEventSchema,
    LoginFailureEventSchema,
    TokenRefreshedEventSchema,
    SessionStartedEvent,
    SessionEndedEvent,
    LoginEvent,
    TokenRefreshedEvent,
    ObservabilityBatch,
    ObservabilityBatchSchema
} from '../../../shared/schemas/observability.schema';

// 🔒 Exact event union from schema
type ObservabilityEvent = ObservabilityBatch['events'][number];
type ObservabilityEventType = ObservabilityEvent['type'];

class ObservabilityService {
    private readonly ADMIN_ROOM = 'admin:observability';
    private readonly BATCH_THRESHOLD = 5;
    private readonly BATCH_WINDOW_MS = 3000;

    private eventsBuffer: ObservabilityEvent[] = [];
    private batchTimer: NodeJS.Timeout | null = null;
    private recentEventHashes = new Set<string>();

    // 🔒 unknown is SAFE (no any leak)
    private deduplicate(type: ObservabilityEventType, data: unknown): boolean {
        const hash = crypto.createHash('sha256')
            .update(JSON.stringify({ type, data }))
            .digest('hex');

        if (this.recentEventHashes.has(hash)) return true;

        this.recentEventHashes.add(hash);

        setTimeout(() => this.recentEventHashes.delete(hash), 10000);

        return false;
    }

    // 🔒 PERFECTLY MATCHED WITH SCHEMA UNION
    private addToBatch(event: ObservabilityEvent) {
        if (this.deduplicate(event.type, event.data)) return;

        this.eventsBuffer.push(event);

        if (this.eventsBuffer.length >= this.BATCH_THRESHOLD) {
            this.flushBatch();
        } else if (!this.batchTimer) {
            this.batchTimer = setTimeout(() => this.flushBatch(), this.BATCH_WINDOW_MS);
        }
    }

    private flushBatch() {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        if (this.eventsBuffer.length === 0) return;

        const batch: ObservabilityBatch = {
            events: [...this.eventsBuffer],
            timestamp: new Date().toISOString(),
            batch_id: crypto.randomUUID(),
        };

        try {
            const validated = ObservabilityBatchSchema.parse(batch);

            socketIO?.to(this.ADMIN_ROOM).emit('observability_batch', validated);

            logger.info(
                `[Observability] Flushed batch ${batch.batch_id} with ${batch.events.length} events`
            );
        } catch (error) {
            logger.error('[Observability] Failed to flush batch:', error);
        } finally {
            this.eventsBuffer = [];
        }
    }

    public logLogin(event: LoginEvent) {
        try {
            if (event.success) {
                const validated = LoginSuccessEventSchema.parse(event);
                this.addToBatch({ type: 'login_success', data: validated });
            } else {
                const validated = LoginFailureEventSchema.parse(event);
                this.addToBatch({ type: 'login_failure', data: validated });
            }
        } catch (error) {
            logger.error('[Observability] Failed to buffer login event:', error);
        }
    }

    public logSessionStart(event: SessionStartedEvent) {
        try {
            const validated = SessionStartedEventSchema.parse(event);
            this.addToBatch({ type: 'session_started', data: validated });
        } catch (error) {
            logger.error('[Observability] Failed to buffer session start:', error);
        }
    }

    public logSessionEnd(event: SessionEndedEvent) {
        try {
            const validated = SessionEndedEventSchema.parse(event);
            this.addToBatch({ type: 'session_ended', data: validated });
        } catch (error) {
            logger.error('[Observability] Failed to buffer session end:', error);
        }
    }

    public logTokenRefresh(event: TokenRefreshedEvent) {
        try {
            const validated = TokenRefreshedEventSchema.parse(event);
            this.addToBatch({ type: 'token_refreshed', data: validated });
        } catch (error) {
            logger.error('[Observability] Failed to buffer token refresh:', error);
        }
    }
}

export const observabilityService = new ObservabilityService();