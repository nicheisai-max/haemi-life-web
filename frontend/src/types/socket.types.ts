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
