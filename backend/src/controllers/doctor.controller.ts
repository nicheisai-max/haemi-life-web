import { Request, Response } from 'express';
import { pool } from '../config/db';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { mapDoctorToResponse } from '../utils/doctor.mapper';
import { mapUserToResponse } from '../utils/user.mapper';
import { JoinedDoctorRow, UserEntity } from '../types/db.types';
import { auditService, SYSTEM_ANONYMOUS_ID } from '../services/audit.service';
import { decrypt } from '../utils/security';
import { isValidIanaTimezone, INSTITUTIONAL_DEFAULT_TIMEZONE } from '../utils/timezone.utils';

/**
 * Decrypts the encrypted PII columns on a row joined from `users`. Mirror
 * of `UserRepository.decryptUser` but applied at the controller boundary
 * for raw SELECTs that bypass the repository. Phase 12 P0 fix: ensures
 * that listDoctors / getDoctorProfile / getDoctorPatients never emit the
 * encrypted blob into the API response.
 */
function decryptUserPii<R extends { phone_number?: string | null; id_number?: string | null }>(row: R): R {
    return {
        ...row,
        phone_number: row.phone_number ? decrypt(row.phone_number) : '',
        id_number: row.id_number ? decrypt(row.id_number) : null,
    };
}

interface UpdateDoctorProfileRequest {
    specialization?: string;
    yearsOfExperience?: number;
    bio?: string;
    consultationFee?: number;
}

interface ScheduleSlotDTO {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable?: boolean;
}

interface UpdateDoctorScheduleRequest {
    schedule: ScheduleSlotDTO[];
}

// Get all verified doctors (Public/Patient access)
export const listDoctors = async (req: Request, res: Response) => {
    const { specialization, search } = req.query;

    try {
        let query = `
            SELECT
                u.id, u.name, u.email, u.phone_number, u.profile_image, u.profile_image_mime, u.initials,
                dp.specialization, dp.years_of_experience, dp.bio, dp.consultation_fee, dp.can_video_consult,
                dp.clinic_timezone
            FROM users u
            JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE u.role = 'doctor' AND u.status = 'ACTIVE'
        `;

        const params: (string | number | boolean | null)[] = [];

        if (specialization) {
            params.push(String(specialization));
            query += ` AND dp.specialization = $${params.length}`;
        }

        if (search) {
            params.push(`%${String(search)}%`);
            query += ` AND u.name ILIKE $${params.length}`;
        }

        query += ' ORDER BY u.name ASC';

        const result = await pool.query<JoinedDoctorRow>(query, params);
        // P0 PII GUARD: decrypt phone/id before the mapper projects them.
        return sendResponse(res, 200, true, 'Doctors fetched', result.rows.map(row => mapDoctorToResponse(decryptUserPii(row))));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Error fetching doctors:', { error: message });
        
        await auditService.log({
            userId: SYSTEM_ANONYMOUS_ID,
            action: 'DOCTOR_LIST_FETCH_FAILURE',
            entityType: 'DOCTOR_PROFILE',
            details: message
        });

        return sendError(res, 500, 'Error fetching doctors');
    }
};

// Get doctor profile by ID
export const getDoctorProfile = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const result = await pool.query<JoinedDoctorRow>(`
            SELECT
                u.id, u.name, u.email, u.phone_number, u.profile_image, u.profile_image_mime, u.initials,
                dp.specialization, dp.license_number, dp.years_of_experience,
                dp.bio, dp.consultation_fee, dp.is_verified, dp.can_video_consult,
                dp.clinic_timezone
            FROM users u
            JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE u.id = $1 AND u.role = 'doctor'
        `, [id]);

        if (result.rows.length === 0) {
            return sendError(res, 404, 'Doctor not found');
        }

        // P0 PII GUARD: decrypt phone/id before the mapper projects them.
        return sendResponse(res, 200, true, 'Doctor profile fetched', mapDoctorToResponse(decryptUserPii(result.rows[0])));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Error fetching doctor profile:', {
            error: message,
            doctorId: id
        });

        await auditService.log({
            userId: SYSTEM_ANONYMOUS_ID,
            action: 'DOCTOR_PROFILE_FETCH_FAILURE',
            entityId: String(id),
            entityType: 'DOCTOR_PROFILE',
            details: message
        });

        return sendError(res, 500, 'Error fetching doctor profile');
    }
};

