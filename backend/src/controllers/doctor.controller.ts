import { Request, Response } from 'express';
import { pool } from '../config/db';
import { env } from '../config/env';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { mapDoctorToResponse } from '../utils/doctor.mapper';
import { mapUserToResponse } from '../utils/user.mapper';
import { JoinedDoctorRow, UserEntity } from '../types/db.types';
import { auditService, SYSTEM_ANONYMOUS_ID } from '../services/audit.service';
import { decrypt } from '../utils/security';
import { isValidIanaTimezone, INSTITUTIONAL_DEFAULT_TIMEZONE } from '../utils/timezone.utils';
import {
    doctorPatientInviteRepository,
    type DoctorPatientInviteRow,
    type InviteStatus,
} from '../repositories/doctor-patient-invite.repository';

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
    | 'high-acuity';

const isPatientRegistryFilter = (value: string | undefined): value is PatientRegistryFilter => {
    return value === 'active' || value === 'lapsed' || value === 'due-for-follow-up'
        || value === 'at-risk' || value === 'high-acuity';
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

/** Compute integer age in years from a date-of-birth value. Returns
 *  null when DOB is absent. Defensive narrowing — anything non-Date /
 *  non-string returns null. */
const computeAge = (dob: Date | string | null): number | null => {
    if (dob === null) return null;
    const dobDate: Date = dob instanceof Date ? dob : new Date(dob);
    if (Number.isNaN(dobDate.getTime())) return null;
    const now = new Date();
    let age: number = now.getFullYear() - dobDate.getFullYear();
    const m: number = now.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dobDate.getDate())) age--;
    return age;
};

interface PatientProfileSummaryRow {
    id: string;
    name: string;
    phone_number: string | null;
    id_number: string | null;
    email: string | null;
    profile_image: string | null;
    profile_image_mime: string | null;
    initials: string | null;
    date_of_birth: Date | null;
    gender: string | null;
    blood_group: string | null;
    medical_conditions: string | null;
    allergies: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    completed_with_doctor: string;
    first_seen_with_doctor: Date | null;
    last_visit: Date | null;
    latest_risk_score: string | null;
}

interface PatientProfileAppointmentRow {
    id: number;
    appointment_date: string;
    appointment_time: string;
    duration_minutes: number;
    status: string;
    consultation_type: string | null;
    reason: string | null;
    notes: string | null;
    created_at: Date;
}

interface PatientProfilePrescriptionRow {
    id: number;
    doctor_id: string;
    doctor_name: string | null;
    specialization: string | null;
    appointment_id: number | null;
    prescription_date: Date;
    status: string;
    notes: string | null;
    item_count: string;
    issued_by_me: boolean;
    created_at: Date;
}

interface PatientProfileRecordRow {
    id: string;
    name: string;
    record_type: string;
    status: string;
    notes: string | null;
    uploaded_at: Date;
    doctor_name: string | null;
    facility_name: string | null;
    date_of_service: string | null;
    file_mime: string | null;
}

interface PatientProfileScreeningRow {
    appointment_id: number;
    appointment_date: string;
    question_text: string | null;
    disease_tag: string | null;
    response_value: boolean;
    additional_notes: string | null;
    risk_score: string;
    created_at: Date;
}

/**
 * GET /api/doctor/me/patients/:id — Patient deep-dive aggregator.
 *
 * Returns the full clinical dossier the doctor needs to make a 30-second
 * decision on a patient: demographics + clinical context + appointment
 * history + prescriptions (all doctors, flagged for "issued by me") +
 * uploaded records + screening trail.
 *
 * Authorization is baked into the patient SELECT — the
 * `completed_with_doctor` subquery returns 0 when there's no completed
 * appointment between the requesting doctor and the patient, which
 * collapses to 403. POPIA-compliant clinical-relationship gate.
 *
 * Five queries run in parallel via `Promise.all`. The bounded data
 * scope (per-doctor-per-patient) keeps latency comfortable — typical
 * payload is <50 rows across all tabs.
 */
