import { Request, Response } from 'express';
import { pool } from '../config/db';
import { prescriptionRepository } from '../repositories/prescription.repository';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { mapPrescriptionToResponse, mapPrescriptionItemToResponse } from '../utils/clinical.mapper';

interface MedicationDTO {
    medicineId: number;
    dosage: string;
    frequency: string;
    durationDays?: number;
    quantity?: number;
    instructions?: string;
}

interface CreatePrescriptionRequest {
    patientId: string;
    appointmentId?: string | number;
    notes?: string;
    medications: MedicationDTO[];
}

// Create a new prescription (Doctor only)
export const createPrescription = async (req: Request, res: Response) => {
    const { patientId, appointmentId, notes, medications } = req.body as CreatePrescriptionRequest;
    const userId = req.user?.id;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        // Validate that appointment exists and belongs to this doctor
        if (appointmentId) {
            const hasAccess = await prescriptionRepository.checkAppointmentAccess(Number(appointmentId), userId);
            if (!hasAccess) {
                return sendError(res, 403, 'Invalid appointment or access denied');
            }
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create prescription
            const prescription = await prescriptionRepository.create({
                patient_id: patientId,
                doctor_id: userId,
                appointment_id: appointmentId ? Number(appointmentId) : null,
                notes: notes || null
            }, client);

            const prescriptionId = prescription.id;

            // Add prescription items
            if (medications && Array.isArray(medications) && medications.length > 0) {
                for (const med of medications) {
                    await prescriptionRepository.createItem({
                        prescription_id: prescriptionId,
                        medicine_id: med.medicineId,
                        dosage: med.dosage,
                        frequency: med.frequency,
                        duration_days: med.durationDays || null,
                        quantity: med.quantity || null,
                        instructions: med.instructions || null
                    }, client);
                }
            }

            await client.query('COMMIT');
            return sendResponse(res, 201, true, 'Prescription created successfully', mapPrescriptionToResponse(prescription));
        } catch (error: unknown) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error: unknown) {
        logger.error('Error creating prescription:', { 
            error: error instanceof Error ? error.message : String(error), 
            userId,
            patientId
        });
        return sendError(res, 500, 'Failed to create prescription');
    }
};

// Get user's prescriptions (Patient/Doctor)
export const getMyPrescriptions = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const role = req.user?.role;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const prescriptions = await prescriptionRepository.findByUserId(userId, role as string);
        return sendResponse(res, 200, true, 'Prescriptions fetched successfully', prescriptions.map(mapPrescriptionToResponse));
    } catch (error: unknown) {
        logger.error('Error fetching prescriptions:', { 
            error: error instanceof Error ? error.message : String(error), 
            userId 
        });
        return sendError(res, 500, 'Failed to fetch prescriptions');
    }
};

// Get prescription by ID with items
export const getPrescriptionById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const role = req.user?.role;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        // Get prescription
        const prescription = await prescriptionRepository.findByIdWithDetails(Number(id), userId, role as string);

        if (!prescription) {
            return sendError(res, 404, 'Prescription not found');
        }

        // Get prescription items
        const items = await prescriptionRepository.findItemsByPrescriptionId(Number(id));

        return sendResponse(res, 200, true, 'Prescription fetched successfully', {
            ...mapPrescriptionToResponse(prescription),
            items: items.map(mapPrescriptionItemToResponse)
        });

    } catch (error: unknown) {
        logger.error('Error fetching prescription:', { 
            error: error instanceof Error ? error.message : String(error), 
            prescriptionId: id 
        });
        return sendError(res, 500, 'Failed to fetch prescription details');
    }
};

// Update prescription status (Pharmacist)
export const updatePrescriptionStatus = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const prescription = await prescriptionRepository.updateStatus(Number(id), status as string);

        if (!prescription) {
            return sendError(res, 404, 'Prescription not found');
        }

        return sendResponse(res, 200, true, 'Prescription status updated', mapPrescriptionToResponse(prescription));
    } catch (error: unknown) {
        logger.error('Error updating prescription status:', { 
            error: error instanceof Error ? error.message : String(error), 
            prescriptionId: id 
        });
        return sendError(res, 500, 'Failed to update prescription status');
    }
};

// Get pending prescriptions (Pharmacist)
export const getPendingPrescriptions = async (req: Request, res: Response) => {
    try {
        const prescriptions = await prescriptionRepository.findPending();
        return sendResponse(res, 200, true, 'Pending prescriptions fetched successfully', prescriptions.map(mapPrescriptionToResponse));
    } catch (error: unknown) {
        logger.error('Error fetching pending prescriptions:', { 
            error: error instanceof Error ? error.message : String(error) 
        });
        return sendError(res, 500, 'Failed to fetch pending prescriptions');
    }
};

// Delete a prescription (Soft delete)
export const deletePrescription = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const deleted = await prescriptionRepository.softDelete(Number(id), userId);

        if (!deleted) {
            return sendError(res, 404, 'Prescription not found or access denied');
        }

        return sendResponse(res, 200, true, 'Prescription deleted successfully');
    } catch (error: unknown) {
        logger.error('Error deleting prescription:', { 
            error: error instanceof Error ? error.message : String(error), 
            prescriptionId: id 
        });
        return sendError(res, 500, 'Failed to delete prescription');
    }
};
