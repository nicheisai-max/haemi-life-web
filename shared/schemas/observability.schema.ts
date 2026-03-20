import { z } from 'zod';

export const UserRoleSchema = z.enum(['patient', 'doctor', 'pharmacist', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const SessionStatusSchema = z.enum(['active', 'expired', 'revoked']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SourceEnum = z.enum(['backend', 'socket', 'system']);
export type Source = z.infer<typeof SourceEnum>;

export const SessionMetadataSchema = z.object({
    session_id: z.string().uuid(),
    user_id: z.string().uuid(),
    role: UserRoleSchema,
    login_time: z.string().datetime(),
    last_activity: z.string().datetime(),
    status: SessionStatusSchema,
    ip_address: z.string().optional(),
    user_agent: z.string().optional(),
});

export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

export const SessionStartedEventSchema = z.object({
    session: SessionMetadataSchema,
    timestamp: z.string().datetime(),
    source: SourceEnum.default('backend'),
});

export const SessionEndedEventSchema = z.object({
    session_id: z.string().uuid().nullable(),
    user_id: z.string().uuid(),
    reason: z.string().optional(),
    timestamp: z.string().datetime(),
    source: SourceEnum.default('backend'),
});

export const LoginSuccessEventSchema = z.object({
    success: z.literal(true),
    user_id: z.string().uuid(),
    role: UserRoleSchema,
    identifier: z.string(),
    timestamp: z.string().datetime(),
    ip_address: z.string().optional(),
    user_agent: z.string().optional(),
    source: SourceEnum.default('backend'),
});

export const LoginFailureEventSchema = z.object({
    success: z.literal(false),
    user_id: z.string().uuid().optional(),
    role: UserRoleSchema.optional(),
    identifier: z.string(),
    reason: z.string(),
    timestamp: z.string().datetime(),
    ip_address: z.string().optional(),
    user_agent: z.string().optional(),
    source: SourceEnum.default('backend'),
});

export const LoginEventSchema = z.discriminatedUnion('success', [
    LoginSuccessEventSchema,
    LoginFailureEventSchema,
]);

export const TokenRefreshedEventSchema = z.object({
    session_id: z.string().uuid(),
    user_id: z.string().uuid(),
    timestamp: z.string().datetime(),
    source: SourceEnum.default('backend'),
});

/* ---------------- BATCHING ---------------- */

export const ObservabilityBatchSchema = z.object({
    events: z.array(z.discriminatedUnion('type', [
        z.object({ type: z.literal('session_started'), data: SessionStartedEventSchema }),
        z.object({ type: z.literal('session_ended'), data: SessionEndedEventSchema }),
        z.object({ type: z.literal('login_success'), data: LoginSuccessEventSchema }),
        z.object({ type: z.literal('login_failure'), data: LoginFailureEventSchema }),
        z.object({ type: z.literal('token_refreshed'), data: TokenRefreshedEventSchema }),
    ])),
    timestamp: z.string().datetime(),
    batch_id: z.string().uuid(),
});

export type ObservabilityBatch = z.infer<typeof ObservabilityBatchSchema>;

export type SessionStartedEvent = z.infer<typeof SessionStartedEventSchema>;
export type SessionEndedEvent = z.infer<typeof SessionEndedEventSchema>;
export type LoginEvent = z.infer<typeof LoginEventSchema>;
export type TokenRefreshedEvent = z.infer<typeof TokenRefreshedEventSchema>;