export const getDoctorPatientProfile = async (req: Request, res: Response) => {
    const doctorId = req.user?.id;
    const patientId = req.params.id;

    try {
        if (!doctorId) return sendError(res, 401, 'Unauthorized');
        if (!patientId) return sendError(res, 400, 'Patient ID is required');

        // Parallel fetch — patient row carries the authorization signal
        // via `completed_with_doctor` count; the other four queries
        // safely operate even on an unauthorized request because the
        // controller short-circuits below before exposing any data.
        const [patientResult, appointmentsResult, prescriptionsResult, recordsResult, screeningsResult] = await Promise.all([
            pool.query<PatientProfileSummaryRow>(`
                SELECT
                    u.id, u.name, u.phone_number, u.id_number, u.email,
                    u.profile_image, u.profile_image_mime, u.initials,
                    pp.date_of_birth, pp.gender, pp.blood_group,
                    pp.medical_conditions, pp.allergies,
                    pp.emergency_contact_name, pp.emergency_contact_phone,
                    (
                        SELECT COUNT(*) FROM appointments a
                        WHERE a.doctor_id = $1 AND a.patient_id = u.id
                          AND a.status = 'completed' AND a.deleted_at IS NULL
                    ) AS completed_with_doctor,
                    (
                        SELECT MIN(a.appointment_date) FROM appointments a
                        WHERE a.doctor_id = $1 AND a.patient_id = u.id
                          AND a.deleted_at IS NULL
                    ) AS first_seen_with_doctor,
                    (
                        SELECT MAX(a.appointment_date) FROM appointments a
                        WHERE a.doctor_id = $1 AND a.patient_id = u.id
                          AND a.status = 'completed' AND a.deleted_at IS NULL
                    ) AS last_visit,
                    (
                        SELECT aps.risk_score::text FROM appointment_pre_screenings aps
                        JOIN appointments a2 ON a2.id = aps.appointment_id
                        WHERE a2.patient_id = u.id AND a2.doctor_id = $1
                        ORDER BY aps.created_at DESC LIMIT 1
                    ) AS latest_risk_score
                FROM users u
                LEFT JOIN patient_profiles pp ON pp.user_id = u.id
                WHERE u.id = $2 AND u.role = 'patient'
                LIMIT 1
            `, [doctorId, patientId]),
            pool.query<PatientProfileAppointmentRow>(`
                SELECT
                    a.id, a.appointment_date::text, a.appointment_time::text,
                    a.duration_minutes, a.status, a.consultation_type,
                    a.reason, a.notes, a.created_at
                FROM appointments a
                WHERE a.doctor_id = $1 AND a.patient_id = $2 AND a.deleted_at IS NULL
                ORDER BY a.appointment_date DESC, a.appointment_time DESC
            `, [doctorId, patientId]),
            pool.query<PatientProfilePrescriptionRow>(`
                SELECT
                    p.id, p.doctor_id, p.appointment_id, p.notes,
                    p.prescription_date, p.status, p.created_at,
                    u.name AS doctor_name,
                    dp.specialization,
                    (p.doctor_id = $1) AS issued_by_me,
                    (
                        SELECT COUNT(*) FROM prescription_items pi
                        WHERE pi.prescription_id = p.id
                    ) AS item_count
                FROM prescriptions p
                LEFT JOIN users u ON u.id = p.doctor_id
                LEFT JOIN doctor_profiles dp ON dp.user_id = p.doctor_id
                WHERE p.patient_id = $2 AND p.deleted_at IS NULL
                ORDER BY p.prescription_date DESC
            `, [doctorId, patientId]),
            pool.query<PatientProfileRecordRow>(`
                SELECT
                    id::text, name,
                    record_type::text, status::text,
                    notes, uploaded_at,
                    doctor_name, facility_name, date_of_service::text,
                    file_mime
                FROM medical_records
                WHERE patient_id = $1 AND deleted_at IS NULL
                ORDER BY uploaded_at DESC
            `, [patientId]),
            pool.query<PatientProfileScreeningRow>(`
                SELECT
                    aps.appointment_id,
                    a.appointment_date::text,
                    psd.question_text,
                    psd.disease_tag,
                    aps.response_value,
                    aps.additional_notes,
                    aps.risk_score::text,
                    aps.created_at
                FROM appointment_pre_screenings aps
                JOIN appointments a ON a.id = aps.appointment_id
                LEFT JOIN pre_screening_definitions psd ON psd.id = aps.question_id
                WHERE a.doctor_id = $1 AND a.patient_id = $2 AND a.deleted_at IS NULL
                ORDER BY aps.created_at DESC
            `, [doctorId, patientId]),
        ]);

        if (patientResult.rows.length === 0) {
            return sendError(res, 404, 'Patient not found');
        }
        const summaryRow = patientResult.rows[0];
        const completedWithDoctor: number = Number(summaryRow.completed_with_doctor);
        if (completedWithDoctor === 0) {
            return sendError(res, 403, 'You do not have an active clinical relationship with this patient');
        }

        const decryptedSummary = decryptUserPii(summaryRow);
        const now = new Date();
        const nowMs: number = now.getTime();
        const lastVisitMs: number = summaryRow.last_visit !== null ? summaryRow.last_visit.getTime() : nowMs;
        const latestRiskScoreNum: number | null = summaryRow.latest_risk_score === null
            ? null
            : Number(summaryRow.latest_risk_score);

        // Group screenings by appointment for the dossier tab. Average
        // the per-question risk_score so the row shows a single number
        // that's directly comparable across visits.
        const screeningsByAppt = new Map<number, {
            appointmentId: number;
            appointmentDate: string;
            responses: Array<{
                questionText: string | null;
                diseaseTag: string | null;
                responseValue: boolean;
                additionalNotes: string | null;
                riskScore: number;
            }>;
        }>();
        for (const row of screeningsResult.rows) {
            const score: number = Number(row.risk_score);
            const existing = screeningsByAppt.get(row.appointment_id);
            const entry = {
                questionText: row.question_text,
                diseaseTag: row.disease_tag,
                responseValue: row.response_value,
                additionalNotes: row.additional_notes,
                riskScore: Number.isFinite(score) ? score : 0,
            };
            if (existing === undefined) {
                screeningsByAppt.set(row.appointment_id, {
                    appointmentId: row.appointment_id,
                    appointmentDate: row.appointment_date,
                    responses: [entry],
                });
            } else {
                existing.responses.push(entry);
            }
        }
        const screenings = Array.from(screeningsByAppt.values()).map(group => {
            const avgRisk: number = group.responses.length > 0
                ? group.responses.reduce((acc, r) => acc + r.riskScore, 0) / group.responses.length
                : 0;
            return { ...group, averageRiskScore: avgRisk };
        });

        const response = {
            patient: {
                id: decryptedSummary.id,
                name: decryptedSummary.name,
                email: decryptedSummary.email,
                phoneNumber: decryptedSummary.phone_number,
                nationalId: decryptedSummary.id_number,
                profileImage: decryptedSummary.profile_image,
                profileImageMime: decryptedSummary.profile_image_mime,
                initials: decryptedSummary.initials,
                dateOfBirth: decryptedSummary.date_of_birth,
                age: computeAge(decryptedSummary.date_of_birth),
                gender: decryptedSummary.gender,
                bloodGroup: decryptedSummary.blood_group,
                medicalConditions: decryptedSummary.medical_conditions,
                allergies: decryptedSummary.allergies,
                emergencyContactName: decryptedSummary.emergency_contact_name,
                emergencyContactPhone: decryptedSummary.emergency_contact_phone,
                lifecycleStage: computeLifecycleStage(lastVisitMs, nowMs),
                acuityLevel: computeAcuityLevel(
                    Number.isFinite(latestRiskScoreNum) ? latestRiskScoreNum : null
                ),
                latestRiskScore: Number.isFinite(latestRiskScoreNum) ? latestRiskScoreNum : null,
                completedWithDoctor,
                firstSeenWithDoctor: decryptedSummary.first_seen_with_doctor,
                lastVisit: decryptedSummary.last_visit,
            },
            appointments: appointmentsResult.rows.map(row => ({
                id: row.id,
                appointmentDate: row.appointment_date,
                appointmentTime: row.appointment_time,
                durationMinutes: row.duration_minutes,
                status: row.status,
                consultationType: row.consultation_type,
                reason: row.reason,
                notes: row.notes,
                createdAt: row.created_at,
            })),
            prescriptions: prescriptionsResult.rows.map(row => ({
                id: row.id,
                doctorId: row.doctor_id,
                doctorName: row.doctor_name,
                specialization: row.specialization,
                appointmentId: row.appointment_id,
                prescriptionDate: row.prescription_date,
                status: row.status,
                notes: row.notes,
                itemCount: Number(row.item_count),
                issuedByMe: row.issued_by_me,
                createdAt: row.created_at,
            })),
            records: recordsResult.rows.map(row => ({
                id: row.id,
                name: row.name,
                recordType: row.record_type,
                status: row.status,
                notes: row.notes,
                uploadedAt: row.uploaded_at,
                doctorName: row.doctor_name,
                facilityName: row.facility_name,
                dateOfService: row.date_of_service,
                fileMime: row.file_mime,
            })),
            screenings,
        };

        return sendResponse(res, 200, true, 'Patient profile fetched', response);
    } catch (error: unknown) {
        logger.error('Error fetching patient profile:', {
            error: error instanceof Error ? error.message : String(error),
            doctorId,
            patientId,
        });
        return sendError(res, 500, 'Error fetching patient profile');
    }
};

