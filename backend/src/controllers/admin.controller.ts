import { Request, Response } from 'express';
import { pool } from '../config/db';
import { systemSettingsRepository } from '../repositories/system-settings.repository';
import { securityRepository } from '../repositories/security.repository';
import { analyticsRepository } from '../repositories/analytics.repository';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { mapUserToResponse } from '../utils/user.mapper';
import { mapDoctorToResponse } from '../utils/doctor.mapper';
import { UserEntity, JoinedDoctorRow } from '../types/db.types';
import { decrypt } from '../utils/security';

// Get pending doctor verifications (Admin only)
export const getPendingVerifications = async (req: Request, res: Response) => {
    const { originalUrl, ip } = req;
    logger.debug('[Admin] Fetching pending verifications', { url: originalUrl, from: ip });
    try {
        const result = await pool.query<JoinedDoctorRow>(`
            SELECT 
                u.id, u.name, u.email, u.phone_number, u.profile_image, u.created_at,
                dp.specialization, dp.license_number, dp.years_of_experience, dp.bio
            FROM users u
            JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE u.role = 'doctor' AND dp.is_verified = false AND u.status = 'ACTIVE'
            ORDER BY u.created_at DESC
        `);

        const doctors = result.rows.map((row: JoinedDoctorRow) => {
            return mapDoctorToResponse({
                ...row,
                phone_number: row.phone_number ? decrypt(row.phone_number) : '',
                id_number: row.id_number ? decrypt(row.id_number) : null
            });
        });
        return sendResponse(res, 200, true, 'Pending verifications fetched', doctors);
    } catch (error: unknown) {
        logger.error('Error fetching pending verifications:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Error fetching pending verifications');
    }
};

// Verify a doctor (Admin only)
export const verifyDoctor = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { verified } = req.body as { verified: boolean };
    const user = req.user;

    try {
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
            if (!user) throw new Error('Invalid user session');

            await client.query(`
                INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                user.id,
                verified ? 'VERIFY_DOCTOR' : 'REJECT_DOCTOR',
                'doctor_profile',
                result.rows[0].id,
                JSON.stringify({ doctorUserId: id, verified })
            ]);

            await client.query('COMMIT');
            return sendResponse(res, 200, true, verified ? 'Doctor verified successfully' : 'Doctor rejected', {
                profile: mapDoctorToResponse(result.rows[0])
            });

        } catch (error: unknown) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch {
        logger.error('Error verifying doctor:', {
            adminId: user?.id
        });
        return sendError(res, 500, 'Error verifying doctor');
    }
};

/**
 * Get all users with server-side pagination and filters (Admin only)
 * Optimized for institutional scale and diagnostic performance.
 */
export const getAllUsers = async (req: Request, res: Response) => {
    const { originalUrl, ip } = req;
    try {
        const { role, status, search, page = '1', limit = '10' } = req.query;
        
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const offset = (pageNum - 1) * limitNum;

        logger.debug('[Admin] Executing paginated user fetch', { 
            url: originalUrl, 
            from: ip, 
            params: { role, status, search, page: pageNum, limit: limitNum } 
        });

        let query = `
            SELECT 
                id, name, email, phone_number, profile_image, role, status, initials, created_at,
                COUNT(*) OVER() as total_count
            FROM users 
            WHERE 1=1
        `;
        const params: (string | number | boolean | null)[] = [];

        if (typeof role === 'string' && role !== 'all') {
            params.push(role);
            query += ` AND role = $${params.length}`;
        }

        if (typeof status === 'string' && status !== 'all') {
            params.push(status.toUpperCase());
            query += ` AND status = $${params.length}`;
        }

        if (typeof search === 'string' && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            const idx = params.length;
            query += ` AND (name ILIKE $${idx} OR email ILIKE $${idx} OR phone_number ILIKE $${idx})`;
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limitNum, offset);

        const result = await pool.query<UserEntity & { total_count: string }>(query, params);
        
        const totalItems = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
        
        const users = result.rows.map((row) => {
            return mapUserToResponse({
                ...row,
                phone_number: row.phone_number ? decrypt(row.phone_number) : '',
                id_number: row.id_number ? decrypt(row.id_number) : null
            });
        });

        return sendResponse(res, 200, true, 'Users fetched successfully', {
            users,
            pagination: {
                total: totalItems,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(totalItems / limitNum)
            }
        });
    } catch (error: unknown) {
        logger.error('[Admin] Forensic Audit: Failed to fetch users', {
            url: originalUrl,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        return sendError(res, 500, 'Internal Server Error: Failed to retrieve user database');
    }
};

// Update user status (Admin only)
export const updateUserStatus = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body as { status: string };
    const user = req.user;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query<UserEntity>(`
                UPDATE users
                SET status = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING id, name, email, phone_number, profile_image, role, status, initials, created_at
            `, [status, id]);

            if (result.rows.length === 0) {
                throw new Error('User not found');
            }

            // Log the action
            if (!user) throw new Error('Invalid user session');

            await client.query(`
                INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                user.id,
                'UPDATE_USER_STATUS',
                'user',
                id,
                JSON.stringify({ status })
            ]);

            await client.query('COMMIT');
            const updatedUser = {
                ...result.rows[0],
                phone_number: result.rows[0].phone_number ? decrypt(result.rows[0].phone_number) : ''
            };
            return sendResponse(res, 200, true, 'User status updated', { user: mapUserToResponse(updatedUser) });
        } catch (error: unknown) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch {
        logger.error('Error updating user status:', {
            adminId: user?.id
        });
        return sendError(res, 500, 'Error updating user status');
    }
};

