import { Request, Response } from 'express';
import { pool } from '../config/db';
import { systemSettingsRepository } from '../repositories/system-settings.repository';
import { sendResponse, sendError } from '../utils/response';
import { JWTPayload } from '../types/express';

// Get pending doctor verifications (Admin only)
export const getPendingVerifications = async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id, u.name, u.email, u.phone_number, u.created_at,
                dp.specialization, dp.license_number, dp.years_of_experience, dp.bio
            FROM users u
            JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE u.role = 'doctor' AND dp.is_verified = false AND u.status = 'ACTIVE'
            ORDER BY u.created_at DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching pending verifications:', error);
        sendError(res, 500, 'Error fetching pending verifications');
    }
};

// Verify a doctor (Admin only)
export const verifyDoctor = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { verified } = req.body; // true or false
        const user = req.user;
        if (!user) return sendError(res, 401, 'Unauthorized');

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
                INSERT INTO audit_logs (actor_user_id, action_type, target_entity_type, target_entity_id, change_summary)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                user.id,
                verified ? 'VERIFY_DOCTOR' : 'REJECT_DOCTOR',
                'doctor_profile',
                result.rows[0].id,
                JSON.stringify({ doctor_user_id: id, verified })
            ]);

            await client.query('COMMIT');
            sendResponse(res, 200, true, verified ? 'Doctor verified successfully' : 'Doctor rejected', {
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
        sendError(res, 500, 'Error verifying doctor');
    }
};

// Get all users with filters (Admin only)
export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const { role, status, search } = req.query;

        let query = 'SELECT id, name, email, phone_number, role, status, initials, created_at FROM users WHERE 1=1';
        const params: (string | number | boolean | null)[] = [];

        if (role) {
            params.push(role as string);
            query += ` AND role = $${params.length}`;
        }

        if (status) {
            params.push(status as string);
            query += ` AND status = $${params.length}`;
        }

        if (search) {
            params.push(`%${search as string}%`);
            const idx = params.length;
            query += ` AND (name ILIKE $${idx} OR email ILIKE $${idx} OR phone_number ILIKE $${idx})`;
        }

        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        sendError(res, 500, 'Error fetching users');
    }
};

// Update user status (Admin only)
export const updateUserStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const user = req.user;
        if (!user) return sendError(res, 401, 'Unauthorized');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE users
                SET status = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING id, name, email, role, status, initials
            `, [status, id]);

            if (result.rows.length === 0) {
                throw new Error('User not found');
            }

            // Log the action
            await client.query(`
                INSERT INTO audit_logs (actor_user_id, action_type, target_entity_type, target_entity_id, change_summary)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                user.id,
                'UPDATE_USER_STATUS',
                'user',
                id,
                JSON.stringify({ status })
            ]);

            await client.query('COMMIT');
            sendResponse(res, 200, true, 'User status updated', { user: result.rows[0] });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating user status:', error);
        sendError(res, 500, 'Error updating user status');
    }
};

// Get system statistics (Admin only)
export const getSystemStats = async (req: Request, res: Response) => {
    try {
        const user = req.user as JWTPayload;
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Unauthorized');

        const stats = await Promise.all([
            pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['patient']),
            pool.query('SELECT COUNT(*) FROM users WHERE role = $1 AND status = $2', ['doctor', 'ACTIVE']),
            pool.query('SELECT COUNT(*) FROM doctor_profiles WHERE is_verified = false'),
            pool.query('SELECT COUNT(*) FROM appointments WHERE status = $1', ['scheduled']),
            pool.query('SELECT COUNT(*) FROM prescriptions WHERE status = $1', ['pending']),
            pool.query('SELECT COUNT(*) FROM users WHERE status = $1', ['ACTIVE']),
            pool.query('SELECT COUNT(*) FROM users')
        ]);

        res.json({
            total_patients: parseInt(stats[0].rows[0].count),
            active_doctors: parseInt(stats[1].rows[0].count),
            pending_verifications: parseInt(stats[2].rows[0].count),
            scheduled_appointments: parseInt(stats[3].rows[0].count),
            pending_prescriptions: parseInt(stats[4].rows[0].count),
            active_users: parseInt(stats[5].rows[0].count),
            total_users: parseInt(stats[6].rows[0].count)
        });
    } catch (error) {
        console.error('Error fetching system stats:', error);
        sendError(res, 500, 'Error fetching system stats');
    }
};

// Get audit logs (Admin only)
export const getAuditLogs = async (req: Request, res: Response) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const result = await pool.query(`
            SELECT 
                al.id,
                al.action_type as action,
                al.change_summary as details,
                al.target_entity_type,
                al.target_entity_id,
                al.request_ip as ip_address,
                al.created_at,
                u.name as user_name,
                u.email as user_email,
                u.role as user_role
            FROM audit_logs al
            LEFT JOIN users u ON al.actor_user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        sendError(res, 500, 'Error fetching audit logs');
    }
};

// Get current session timeout (Admin only)
export const getSessionTimeout = async (req: Request, res: Response) => {
    try {
        const timeout = await systemSettingsRepository.getSetting('SESSION_TIMEOUT_MINUTES');
        res.json({ timeout: parseInt(timeout || '60') });
    } catch (error) {
        console.error('Error fetching session timeout:', error);
        sendError(res, 500, 'Error fetching session timeout');
    }
};

// Update session timeout (Admin only)
export const updateSessionTimeout = async (req: Request, res: Response) => {
    try {
        const { timeout } = req.body;

        const timeoutNum = parseInt(timeout);
        if (isNaN(timeoutNum) || timeoutNum < 5 || timeoutNum > 1440) {
            return sendError(res, 400, 'Invalid timeout value. Must be between 5 and 1440 minutes.');
        }

        await systemSettingsRepository.updateSetting('SESSION_TIMEOUT_MINUTES', timeoutNum.toString());

        sendResponse(res, 200, true, 'Session timeout updated successfully', { timeout: timeoutNum });
    } catch (error) {
        console.error('Error updating session timeout:', error);
        sendError(res, 500, 'Error updating session timeout');
    }
};