// ─── Doctor → Patient Invite Flow (Patient Registry — PR 3/3) ───────────────

/** Default invite TTL. 30 days strikes the institutional balance —
 *  long enough for word-of-mouth conversion, short enough that stale
 *  links cannot be exfiltrated indefinitely. */
const INVITE_DEFAULT_EXPIRY_DAYS: number = 30;
const INVITE_MIN_EXPIRY_DAYS: number = 1;
const INVITE_MAX_EXPIRY_DAYS: number = 365;

interface CreateInviteRequest {
    inviteeName?: string;
    inviteePhone?: string;
    inviteeEmail?: string;
    note?: string;
    expiresInDays?: number;
}

/**
 * Compose the canonical signup link a doctor copies and shares. Built
 * from the configured `frontendUrl` so a domain change updates every
 * outstanding invite simultaneously — doctors never have to reshare.
 */
const buildInviteShareUrl = (token: string): string => {
    const base = env.frontendUrl.replace(/\/$/, '');
    return `${base}/signup?invite=${encodeURIComponent(token)}`;
};

const mapInviteRowToResponse = (row: DoctorPatientInviteRow) => ({
    id: row.id,
    doctorId: row.doctor_id,
    token: row.token,
    shareUrl: buildInviteShareUrl(row.token),
    inviteeName: row.invitee_name,
    inviteePhone: row.invitee_phone,
    inviteeEmail: row.invitee_email,
    note: row.note,
    status: row.status,
    claimedByUserId: row.claimed_by_user_id,
    claimedAt: row.claimed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

/** Compute the lifecycle-aware status of an invite. Even if the
 *  database row says `pending`, we treat it as expired in the
 *  response when the expiry timestamp is in the past. Keeps the wire
 *  honest without requiring a background sweeper. */
const liveInviteStatus = (row: DoctorPatientInviteRow): InviteStatus => {
    if (row.status === 'pending' && row.expires_at.getTime() < Date.now()) return 'expired';
    return row.status;
};

/**
 * POST /api/doctor/me/invites — Create a new patient invite.
 *
 * Doctor-only. Returns the freshly-created invite + the canonical
 * signup URL the doctor should share. No SMS/email dispatch — the
 * doctor shares the URL through any channel they prefer (zero
 * platform cost).
 */
export const createPatientInvite = async (req: Request, res: Response) => {
    const doctorId = req.user?.id;

    try {
        if (!doctorId) return sendError(res, 401, 'Unauthorized');

        const body: CreateInviteRequest = (typeof req.body === 'object' && req.body !== null)
            ? req.body as CreateInviteRequest
            : {};

        // Sanitise + clamp the expiry hint. Anything outside the safe
        // band collapses to the default — no surprises for the doctor.
        const requestedDays: number = typeof body.expiresInDays === 'number'
            ? body.expiresInDays
            : INVITE_DEFAULT_EXPIRY_DAYS;
        const expiresInDays: number = Number.isFinite(requestedDays)
            ? Math.max(INVITE_MIN_EXPIRY_DAYS, Math.min(INVITE_MAX_EXPIRY_DAYS, Math.floor(requestedDays)))
            : INVITE_DEFAULT_EXPIRY_DAYS;

        const trimOrNull = (value: string | undefined): string | null => {
            if (typeof value !== 'string') return null;
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : null;
        };

        const invite = await doctorPatientInviteRepository.create({
            doctorId,
            inviteeName: trimOrNull(body.inviteeName),
            inviteePhone: trimOrNull(body.inviteePhone),
            inviteeEmail: trimOrNull(body.inviteeEmail),
            note: trimOrNull(body.note),
            expiresInDays,
        });

        return sendResponse(res, 201, true, 'Invite created', mapInviteRowToResponse(invite));
    } catch (error: unknown) {
        logger.error('Error creating patient invite', {
            error: error instanceof Error ? error.message : String(error),
            doctorId,
        });
        return sendError(res, 500, 'Failed to create patient invite');
    }
};

/**
 * GET /api/doctor/me/invites — List the doctor's invites.
 * Returns the live-status-corrected payload so the UI doesn't need
 * client-side expiry math.
 */
export const listPatientInvites = async (req: Request, res: Response) => {
    const doctorId = req.user?.id;
    try {
        if (!doctorId) return sendError(res, 401, 'Unauthorized');

        const rows = await doctorPatientInviteRepository.listForDoctor(doctorId);
        const invites = rows.map(row => ({
            ...mapInviteRowToResponse(row),
            status: liveInviteStatus(row),
        }));

        // Surface aggregate counts for the registry "X pending / Y claimed"
        // analytics tile.
        const counts = {
            total: invites.length,
            pending: invites.filter(i => i.status === 'pending').length,
            claimed: invites.filter(i => i.status === 'claimed').length,
            expired: invites.filter(i => i.status === 'expired').length,
            revoked: invites.filter(i => i.status === 'revoked').length,
        };

        return sendResponse(res, 200, true, 'Invites fetched', { invites, counts });
    } catch (error: unknown) {
        logger.error('Error listing patient invites', {
            error: error instanceof Error ? error.message : String(error),
            doctorId,
        });
        return sendError(res, 500, 'Failed to list patient invites');
    }
};

/**
 * DELETE /api/doctor/me/invites/:id — Soft-revoke an invite.
 * Idempotent. Restricted to the owning doctor (enforced in the
 * repository UPDATE WHERE clause).
 */
export const revokePatientInvite = async (req: Request, res: Response) => {
    const doctorId = req.user?.id;
    const rawInviteId: unknown = req.params.id;
    const inviteId: string = typeof rawInviteId === 'string' ? rawInviteId : '';
    try {
        if (!doctorId) return sendError(res, 401, 'Unauthorized');
        if (inviteId.length === 0) return sendError(res, 400, 'Invite ID required');

        const ok = await doctorPatientInviteRepository.revoke(inviteId, doctorId);
        if (!ok) return sendError(res, 404, 'Invite not found or already revoked');

        return sendResponse(res, 200, true, 'Invite revoked');
    } catch (error: unknown) {
        logger.error('Error revoking patient invite', {
            error: error instanceof Error ? error.message : String(error),
            doctorId, inviteId,
        });
        return sendError(res, 500, 'Failed to revoke invite');
    }
};

/**
 * GET /api/invites/:token — PUBLIC endpoint for the signup page to
 * verify an invite token and pre-fill the signup form. Returns
 * minimal metadata only — never the doctor's contact or any sensitive
 * payload. Distinguishes between "not found / revoked", "expired",
 * "already claimed", and "valid" so the signup page can render an
 * appropriate state.
 */
export const verifyPatientInviteToken = async (req: Request, res: Response) => {
    const token = req.params.token;
    try {
        if (typeof token !== 'string' || token.length === 0) {
            return sendError(res, 400, 'Invite token required');
        }

        /** Flat verification payload — every dimension nullable so the
         *  signup page can render its banner from a single object without
         *  branching on a discriminated `valid: true|false` union. */
        const emptyResponse = {
            valid: false,
            reason: null as 'not-found' | 'expired' | 'revoked' | 'claimed' | null,
            doctorName: null as string | null,
            doctorSpecialization: null as string | null,
            inviteeName: null as string | null,
            inviteePhone: null as string | null,
            inviteeEmail: null as string | null,
        };

        const invite = await doctorPatientInviteRepository.findActiveByToken(token);
        if (invite === null) {
            return sendResponse(res, 200, true, 'Invite verified', {
                ...emptyResponse,
                reason: 'not-found',
            });
        }

        const live = liveInviteStatus(invite);
        if (live === 'expired' || live === 'revoked' || live === 'claimed') {
            return sendResponse(res, 200, true, 'Invite verified', {
                ...emptyResponse,
                reason: live,
            });
        }

        // Fetch the inviting doctor's display name (NO contact details).
        const doctorResult = await pool.query<{ name: string | null; specialization: string | null }>(`
            SELECT u.name, dp.specialization
            FROM users u
            LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
            WHERE u.id = $1 AND u.role = 'doctor'
        `, [invite.doctor_id]);
        const doctorName: string | null = doctorResult.rows[0]?.name ?? null;
        const doctorSpecialization: string | null = doctorResult.rows[0]?.specialization ?? null;

        return sendResponse(res, 200, true, 'Invite verified', {
            valid: true,
            reason: null,
            doctorName,
            doctorSpecialization,
            inviteeName: invite.invitee_name,
            inviteePhone: invite.invitee_phone,
            inviteeEmail: invite.invitee_email,
        });
    } catch (error: unknown) {
        logger.error('Error verifying invite token', {
            error: error instanceof Error ? error.message : String(error),
        });
        return sendError(res, 500, 'Failed to verify invite');
    }
};

/**
 * Whitelist of advanced sort keys accepted on the registry endpoint.
 * Anything outside this set degrades to the default
 * (`last-visit` desc) — we never trust raw query strings against an
 * ORDER BY column.
 */
type PatientRegistrySortKey = 'name' | 'last-visit' | 'total-visits' | 'age';
type PatientRegistrySortOrder = 'asc' | 'desc';

const PATIENT_REGISTRY_SORT_KEYS: ReadonlyArray<PatientRegistrySortKey> = [
    'name', 'last-visit', 'total-visits', 'age',
];
const PATIENT_REGISTRY_SORT_ORDERS: ReadonlyArray<PatientRegistrySortOrder> = ['asc', 'desc'];

const isSortKey = (v: string): v is PatientRegistrySortKey =>
    (PATIENT_REGISTRY_SORT_KEYS as ReadonlyArray<string>).includes(v);
const isSortOrder = (v: string): v is PatientRegistrySortOrder =>
    (PATIENT_REGISTRY_SORT_ORDERS as ReadonlyArray<string>).includes(v);

/** Parse a numeric query param. Returns null when missing, non-numeric,
 *  or out of the [min, max] sanity window. */
const parseNumericParam = (raw: unknown, min: number, max: number): number | null => {
    if (typeof raw !== 'string' || raw.trim().length === 0) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    if (n < min || n > max) return null;
    return n;
};

/** Parse an ISO date param. Returns null when missing or unparseable.
 *  The browser-side filter drawer emits `YYYY-MM-DD` strings — we accept
 *  any value `new Date()` can parse and treat the rest as "no filter". */
const parseDateParam = (raw: unknown): Date | null => {
    if (typeof raw !== 'string' || raw.trim().length === 0) return null;
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d : null;
};

/** Compute the patient's age in completed years from a DOB. Used by the
 *  age-range advanced filter and the `age` sort key. Returns null when
 *  the DOB column is null (patient_profiles never filled in). */
const computeAgeYears = (dob: Date | null): number | null => {
    if (dob === null) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
        age -= 1;
    }
    return age;
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

        // Advanced filter params — all optional, all individually narrowed.
        // Bounds chosen so a single out-of-range or malformed value
        // degrades silently to "no filter on this dimension" rather than
        // erroring the entire registry call.
        const ageMin: number | null = parseNumericParam(req.query.ageMin, 0, 150);
        const ageMax: number | null = parseNumericParam(req.query.ageMax, 0, 150);
        const minVisits: number | null = parseNumericParam(req.query.minVisits, 1, 10_000);
        const rawGender: unknown = req.query.gender;
        const gender: string | null =
            typeof rawGender === 'string' && rawGender.trim().length > 0
                ? rawGender.trim().toLowerCase()
                : null;
        const rawBloodGroup: unknown = req.query.bloodGroup;
        const bloodGroup: string | null =
            typeof rawBloodGroup === 'string' && rawBloodGroup.trim().length > 0
                ? rawBloodGroup.trim().toUpperCase()
                : null;
        const lastVisitFrom: Date | null = parseDateParam(req.query.lastVisitFrom);
        const lastVisitTo: Date | null = parseDateParam(req.query.lastVisitTo);

        const rawSort: unknown = req.query.sort;
        const rawOrder: unknown = req.query.order;
        const sortKey: PatientRegistrySortKey =
            typeof rawSort === 'string' && isSortKey(rawSort) ? rawSort : 'last-visit';
        const sortOrder: PatientRegistrySortOrder =
            typeof rawOrder === 'string' && isSortOrder(rawOrder) ? rawOrder : 'desc';

        // Single query that hydrates the full registry surface:
        //   - completed-appointment count + last visit anchor (existing semantic)
        //   - patient_profiles join for DOB / gender / blood group /
        //     conditions / allergies (powers the row badges + age range)
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
            const ageYears: number | null = computeAgeYears(
                row.date_of_birth === null ? null : new Date(row.date_of_birth)
            );

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
                ageYears,
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
            }
        }

        // Stage 4: apply advanced filters from the AdvancedFilterDrawer.
        // Each dimension is independent — a row must pass every dimension
        // that has a value set. Missing values short-circuit the dimension.
        if (ageMin !== null) {
            visible = visible.filter(p => p.ageYears !== null && p.ageYears >= ageMin);
        }
        if (ageMax !== null) {
            visible = visible.filter(p => p.ageYears !== null && p.ageYears <= ageMax);
        }
        if (gender !== null) {
            visible = visible.filter(p => (p.gender ?? '').toLowerCase() === gender);
        }
        if (bloodGroup !== null) {
            visible = visible.filter(p => (p.bloodGroup ?? '').toUpperCase() === bloodGroup);
        }
        if (minVisits !== null) {
            visible = visible.filter(p => p.totalAppointments >= minVisits);
        }
        if (lastVisitFrom !== null) {
            const fromMs = lastVisitFrom.getTime();
            visible = visible.filter(p => p.lastVisit.getTime() >= fromMs);
        }
        if (lastVisitTo !== null) {
            // Treat lastVisitTo as "end of day inclusive" so a single-day
            // selection (from == to) matches visits made that day.
            const toMs = lastVisitTo.getTime() + (24 * 60 * 60 * 1000 - 1);
            visible = visible.filter(p => p.lastVisit.getTime() <= toMs);
        }

        // Stage 5: sort the visible set. The default
        // (`last-visit` desc) matches the SQL ORDER BY upstream, so
        // omitting `sort`/`order` produces an identical ordering to the
        // pre-advanced-filter implementation.
        const orderMult: number = sortOrder === 'asc' ? 1 : -1;
        visible = [...visible].sort((a, b) => {
            switch (sortKey) {
                case 'name':
                    return orderMult * (a.name ?? '').localeCompare(b.name ?? '');
                case 'total-visits':
                    return orderMult * (a.totalAppointments - b.totalAppointments);
                case 'age': {
                    // Null ages sort to the end regardless of direction so
                    // unprofiled patients never dominate the first page.
                    if (a.ageYears === null && b.ageYears === null) return 0;
                    if (a.ageYears === null) return 1;
                    if (b.ageYears === null) return -1;
                    return orderMult * (a.ageYears - b.ageYears);
                }
                case 'last-visit':
                default:
                    return orderMult * (a.lastVisit.getTime() - b.lastVisit.getTime());
            }
        });

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