// Get list of specializations
export const getSpecializations = async (req: Request, res: Response) => {
    try {
        const result = await pool.query<{ specialization: string }>(`
            SELECT DISTINCT specialization 
            FROM doctor_profiles 
            WHERE specialization IS NOT NULL
            ORDER BY specialization ASC
        `);

        return sendResponse(res, 200, true, 'Specializations fetched', result.rows.map(row => row.specialization));
    } catch (error: unknown) {
        logger.error('Error fetching specializations:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Error fetching specializations');
    }
};

// Update doctor's own profile (Doctor only)
export const updateDoctorProfile = async (req: Request, res: Response) => {
    const doctorId = req.user?.id;
    const { specialization, yearsOfExperience, bio, consultationFee } = req.body as UpdateDoctorProfileRequest;

    try {
        if (!doctorId) return sendError(res, 401, 'Unauthorized');

        // Phase 10: CTE re-joins users so the response carries the full atomic
        // profile_image / profile_image_mime pair plus identity fields the mapper requires.
        // Without the join, RETURNING * from doctor_profiles would yield neither image field.
        const result = await pool.query<JoinedDoctorRow>(`
            WITH updated AS (
                UPDATE doctor_profiles
                SET
                    specialization = COALESCE($1, specialization),
                    years_of_experience = COALESCE($2, years_of_experience),
                    bio = COALESCE($3, bio),
                    consultation_fee = COALESCE($4, consultation_fee),
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $5
                RETURNING *
            )
            SELECT
                u.id, u.name, u.email, u.phone_number, u.profile_image, u.profile_image_mime,
                u.initials, u.role, u.created_at,
                updated.specialization, updated.license_number, updated.years_of_experience,
                updated.bio, updated.consultation_fee, updated.is_verified, updated.can_video_consult,
                updated.clinic_timezone
            FROM updated
            JOIN users u ON u.id = updated.user_id
        `, [specialization || null, yearsOfExperience || null, bio || null, consultationFee || null, doctorId]);

        if (result.rows.length === 0) {
            return sendError(res, 404, 'Doctor profile not found');
        }

        // P0 PII GUARD: decrypt phone/id before the mapper projects them.
        return sendResponse(res, 200, true, 'Profile updated successfully', mapDoctorToResponse(decryptUserPii(result.rows[0])));
    } catch (error: unknown) {
        logger.error('Error updating doctor profile:', {
            error: error instanceof Error ? error.message : String(error),
            doctorId
        });
        return sendError(res, 500, 'Error updating profile');
    }
};

// Get doctor's schedule
export const getDoctorSchedule = async (req: Request, res: Response) => {
    const doctorId = req.user?.id;

    try {
        if (!doctorId) return sendError(res, 401, 'Unauthorized');

        const result = await pool.query<{
            id: number;
            doctor_id: string;
            day_of_week: number;
            start_time: string;
            end_time: string;
            is_available: boolean;
            created_at: Date;
        }>(`
            SELECT * FROM doctor_schedules 
            WHERE doctor_id = $1 
            ORDER BY day_of_week, start_time
        `, [doctorId]);

        const mapped = result.rows.map(row => ({
            id: row.id,
            doctorId: row.doctor_id,
            dayOfWeek: row.day_of_week,
            startTime: row.start_time,
            endTime: row.end_time,
            isAvailable: row.is_available,
            createdAt: row.created_at
        }));

        return sendResponse(res, 200, true, 'Schedule fetched', mapped);

    } catch (error: unknown) {
        logger.error('Error fetching schedule:', {
            error: error instanceof Error ? error.message : String(error),
            doctorId
        });
        return sendError(res, 500, 'Error fetching schedule');
    }
};

