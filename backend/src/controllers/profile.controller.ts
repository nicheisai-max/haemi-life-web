import { Request, Response } from 'express';
import { pool } from '../config/db';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { mapUserToResponse } from '../utils/user.mapper';
import { UserEntity } from '../types/db.types';
import { decrypt } from '../utils/security';

interface ProfileQueryResult extends UserEntity {
    metadata: Record<string, unknown>;
}

/**
 * P0 PII GUARD (Phase 10/12): rows joined directly from `users` carry
 * `phone_number` and `id_number` as encrypted blobs. The repository
 * layer (`UserRepository.decryptUser`) performs decryption on its own
 * reads, but `getMe` here uses raw `pool.query` for role-based JSON
 * aggregation. This helper applies the same decryption at the
 * controller boundary so the mapper never projects an encrypted value.
 */
function decryptUserRow(row: ProfileQueryResult): ProfileQueryResult {
    return {
        ...row,
        phone_number: row.phone_number ? decrypt(row.phone_number) : '',
        id_number: row.id_number ? decrypt(row.id_number) : null,
    };
}

/**
 * GET /api/profiles/me
 * Enterprise-grade profile resolution with role-based joins
 */
export const getMe = async (req: Request, res: Response) => {
    const start = Date.now();
    const rawRequestId = req.headers['x-request-id'];
    const requestId = typeof rawRequestId === 'string' ? rawRequestId : Math.random().toString(36).substring(7);

    try {
        const userId = req.user?.id;
        const role = req.user?.role;

        if (!userId) {
            logger.warn('Unauthorized profile access attempt', { requestId });
            return sendError(res, 401, 'Unauthorized');
        }

        let query = '';
        const params: (string | number | boolean | null)[] = [userId];

        // Role-based profile resolution strategy
        if (role === 'doctor') {
            query = `
                SELECT u.*,
                json_build_object(
                    'specialization', dp.specialization,
                    'yearsOfExperience', dp.years_of_experience,
                    'bio', dp.bio,
                    'consultationFee', dp.consultation_fee,
                    'licenseNumber', dp.license_number
                ) as metadata
                FROM users u
                LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
                WHERE u.id = $1
            `;
        } else if (role === 'patient') {
            query = `
                SELECT u.*,
                json_build_object(
                    'dateOfBirth', pp.date_of_birth,
                    'gender', pp.gender,
                    'bloodGroup', pp.blood_group,
                    'emergencyContact', json_build_object(
                        'name', pp.emergency_contact_name,
                        'phone', pp.emergency_contact_phone
                    ),
                    'allergies', pp.allergies,
                    'medicalConditions', pp.medical_conditions
                ) as metadata
                FROM users u
                LEFT JOIN patient_profiles pp ON u.id = pp.user_id
                WHERE u.id = $1
            `;
        } else if (role === 'pharmacist') {
            query = `
                SELECT u.*,
                json_build_object(
                    'licenseNumber', php.license_number,
                    'workplace', php.workplace_name,
                    'yearsOfExperience', php.years_of_experience,
                    'bio', php.bio
                ) as metadata
                FROM users u
                LEFT JOIN pharmacist_profiles php ON u.id = php.user_id
                WHERE u.id = $1
            `;
        } else {
            // Admin or other roles without specific profiles yet
            query = `
                SELECT u.*,
                '{}'::json as metadata
                FROM users u
                WHERE u.id = $1
            `;
        }


        const result = await pool.query<ProfileQueryResult>(query, params);

        if (result.rows.length === 0) {
            const duration = Date.now() - start;
            logger.error('Profile not found', { userId, requestId, duration });
            return sendError(res, 404, 'Profile not found', 'NOT_FOUND');
        }

        const user = decryptUserRow(result.rows[0]);
        const duration = Date.now() - start;

        // Structured Logging for institutional audit
        logger.info('Profile fetched successfully', {
            userId,
            role,
            requestId,
            duration: `${duration}ms`
        });

        // Use mapUserToResponse for consistent contract.
        // PII columns (phone_number, id_number) are decrypted above.
        const normalized = mapUserToResponse(user);

        return sendResponse(res, 200, true, 'Profile fetched successfully', {
            ...normalized,
            profile: {
                fullName: user.name,
                profileImage: user.profile_image,
                profileImageMime: user.profile_image_mime,
                metadata: user.metadata
            }
        });

    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown profile error';
        const duration = Date.now() - start;
        logger.error('Internal server error during profile fetch', {
            error: errorMsg,
            userId: req.user?.id,
            requestId,
            duration: `${duration}ms`
        });
        return sendError(res, 500, 'Internal server error', 'SERVER_ERROR');
    }
};
