import type { SignalData } from 'simple-peer';

/**
 * Represents a Chat Message received via Socket.io
 */
export interface ChatMessageEvent {
    id: string;
    conversation_id: string;
    sender_id: string;
    sender_name: string;
    content: string;
    message_type: 'text' | 'image' | 'document';
    status: 'sent' | 'delivered' | 'read';
    created_at: string;
    attachment_url?: string;
    attachment_type?: string;
    attachments: Array<{
        url: string;
        type: string;
        size: number;
        name: string;
    }>;
    reply_to?: {
        id: string;
        content: string;
        sender_name: string;
    };
}

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

/**
 * Enterprise Hardening: Typed Socket Error Codes (Phase 3 & 8)
 */
export type SocketErrorCode = 
  | 'AUTH_EXPIRED' 
  | 'AUTH_INVALID' 
  | 'TRANSPORT_FAILURE' 
  | 'TRANSPORT_TIMEOUT'
  | 'TRANSPORT_DISCONNECTED'
  | 'TRANSPORT_HANDSHAKE_FAILED'
  | 'NETWORK_OFFLINE'
  | 'SERVER_REJECTED' 
  | 'UNKNOWN';

export interface SocketErrorPayload {
    code: SocketErrorCode;
    message: string;
}
