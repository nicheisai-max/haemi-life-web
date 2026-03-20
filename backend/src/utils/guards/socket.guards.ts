import { SignalData, UserRole } from '../../types/socket.types';

export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/**
 * PHASE 1: Centralized Auth Guard
 * ENFORCEMENT: Military-Grade strictness.
 */
export function isAuthenticatedSocketData(
    data: unknown
): data is { user: { id: string | number; role?: UserRole } } {
    if (!isObject(data)) return false;
    if (!('user' in data)) return false;

    const user = data.user;
    if (!isObject(user)) return false;
    if (!('id' in user)) return false;

    // We allow string (UUID) or number to prevent breakage while maintaining strict check
    return typeof user.id === 'string' || typeof user.id === 'number';
}

/**
 * PHASE 3: Deep Payload Guards
 */

export function isJoinConsultationPayload(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}

export function isSignalPayload(value: unknown): value is { offer: SignalData; to: string } {
    if (!isObject(value)) return false;
    
    const hasTo = 'to' in value && typeof value.to === 'string';
    const hasOffer = 'offer' in value && isObject(value.offer);

    return hasTo && hasOffer;
}

export function isAnswerPayload(value: unknown): value is { answer: SignalData; to: string } {
    if (!isObject(value)) return false;
    
    const hasTo = 'to' in value && typeof value.to === 'string';
    const hasAnswer = 'answer' in value && isObject(value.answer);

    return hasTo && hasAnswer;
}

export function isIcePayload(value: unknown): value is { candidate: SignalData; to: string } {
    if (!isObject(value)) return false;
    
    const hasTo = 'to' in value && typeof value.to === 'string';
    const hasCandidate = 'candidate' in value && isObject(value.candidate);

    return hasTo && hasCandidate;
}

export function isAckDeliveryPayload(value: unknown): value is { sender_id: string; sender_role: UserRole; conversationId: string; messageId: string } {
    if (!isObject(value)) return false;
    
    return (
        'conversationId' in value && typeof value.conversationId === 'string' &&
        'messageId' in value && typeof value.messageId === 'string' &&
        'sender_id' in value && typeof value.sender_id === 'string' &&
        'sender_role' in value && isValidRole(value.sender_role)
    );
}

export function isJoinConversationPayload(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}

export function isAckReadPayload(value: unknown): value is { conversationId: string; user_id: string } {
    if (!isObject(value)) return false;
    
    return (
        'conversationId' in value && typeof value.conversationId === 'string' &&
        'user_id' in value && typeof value.user_id === 'string'
    );
}

export function isTypingPayload(value: unknown): value is { conversationId: string; name: string } {
    if (!isObject(value)) return false;
    
    return (
        'conversationId' in value && typeof value.conversationId === 'string' &&
        'name' in value && typeof value.name === 'string'
    );
}

export function isValidRole(value: unknown): value is UserRole {
    return value === 'patient' || value === 'doctor' || value === 'pharmacist';
}
