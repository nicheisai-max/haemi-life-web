import { useState } from 'react';
import { useConfirm } from './use-confirm';
import { uploadRecord, deleteRecord, checkFileExistence } from '../services/record.service';
import { ClinicalRecordType } from '../../../shared/clinical-types';
import { type MedicalRecord } from '../services/record.service';
import { logger } from '../utils/logger';

/**
 * 🛡️ HAEMI LIFE — INSTITUTIONAL FILE ACTION HANDLER (v4.0)
 * Centrally manages the lifecycle of clinical file operations: 
 * Forensic Check -> User Confirmation -> Atomic Execution.
 * Strict Typescript (Google/Meta Grade).
 */

export interface UseFileActionHandlerProps {
    onSuccess?: (record: MedicalRecord) => void;
    onDeleteSuccess?: (id: string) => void;
    onError?: (error: unknown) => void;
}

export const useFileActionHandler = ({ onSuccess, onDeleteSuccess, onError }: UseFileActionHandlerProps = {}) => {
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const { confirm } = useConfirm();

    // 🚀 UNIFIED UPLOAD PIPELINE: Forensic Replace Logic
    const handleUpload = async (file: File, recordType: ClinicalRecordType): Promise<MedicalRecord | undefined> => {
        setIsProcessing(true);
        try {
            // 🔎 Step 1: Forensic Existence Check (Google/Meta Grade)
            const check = await checkFileExistence(file.name);

            if (check.exists && check.record) {
                // ⚠️ Step 2: Strategic Conflict Resolution via Global Modal
                const shouldReplace = await confirm({
                    title: 'Replace existing file?',
                    message: `A file named '${file.name}' already exists in your clinical history. Would you like to replace it with this version?`,
                    type: 'warning',
                    confirmText: 'Replace File',
                    cancelText: 'Cancel'
                });

                if (!shouldReplace) {
                    setIsProcessing(false);
                    return undefined;
                }

                // Step 3: Atomic Replacement (Delete then Upload)
                try {
                    await deleteRecord(check.record.id);
                    if (onDeleteSuccess) {
                        onDeleteSuccess(check.record.id);
                    }
                } catch (delError: unknown) {
                    // 🛡️ GHOST RECOVERY: If it's a 404, the record was already logically purged.
                    const apiErr = delError as { response?: { status?: number } };
                    if (apiErr.response?.status === 404) {
                        logger.warn('[FileActionHandler] Deleting ghost record (404) - Proceeding with replacement.', { recordId: check.record.id });
                    } else {
                        throw delError; // Rethrow actual systemic failures
                    }
                }
            }

            // Step 4: Physical Persistence
            const newRecord = await uploadRecord(file, recordType);
            if (onSuccess) {
                onSuccess(newRecord);
            }
            
            return newRecord;
        } catch (error: unknown) {
            logger.error('[FileActionHandler] Upload Lifecycle Failure:', error instanceof Error ? error.message : String(error));
            if (onError) {
                onError(error);
            }
            return undefined;
        } finally {
            setIsProcessing(false);
        }
    };

    // 📦 BATCH UPLOAD PIPELINE: Strict 5-File Institutional Override
    const handleBatchUpload = async (files: FileList | File[], recordType: ClinicalRecordType): Promise<void> => {
        const fileArray = Array.from(files);
        
        // 🔒 GLOBAL INSTITUTIONAL LIMIT CHECK
        if (fileArray.length > 5) {
            const errorMsg = 'Institutional Policy: You can only upload a maximum of 5 files at once.';
            logger.warn('[FileActionHandler] Batch upload blocked: Exceeded 5 files limit.', { attemptedCount: fileArray.length });
            if (onError) {
                onError(new Error(errorMsg));
            }
            return;
        }

        try {
            for (const file of fileArray) {
                await handleUpload(file, recordType);
            }
        } catch (error: unknown) {
            logger.error('[FileActionHandler] Batch Processing Failure:', error instanceof Error ? error.message : String(error));
            if (onError) {
                onError(error);
            }
        }
    };

    // 🗑️ UNIFIED DELETION PIPELINE: Forensic Confirmation
    const handleDelete = async (record: { id: string; name: string }): Promise<void> => {
        try {
            const confirmed = await confirm({
                title: 'Confirm Clinical Asset Purge',
                message: `Are you sure you want to delete '${record.name}'? This record will be quarantined and may affect your medical history accuracy.`,
                type: 'error',
                confirmText: 'Purge Record',
                cancelText: 'Cancel'
            });

            if (!confirmed) return;

            setIsProcessing(true);
            await deleteRecord(record.id);
            if (onDeleteSuccess) {
                onDeleteSuccess(record.id);
            }
        } catch (error: unknown) {
            logger.error('[FileActionHandler] Purge Lifecycle Failure:', error instanceof Error ? error.message : String(error));
            if (onError) {
                onError(error);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        handleUpload,
        handleBatchUpload,
        handleDelete,
        isProcessing
    };
};
