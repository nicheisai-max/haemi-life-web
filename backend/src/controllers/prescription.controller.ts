import { Request, Response } from 'express';
import { pool } from '../config/db';
import { prescriptionRepository } from '../repositories/prescription.repository';

// Create a new prescription (Doctor only)
export const createPrescription = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const doctorId = user.id;
        const { patient_id, appointment_id, notes, medications } = req.body;

        // Validate that appointment exists and belongs to this doctor
        if (appointment_id) {
            const hasAccess = await prescriptionRepository.checkAppointmentAccess(appointment_id, doctorId);
            if (!hasAccess) {
                return res.status(403).json({ message: 'Invalid appointment' });
            }
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create prescription
            const prescription = await prescriptionRepository.create({
                patient_id,
                doctor_id: doctorId,
                appointment_id: appointment_id || null,
                notes
            }, client);

            const prescriptionId = prescription.id;

            // Add prescription items
            if (medications && medications.length > 0) {
                for (const med of medications) {
                    await prescriptionRepository.createItem({
                        prescription_id: prescriptionId,
                        medicine_id: med.medicine_id,
                        dosage: med.dosage,
                        frequency: med.frequency,
                        duration_days: med.duration_days || null,
                        quantity: med.quantity || null,
                        instructions: med.instructions || null
                    }, client);
                }
            }

            await client.query('COMMIT');
            res.status(201).json({
                message: 'Prescription created successfully',
                prescription
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating prescription:', error);
        res.status(500).json({ message: 'Error creating prescription' });
    }
};

// Get user's prescriptions (Patient/Doctor)
export const getMyPrescriptions = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const userId = user.id;
        const role = user.role;

        const prescriptions = await prescriptionRepository.findByUserId(userId as string, role as string);
        res.json(prescriptions);
    } catch (error) {
        console.error('Error fetching prescriptions:', error);
        res.status(500).json({ message: 'Error fetching prescriptions' });
    }
};

// Get prescription by ID with items
export const getPrescriptionById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        // Get prescription
        const prescription = await prescriptionRepository.findByIdWithDetails(id as string, user.id as string, user.role as string);

        if (!prescription) {
            return res.status(404).json({ message: 'Prescription not found' });
        }

        // Get prescription items
        const items = await prescriptionRepository.findItemsByPrescriptionId(id as string);

        res.json({
            ...prescription,
            items
        });
    } catch (error) {
        console.error('Error fetching prescription:', error);
        res.status(500).json({ message: 'Error fetching prescription' });
    }
};

// Update prescription status (Pharmacist)
export const updatePrescriptionStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const prescription = await prescriptionRepository.updateStatus(id as string, status as string);

        if (!prescription) {
            return res.status(404).json({ message: 'Prescription not found' });
        }

        res.json({ message: 'Prescription status updated', prescription });
    } catch (error) {
        console.error('Error updating prescription status:', error);
        res.status(500).json({ message: 'Error updating prescription status' });
    }
};

// Get pending prescriptions (Pharmacist)
export const getPendingPrescriptions = async (req: Request, res: Response) => {
    try {
        const prescriptions = await prescriptionRepository.findPending();
        res.json(prescriptions);
    } catch (error) {
        console.error('Error fetching pending prescriptions:', error);
        res.status(500).json({ message: 'Error fetching pending prescriptions' });
    }
};
// Delete a prescription (Soft delete)
export const deletePrescription = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        const deleted = await prescriptionRepository.softDelete(id as string, user.id as string);

        if (!deleted) {
            return res.status(404).json({ message: 'Prescription not found or access denied' });
        }

        res.json({ message: 'Prescription deleted successfully' });
    } catch (error) {
        console.error('Error deleting prescription:', error);
        res.status(500).json({ message: 'Error deleting prescription' });
    }
};
