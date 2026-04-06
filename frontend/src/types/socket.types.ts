import type { SignalData } from 'simple-peer';

/**
 * Represents a Chat Message received via Socket.io
 */
export interface ChatMessageEvent {
    id: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    content: string;
    messageType: 'text' | 'image' | 'document';
    status: 'sent' | 'delivered' | 'read';
    createdAt: string;
    attachmentUrl?: string;
    attachmentType?: string;
    attachments: Array<{
        url: string;
        type: string;
        size: number;
        name: string;
    }>;
    replyTo?: {
        id: string;
        content: string;
        senderName: string;
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
