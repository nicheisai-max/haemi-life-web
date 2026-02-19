import { Request, Response } from 'express';
import { pool } from '../config/db';
import { systemSettingsRepository } from '../repositories/system_settings.repository';

// Get pending doctor verifications (Admin only)
export const getPendingVerifications = async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id, u.name, u.email, u.phone_number, u.created_at,
                dp.specialization, dp.license_number, dp.years_of_experience, dp.bio
            FROM users u
            JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE u.role = 'doctor' AND dp.is_verified = false AND u.is_active = true
            ORDER BY u.created_at DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching pending verifications:', error);
        res.status(500).json({ message: 'Error fetching pending verifications' });
    }
};

// Verify a doctor (Admin only)
export const verifyDoctor = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { verified } = req.body; // true or false
        const user = (req as any).user;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update doctor verification status
            const result = await client.query(`
                UPDATE doctor_profiles
                SET is_verified = $1, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $2
                RETURNING *
            `, [verified, id]);

            if (result.rows.length === 0) {
                throw new Error('Doctor profile not found');
            }

            // Log the action
            await client.query(`
                INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                user.id,
                verified ? 'VERIFY_DOCTOR' : 'REJECT_DOCTOR',
                'doctor_profile',
                result.rows[0].id,
                JSON.stringify({ doctor_user_id: id, verified })
            ]);

            await client.query('COMMIT');
            res.json({
                message: verified ? 'Doctor verified successfully' : 'Doctor rejected',
                profile: result.rows[0]
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error verifying doctor:', error);
        res.status(500).json({ message: 'Error verifying doctor' });
    }
};

// Get all users with filters (Admin only)
export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const { role, is_active, search } = req.query;

        let query = 'SELECT id, name, email, phone_number, role, is_active, created_at FROM users WHERE 1=1';
        const params: any[] = [];

        if (role) {
            params.push(role);
            query += ` AND role = $${params.length}`;
        }

        if (is_active !== undefined) {
            params.push(is_active === 'true');
            query += ` AND is_active = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone_number ILIKE $${params.length})`;
        }

        query += ' ORDER BY created_at DESC';

        console.log('getAllUsers request query:', req.query);
        console.log('Generated SQL:', query);
        console.log('Params:', params);

        const result = await pool.query(query, params);
        console.log('Rows returned:', result.rows.length);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

// Update user status (Admin only)
export const updateUserStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;
        const user = (req as any).user;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE users
                SET is_active = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING id, name, email, role, is_active
            `, [is_active, id]);

            if (result.rows.length === 0) {
                throw new Error('User not found');
            }

            // Log the action
            await client.query(`
                INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                user.id,
                is_active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
                'user',
                id,
                JSON.stringify({ is_active })
            ]);

            await client.query('COMMIT');
            res.json({ message: 'User status updated', user: result.rows[0] });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ message: 'Error updating user status' });
    }
};

// Get system statistics (Admin only)
export const getSystemStats = async (req: Request, res: Response) => {
    try {
        const stats = await Promise.all([
            pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['patient']),
            pool.query('SELECT COUNT(*) FROM users WHERE role = $1 AND is_active = true', ['doctor']),
            pool.query('SELECT COUNT(*) FROM doctor_profiles WHERE is_verified = false'),
            pool.query('SELECT COUNT(*) FROM appointments WHERE status = $1', ['scheduled']),
            pool.query('SELECT COUNT(*) FROM prescriptions WHERE status = $1', ['pending']),
            pool.query('SELECT COUNT(*) FROM users WHERE is_active = true')
        ]);

        res.json({
            total_patients: parseInt(stats[0].rows[0].count),
            active_doctors: parseInt(stats[1].rows[0].count),
            pending_verifications: parseInt(stats[2].rows[0].count),
            scheduled_appointments: parseInt(stats[3].rows[0].count),
            pending_prescriptions: parseInt(stats[4].rows[0].count),
            active_users: parseInt(stats[5].rows[0].count)
        });
    } catch (error) {
        console.error('Error fetching system stats:', error);
        res.status(500).json({ message: 'Error fetching system stats' });
    }
};

// Get audit logs (Admin only)
export const getAuditLogs = async (req: Request, res: Response) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const result = await pool.query(`
            SELECT 
                al.*,
                u.name as user_name,
                u.email as user_email,
                u.role as user_role
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ message: 'Error fetching audit logs' });
    }
};

// Get current session timeout (Admin only)
export const getSessionTimeout = async (req: Request, res: Response) => {
    try {
        const timeout = await systemSettingsRepository.getSetting('SESSION_TIMEOUT_MINUTES');
        res.json({ timeout: parseInt(timeout || '60') });
    } catch (error) {
        console.error('Error fetching session timeout:', error);
        res.status(500).json({ message: 'Error fetching session timeout' });
    }
};

// Update session timeout (Admin only)
export const updateSessionTimeout = async (req: Request, res: Response) => {
    try {
        const { timeout } = req.body;

        // Validation: 5 to 1440 minutes
        const timeoutNum = parseInt(timeout);
        if (isNaN(timeoutNum) || timeoutNum < 5 || timeoutNum > 1440) {
            return res.status(400).json({ message: 'Invalid timeout value. Must be between 5 and 1440 minutes.' });
        }

        await systemSettingsRepository.updateSetting('SESSION_TIMEOUT_MINUTES', timeoutNum.toString());

        res.json({ message: 'Session timeout updated successfully', timeout: timeoutNum });
    } catch (error) {
        console.error('Error updating session timeout:', error);
        res.status(500).json({ message: 'Error updating session timeout' });
    }
};