interface CountRow { count: string }

// Get system statistics (Admin only)
export const getSystemStats = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Unauthorized');

        const stats = await Promise.all([
            pool.query<CountRow>('SELECT COUNT(*) FROM users WHERE role = $1', ['patient']),
            pool.query<CountRow>('SELECT COUNT(*) FROM users WHERE role = $1 AND status = $2', ['doctor', 'ACTIVE']),
            pool.query<CountRow>('SELECT COUNT(*) FROM doctor_profiles WHERE is_verified = false'),
            pool.query<CountRow>('SELECT COUNT(*) FROM appointments WHERE status = $1', ['scheduled']),
            pool.query<CountRow>('SELECT COUNT(*) FROM prescriptions WHERE status = $1', ['pending']),
            pool.query<CountRow>('SELECT COUNT(*) FROM users WHERE status = $1', ['ACTIVE']),
            pool.query<CountRow>('SELECT COUNT(*) FROM users')
        ]);

        return sendResponse(res, 200, true, 'System statistics fetched', {
            totalPatients: parseInt(stats[0].rows[0].count, 10),
            activeDoctors: parseInt(stats[1].rows[0].count, 10),
            pendingVerifications: parseInt(stats[2].rows[0].count, 10),
            scheduledAppointments: parseInt(stats[3].rows[0].count, 10),
            pendingPrescriptions: parseInt(stats[4].rows[0].count, 10),
            activeUsers: parseInt(stats[5].rows[0].count, 10),
            totalUsers: parseInt(stats[6].rows[0].count, 10)
        });
    } catch {
        logger.error('Error fetching system stats:', {
            adminId: req.user?.id
        });
        return sendError(res, 500, 'Error fetching system stats');
    }
};