// Update doctor's schedule
export const updateDoctorSchedule = async (req: Request, res: Response) => {
    const doctorId = req.user?.id;
    const { schedule } = req.body as UpdateDoctorScheduleRequest;

    try {
        if (!doctorId) return sendError(res, 401, 'Unauthorized');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Delete existing schedule
            await client.query('DELETE FROM doctor_schedules WHERE doctor_id = $1', [doctorId]);

            // Insert new schedule with explicit mapping (CamelCase -> Snake_case)
            if (schedule && Array.isArray(schedule)) {
                for (const rawSlot of schedule) {
                    const { dayOfWeek, startTime, endTime, isAvailable = true } = rawSlot;

                    await client.query(`
                        INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [doctorId, dayOfWeek, startTime, endTime, isAvailable]);
                }
            }

            await client.query('COMMIT');
            return sendResponse(res, 200, true, 'Schedule updated successfully');
        } catch (error: unknown) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error: unknown) {
        logger.error('Error updating schedule:', {
            error: error instanceof Error ? error.message : String(error),
            doctorId
        });
        return sendError(res, 500, 'Error updating schedule');
    }
};

/**
 * Update the doctor's clinic timezone (Phase 2 — Timezone Sovereignty).
 *
 * The doctor's `clinic_timezone` is the canonical authority for that
 * doctor's entire scheduling surface. Patients in the doctor's vicinity
 * see slot times in this timezone. Existing future appointments are NOT
 * silently shifted — their stored wall-clock + UTC anchor remain pinned
 * to the doctor's timezone at the time of booking. Only NEW slot
 * computations and NEW appointment writes use the updated value.
 *
 * Validation: payload must be a known IANA timezone (e.g.
 * 'Africa/Gaborone', 'Asia/Kolkata'). Anything else returns 400 — we
 * never silently fall back to the institutional default at the write
 * boundary, only at the read boundary (`resolveClinicTimezone` mapper).
 *
 * Audit: every TZ change is recorded with previous + new values for
 * forensic reconstruction. This is high-impact state — investors,
 * compliance officers, and oncall need to see who changed it and when.
 */
export const updateDoctorClinicTimezone = async (req: Request, res: Response) => {
    const doctorId = req.user?.id;
    const rawTz: unknown = (req.body as { timezone?: unknown }).timezone;

    try {
        if (!doctorId) return sendError(res, 401, 'Unauthorized');

        if (typeof rawTz !== 'string' || rawTz.length === 0) {
            return sendError(res, 400, 'Timezone must be a non-empty string');
        }
        if (!isValidIanaTimezone(rawTz)) {
            return sendError(res, 400, `Not a valid IANA timezone: ${rawTz}. Examples: ${INSTITUTIONAL_DEFAULT_TIMEZONE}, Asia/Kolkata, America/New_York.`);
        }

        // Read previous value first so the audit log records the diff.
        const prior = await pool.query<{ clinic_timezone: string | null }>(
            'SELECT clinic_timezone FROM doctor_profiles WHERE user_id = $1',
            [doctorId]
        );
        if (prior.rows.length === 0) {
            return sendError(res, 404, 'Doctor profile not found');
        }
        const previousTz: string = prior.rows[0].clinic_timezone ?? INSTITUTIONAL_DEFAULT_TIMEZONE;

        await pool.query(
            `UPDATE doctor_profiles
                SET clinic_timezone = $1,
                    updated_at = CURRENT_TIMESTAMP
              WHERE user_id = $2`,
            [rawTz, doctorId]
        );

        await auditService.log({
            userId: doctorId,
            action: 'DOCTOR_CLINIC_TIMEZONE_UPDATED',
            entityId: doctorId,
            entityType: 'DOCTOR_PROFILE',
            metadata: { previousClinicTimezone: previousTz, newClinicTimezone: rawTz }
        });

        return sendResponse(res, 200, true, 'Clinic timezone updated', { clinicTimezone: rawTz });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Error updating clinic timezone:', { error: message, doctorId });
        return sendError(res, 500, 'Error updating clinic timezone');
    }
};

/**
 * Lifecycle stage derived from the days since a patient's last completed
 * visit. Single source of truth for the "Active / Lapsed / Due-FU /
 * At-risk" filter taxonomy — frontend chips match these enum values.
 */
type PatientLifecycleStage = 'active' | 'lapsed' | 'due-for-follow-up' | 'at-risk';
type PatientAcuityLevel = 'low' | 'medium' | 'high';

const computeLifecycleStage = (lastVisitMs: number, nowMs: number): PatientLifecycleStage => {
    const days: number = Math.floor((nowMs - lastVisitMs) / (1000 * 60 * 60 * 24));
    if (days <= 90) return 'active';
    if (days <= 180) return 'lapsed';
    if (days <= 365) return 'due-for-follow-up';
    return 'at-risk';
};

const computeAcuityLevel = (latestRiskScore: number | null): PatientAcuityLevel => {
    if (latestRiskScore === null || latestRiskScore < 0.4) return 'low';
    if (latestRiskScore < 0.7) return 'medium';
    return 'high';
};

/**
 * Whitelisted filter keys for the Patient Registry chip row. Anything
 * outside this union is rejected by the controller — defensive
 * narrowing at the wire boundary keeps invalid SQL paths unreachable.
 */
type PatientRegistryFilter =
    | 'active'
    | 'lapsed'
    | 'due-for-follow-up'
    | 'at-risk'
    | 'high-acuity'
    | 'birthday-this-month';

const isPatientRegistryFilter = (value: string | undefined): value is PatientRegistryFilter => {
    return value === 'active' || value === 'lapsed' || value === 'due-for-follow-up'
        || value === 'at-risk' || value === 'high-acuity' || value === 'birthday-this-month';
};

type PatientRegistryRow = UserEntity & {
    total_appointments: string;
    last_visit: Date;
    date_of_birth: Date | null;
    gender: string | null;
    blood_group: string | null;
    medical_conditions: string | null;
    allergies: string | null;
    latest_risk_score: string | null;
};

// Get doctor's patient list
export const getDoctorPatients = async (req: Request, res: Response) => {
    const doctorId = req.user?.id;

    try {
        if (!doctorId) return sendError(res, 401, 'Unauthorized');

        // Whitelist + narrow the query params at the wire boundary.
        const rawSearch: unknown = req.query.search;
        const rawFilter: unknown = req.query.filter;
        const search: string = typeof rawSearch === 'string' ? rawSearch.trim().toLowerCase() : '';
        const filter: PatientRegistryFilter | null = typeof rawFilter === 'string' && isPatientRegistryFilter(rawFilter)
            ? rawFilter
            : null;

        // Single query that hydrates the full registry surface:
        //   - completed-appointment count + last visit anchor (existing semantic)
        //   - patient_profiles join for DOB / gender / blood group /
        //     conditions / allergies (powers the row badges + birthday filter)
        //   - LEFT-LATERAL subquery for the most recent screening risk
        //     score (powers the "high-acuity" filter + acuity badge)
        // Decryption + lifecycle-stage computation happens in JS below
        // because (a) the PII columns are encrypted at rest so SQL
        // ILIKE cannot search them, and (b) bucketing by date is faster
        // in JS for a doctor's bounded patient set (~10-200 rows) than
        // CASE expressions in SQL.
        const result = await pool.query<PatientRegistryRow>(`
            SELECT
                u.id, u.name, u.phone_number, u.id_number, u.email,
                u.profile_image, u.profile_image_mime, u.role, u.status, u.initials,
                COUNT(a.id) AS total_appointments,
                MAX(a.appointment_date) AS last_visit,
                pp.date_of_birth, pp.gender, pp.blood_group,
                pp.medical_conditions, pp.allergies,
                (
                    SELECT aps.risk_score::text
                    FROM appointment_pre_screenings aps
                    JOIN appointments a2 ON a2.id = aps.appointment_id
                    WHERE a2.patient_id = u.id AND a2.doctor_id = $1
                    ORDER BY aps.created_at DESC
                    LIMIT 1
                ) AS latest_risk_score
            FROM users u
            JOIN appointments a ON u.id = a.patient_id
            LEFT JOIN patient_profiles pp ON pp.user_id = u.id
            WHERE a.doctor_id = $1 AND a.status = 'completed'
            GROUP BY u.id, u.name, u.phone_number, u.id_number, u.email,
                     u.profile_image, u.profile_image_mime, u.role, u.status, u.initials,
                     pp.date_of_birth, pp.gender, pp.blood_group,
                     pp.medical_conditions, pp.allergies
            ORDER BY MAX(a.appointment_date) DESC
        `, [doctorId]);

        const now = new Date();
        const nowMs: number = now.getTime();
        const currentMonth: number = now.getMonth(); // 0-indexed

        // Stage 1: decrypt + enrich every row with derived fields.
        const enriched = result.rows.map(row => {
            const decrypted = decryptUserPii(row);
            const lastVisitMs: number = row.last_visit.getTime();
            const latestRiskScoreNum: number | null =
                row.latest_risk_score === null ? null : Number(row.latest_risk_score);
            const lifecycleStage: PatientLifecycleStage = computeLifecycleStage(lastVisitMs, nowMs);
            const acuityLevel: PatientAcuityLevel = computeAcuityLevel(
                Number.isFinite(latestRiskScoreNum) ? latestRiskScoreNum : null
            );
            const dobMonth: number | null = row.date_of_birth === null ? null : new Date(row.date_of_birth).getMonth();
            const isBirthdayThisMonth: boolean = dobMonth !== null && dobMonth === currentMonth;

            return {
                ...mapUserToResponse(decrypted),
                totalAppointments: Number(row.total_appointments),
                lastVisit: row.last_visit,
                dateOfBirth: row.date_of_birth,
                gender: row.gender ?? null,
                bloodGroup: row.blood_group ?? null,
                medicalConditions: row.medical_conditions ?? null,
                allergies: row.allergies ?? null,
                latestRiskScore: Number.isFinite(latestRiskScoreNum) ? latestRiskScoreNum : null,
                lifecycleStage,
                acuityLevel,
                isBirthdayThisMonth,
                // Carry decrypted PII through the haystack-search layer
                // below WITHOUT emitting them in the response. The mapper
                // already stripped phone+id from `mapUserToResponse`; we
                // re-attach the decrypted versions for the search predicate
                // and project the final response without them.
                _searchHaystack: [
                    decrypted.name ?? '',
                    decrypted.email ?? '',
                    decrypted.phone_number ?? '',
                    decrypted.id_number ?? '',
                    row.medical_conditions ?? '',
                ].join(' ').toLowerCase(),
            };
        });

        // Stage 2: compute counts across the FULL enriched set BEFORE
        // applying the active filter so the chip badges remain stable
        // as the user toggles between filters.
        const counts = {
            all: enriched.length,
            active: enriched.filter(p => p.lifecycleStage === 'active').length,
            lapsed: enriched.filter(p => p.lifecycleStage === 'lapsed').length,
            dueForFollowUp: enriched.filter(p => p.lifecycleStage === 'due-for-follow-up').length,
            atRisk: enriched.filter(p => p.lifecycleStage === 'at-risk').length,
            highAcuity: enriched.filter(p => p.acuityLevel === 'high').length,
            birthdayThisMonth: enriched.filter(p => p.isBirthdayThisMonth).length,
        };

        // Stage 3: apply search + filter to derive the rendered list.
        let visible = enriched;
        if (search.length > 0) {
            visible = visible.filter(p => p._searchHaystack.includes(search));
        }
        if (filter !== null) {
            switch (filter) {
                case 'active':
                case 'lapsed':
                case 'due-for-follow-up':
                case 'at-risk':
                    visible = visible.filter(p => p.lifecycleStage === filter);
                    break;
                case 'high-acuity':
                    visible = visible.filter(p => p.acuityLevel === 'high');
                    break;
                case 'birthday-this-month':
                    visible = visible.filter(p => p.isBirthdayThisMonth);
                    break;
            }
        }

        // Project the response — strip the search haystack so PII does
        // not leak to the wire.
        const patients = visible.map(({ _searchHaystack, ...rest }) => {
            void _searchHaystack;
            return rest;
        });

        return sendResponse(res, 200, true, 'Patients fetched', { patients, counts });

    } catch (error: unknown) {
        logger.error('Error fetching patients:', {
            error: error instanceof Error ? error.message : String(error),
            doctorId
        });
        return sendError(res, 500, 'Error fetching patients');
    }
};
