/**
 * 🩺 HAEMI LIFE — ENTERPRISE FILE TYPE SYSTEM (v1.0)
 * Standard: Google/Meta Strict Type Parity
 * Protocol: Domain-Driven Asset Management
 */

/** 
 * Branded string for attachment IDs to ensure institutional-grade type safety 
 */
export type AttachmentId = string & { readonly __brand: unique symbol };

/**
 * 🧬 FILE DOMAIN REGISTRY
 * Categorizes files into distinct institutional silos for granular RBAC and storage policies.
 */
export enum FileDomain {
    CHAT = 'chat',
    CHAT_TEMP = 'chat/temp',
    CLINICAL = 'clinical',
    PROFILE = 'profile',
    SYSTEM = 'system',
    MEDICAL_RECORDS = 'medical_records'
}

/**
 * 📊 FILE METADATA ENVELOPE
 * Comprehensive metadata structure for cross-domain parity.
 */
export interface FileMetadata {
    id: AttachmentId;
    domain: FileDomain;
    fileName: string;     // Institutional Standard
    filePath: string;     // Institutional Standard
    mimeType: string;
    fileSize: number;     // Institutional Standard
    checksum?: string;    // Phase 4: ETag/Integrity Hash
    createdAt: Date;
    updatedAt: Date;
}

/**
 * 📑 FILE OPERATION RESULT
 * Standardized outcome for atomic filesystem operations.
 */
export interface FileOpResult {
    success: boolean;
    path?: string;
    size?: number;
    error?: string;
    correlationId: string;
}

/**
 * 🧬 DOMAIN CONFIGURATION
 * Defines institutional boundary rules per domain.
 */
export interface DomainConfig {
    allowedTypes: string[];
    maxSize: number;
    quarantineRequired: boolean;
    retentionDays?: number;
}