// Get audit logs (Admin only)
export const getAuditLogs = async (req: Request, res: Response) => {
    const { limit = 50, offset = 0 } = req.query;

    try {
        const result = await pool.query<{
            id: string,
            action: string,
            details: string,
            entity_type: string,
            entity_id: string,
            ip_address: string,
            created_at: Date,
            user_id: string,
            user_name: string,
            user_email: string,
            user_role: string
        }>(`
            SELECT 
                al.id,
                al.action,
                al.details,
                al.entity_type,
                al.entity_id,
                al.ip_address,
                al.created_at,
                al.user_id,
                u.name as user_name,
                u.email as user_email,
                u.role as user_role
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const auditLogs = result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            action: row.action,
            details: row.details,
            entityType: row.entity_type,
            entityId: row.entity_id,
            ipAddress: row.ip_address,
            createdAt: row.created_at,
            userName: row.user_name,
            userEmail: row.user_email,
            userRole: row.user_role
        }));

        return sendResponse(res, 200, true, 'Audit logs fetched', auditLogs);
    } catch (error: unknown) {
        logger.error('Error fetching audit logs:', {
            error: error instanceof Error ? error.message : String(error),
            adminId: req.user?.id,
            limit,
            offset
        });
        return sendError(res, 500, 'Error fetching audit logs');
    }
};

// Get current session timeout (Admin only)
export const getSessionTimeout = async (_req: Request, res: Response) => {
    try {
        const timeout = await systemSettingsRepository.getSetting('SESSION_TIMEOUT_MINUTES');
        return sendResponse(res, 200, true, 'Session timeout fetched', { timeout: parseInt(timeout || '60', 10) });
    } catch (error: unknown) {
        logger.error('Error fetching session timeout:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Error fetching session timeout');
    }
};

// Update session timeout (Admin only)
export const updateSessionTimeout = async (req: Request, res: Response) => {
    try {
        const { timeout } = req.body as { timeout: string };

        const timeoutNum = parseInt(timeout, 10);
        if (isNaN(timeoutNum) || timeoutNum < 5 || timeoutNum > 1440) {
            return sendError(res, 400, 'Invalid timeout value. Must be between 5 and 1440 minutes.');
        }

        await systemSettingsRepository.updateSetting('SESSION_TIMEOUT_MINUTES', timeoutNum.toString());

        return sendResponse(res, 200, true, 'Session timeout updated successfully', { timeout: timeoutNum });
    } catch (error: unknown) {
        logger.error('Error updating session timeout:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Error updating session timeout');
    }
};

// Security and Observability (Admin only)
export const getSecurityEvents = async (req: Request, res: Response) => {
    const { limit = 50, offset = 0 } = req.query;
    try {
        const events = await securityRepository.getSecurityEvents(Number(limit), Number(offset));
        return sendResponse(res, 200, true, 'Security events fetched', events);
    } catch (error: unknown) {
        logger.error('Error fetching security events:', {
            error: error instanceof Error ? error.message : String(error),
            limit,
            offset
        });
        return sendError(res, 500, 'Error fetching security events');
    }
};

export const getActiveSessions = async (req: Request, res: Response) => {
    const { limit = 50, offset = 0 } = req.query;
    try {
        const sessions = await securityRepository.getActiveSessions(Number(limit), Number(offset));
        return sendResponse(res, 200, true, 'Active sessions fetched', sessions);
    } catch (error: unknown) {
        logger.error('Error fetching active sessions:', {
            error: error instanceof Error ? error.message : String(error),
            limit,
            offset
        });
        return sendError(res, 500, 'Error fetching active sessions');
    }
};

export const revokeSession = async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    try {
        if (typeof sessionId !== 'string') return sendError(res, 400, 'Invalid Session ID');
        const success = await securityRepository.revokeSession(sessionId);
        if (success) {
            return sendResponse(res, 200, true, 'Session revoked successfully');
        } else {
            return sendError(res, 404, 'Session not found or already inactive');
        }
    } catch (error: unknown) {
        logger.error('Error revoking session:', {
            error: error instanceof Error ? error.message : String(error),
            sessionId
        });
        return sendError(res, 500, 'Error revoking session');
    }
};

export const getRevenueStats = async (_req: Request, res: Response) => {
    try {
        const stats = await analyticsRepository.getRevenueStats();
        return sendResponse(res, 200, true, 'Revenue stats fetched', stats);
    } catch (error: unknown) {
        logger.error('Error fetching revenue stats:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Error fetching revenue stats');
    }
};
