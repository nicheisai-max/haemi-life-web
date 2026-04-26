import { z } from 'zod';
import type { SignalData } from 'simple-peer';

/**
 * 🛡️ INSTITUTIONAL DATA INTEGRITY: Zod Schemas (Phase 8)
 * Using Zod ensures that incoming socket payloads are validated at the edge
 * before entering the application state, preventing systemic drift.
 */

export const SocketErrorCodeSchema = z.enum([
    'AUTH_EXPIRED', 
    'AUTH_INVALID', 
    'TRANSPORT_FAILURE', 
    'TRANSPORT_TIMEOUT',
    'TRANSPORT_DISCONNECTED',
    'TRANSPORT_HANDSHAKE_FAILED',
    'NETWORK_OFFLINE',
    'SERVER_REJECTED', 
    'UNKNOWN'
]);

export const SocketErrorPayloadSchema = z.object({
    code: SocketErrorCodeSchema,
    message: z.string()
});

export const ChatMessageEventSchema = z.object({
    id: z.string(),
    conversationId: z.string(),
    senderId: z.string(),
    senderName: z.string(),
    content: z.string(),
    messageType: z.enum(['text', 'image', 'document']),
    status: z.enum(['sent', 'delivered', 'read']),
    createdAt: z.string(),
    attachmentUrl: z.string().optional(),
    attachmentType: z.string().optional(),
    attachments: z.array(z.object({
        id: z.string().optional(),
        url: z.string(),
        type: z.string(),
        size: z.number(),
        name: z.string()
    })),
    replyTo: z.object({
        id: z.string(),
        content: z.string(),
        senderName: z.string()
    }).optional()
});

/* ---------------- TYPES ---------------- */

export type SocketErrorCode = z.infer<typeof SocketErrorCodeSchema>;
export type SocketErrorPayload = z.infer<typeof SocketErrorPayloadSchema>;
export type ChatMessageEvent = z.infer<typeof ChatMessageEventSchema>;

/**
 * Represents WebRTC signaling data for simple-peer
 */
export interface PeerSignalPayload {
    offer?: SignalData;
    answer?: SignalData;
    candidate?: SignalData;
    to: string;
    from?: string;
    socket?: string;
}

/**
 * Type-safe listener function for socket events
 */
export type SocketListener<T = unknown> = (...args: T[]) => void;

/**
 * Enterprise Hardening: Strict Connection States (Phase 5)
 */
export type SocketConnectionState = 
  | 'IDLE' 
  | 'CONNECTING' 
  | 'CONNECTED' 
  | 'FAILED' 
  | 'RETRYING' 
  | 'CLOSED' 
  | 'TRANSPORT_DISCONNECTED' 
  | 'TRANSPORT_TIMEOUT' 
  | 'HANDSHAKE_FAILED';
