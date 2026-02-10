import { Request, Response } from 'express';
import { pool } from '../config/db';

// Create a new prescription (Doctor only)
export const createPrescription = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const doctorId = user.id;
        const { patient_id, appointment_id, notes, medications } = req.body;

        // Validate that appointment exists and belongs to this doctor
        if (appointment_id) {
            const apptCheck = await pool.query(
                'SELECT id FROM appointments WHERE id = $1 AND doctor_id = $2',
                [appointment_id, doctorId]
            );
            if (apptCheck.rows.length === 0) {
                return res.status(403).json({ message: 'Invalid appointment' });
            }
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create prescription
            const prescriptionResult = await client.query(`
                INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, notes, prescription_date, status)
                VALUES ($1, $2, $3, $4, CURRENT_DATE, 'pending')
                RETURNING *
            `, [patient_id, doctorId, appointment_id || null, notes]);

            const prescriptionId = prescriptionResult.rows[0].id;

            // Add prescription items
            if (medications && medications.length > 0) {
                for (const med of medications) {
                    await client.query(`
                        INSERT INTO prescription_items 
                        (prescription_id, medicine_id, dosage, frequency, duration_days, quantity, instructions)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [
                        prescriptionId,
                        med.medicine_id,
                        med.dosage,
                        med.frequency,
                        med.duration_days || null,
                        med.quantity || null,
                        med.instructions || null
                    ]);
                }
            }

            await client.query('COMMIT');
            res.status(201).json({
                message: 'Prescription created successfully',
                prescription: prescriptionResult.rows[0]
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

        let query = `
            SELECT 
                p.*,
                u_patient.name as patient_name,
                u_doctor.name as doctor_name,
                COUNT(pi.id) as medication_count
            FROM prescriptions p
            JOIN users u_patient ON p.patient_id = u_patient.id
            JOIN users u_doctor ON p.doctor_id = u_doctor.id
            LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
            WHERE ${role === 'patient' ? 'p.patient_id' : 'p.doctor_id'} = $1
            GROUP BY p.id, u_patient.name, u_doctor.name
            ORDER BY p.prescription_date DESC
        `;

        const result = await pool.query(query, [userId]);
        res.json(result.rows);
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
        const prescriptionResult = await pool.query(`
            SELECT 
                p.*,
                u_patient.name as patient_name,
                u_patient.phone_number as patient_phone,
                u_doctor.name as doctor_name,
                dp.specialization
            FROM prescriptions p
            JOIN users u_patient ON p.patient_id = u_patient.id
            JOIN users u_doctor ON p.doctor_id = u_doctor.id
            LEFT JOIN doctor_profiles dp ON p.doctor_id = dp.user_id
            WHERE p.id = $1 AND (p.patient_id = $2 OR p.doctor_id = $2 OR $3 = 'pharmacist')
        `, [id, user.id, user.role]);

        if (prescriptionResult.rows.length === 0) {
            return res.status(404).json({ message: 'Prescription not found' });
        }

        // Get prescription items
        const itemsResult = await pool.query(`
            SELECT 
                pi.*,
                m.name as medicine_name,
                m.category,
                m.strength
            FROM prescription_items pi
            LEFT JOIN medicines m ON pi.medicine_id = m.id
            WHERE pi.prescription_id = $1
        `, [id]);

        res.json({
            ...prescriptionResult.rows[0],
            items: itemsResult.rows
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

        const result = await pool.query(`
            UPDATE prescriptions
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `, [status, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Prescription not found' });
        }

        res.json({ message: 'Prescription status updated', prescription: result.rows[0] });
    } catch (error) {
        console.error('Error updating prescription status:', error);
        res.status(500).json({ message: 'Error updating prescription status' });
    }
};

// Get pending prescriptions (Pharmacist)
export const getPendingPrescriptions = async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT 
                p.*,
                u_patient.name as patient_name,
                u_patient.phone_number as patient_phone,
                u_doctor.name as doctor_name,
                COUNT(pi.id) as medication_count
            FROM prescriptions p
            JOIN users u_patient ON p.patient_id = u_patient.id
            JOIN users u_doctor ON p.doctor_id = u_doctor.id
            LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
            WHERE p.status = 'pending'
            GROUP BY p.id, u_patient.name, u_patient.phone_number, u_doctor.name
            ORDER BY p.prescription_date ASC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching pending prescriptions:', error);
        res.status(500).json({ message: 'Error fetching pending prescriptions' });
    }
};
