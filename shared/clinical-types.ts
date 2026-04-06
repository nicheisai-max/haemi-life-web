/**
 * 🩺 HAEMI LIFE — Institutional Clinical Types
 * Single Source of Truth (SSoT) for clinical record classification.
 */

export enum ClinicalRecordType {
    Prescription = 'Prescription',
    LabResult = 'Lab Result',
    Radiology = 'Radiology',
    ClinicalNote = 'Clinical Note',
    SpecialistReport = 'Specialist Report',
    Immunization = 'Immunization',
    GeneralRecord = 'General Record'
}

export type ClinicalRecordStatus = 'Final' | 'Preliminary' | 'Verified' | 'Pending Review';

/**
 * 👤 INSTITUTIONAL IDENTITY — User Profile
 */
export interface UserProfile {
    id: string;
    name: string;
    role: 'doctor' | 'patient' | 'pharmacist' | 'admin';
    initials: string;
    profileImage?: string | null;
    specialization?: string | null;
    facility?: string | null;
}

/**
 * 📎 SECURE CLINICAL ATTACHMENT
 */
export interface MessageAttachment {
    id: string;
    messageId: string;
    filePath: string;
    fileType: string;
    fileSize: number;
    fileName: string;
    fileExtension: string;
    fileCategory: 'image' | 'document' | 'other';
    createdAt: Date | string;
}

/**
 * 👥 CHAT PARTICIPANT
 */
export interface HaemiParticipant extends UserProfile {
    isOnline?: boolean;
    lastActivity?: Date | string;
}

/**
 * 💬 UNIFIED CLINICAL MESSAGE
 */
export interface HaemiMessage {
    id: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    content: string;
    previewText?: string | null;
    messageType: 'text' | 'image' | 'file' | 'system';
    status: 'sent' | 'delivered' | 'read';
    sequenceNumber: number;
    createdAt: Date | string;
    attachments: MessageAttachment[];
    replyTo?: HaemiMessage | null;
}
