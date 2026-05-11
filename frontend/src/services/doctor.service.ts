import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';

// =====================================================
// DOCTOR API SERVICE
// =====================================================

export interface DoctorProfile {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
    specialization: string;
    licenseNumber?: string;
    yearsOfExperience: number;
    bio: string;
    consultationFee: number;
    isVerified: boolean;
    profileImage?: string | null;
    canVideoConsult: boolean;
    // Phase 2 — Timezone Sovereignty. Always populated by the backend
    // (mapDoctorToResponse falls back to the institutional default when
    // the row is read pre-Phase-1). Optional here so older fixtures /
    // mocks that predate the rollout still satisfy the type. Phase 3
    // surfaces this as the doctor-side selector + patient-side
    // contextual banner.
    clinicTimezone?: string;
}

export interface DoctorSchedule {
    id: number; // Institutional Note: Database uses SERIAL for schedule entry IDs
    doctorId: string; // Institutional Realignment: uuid
    dayOfWeek: number; // 0-6
    startTime: string;
    endTime: string;
    isAvailable: boolean;
}

/**
 * Lifecycle stage derived server-side from days-since-last-completed-visit.
 *   active            : ≤  90 days
 *   lapsed            : 91–180 days
 *   due-for-follow-up : 181–365 days
 *   at-risk           : > 365 days
 */
export type PatientLifecycleStage = 'active' | 'lapsed' | 'due-for-follow-up' | 'at-risk';

/** Acuity bucket derived from the patient's most recent screening risk score. */
export type PatientAcuityLevel = 'low' | 'medium' | 'high';

export interface Patient {
    id: string; // Institutional Realignment: uuid (matches users.id)
    name: string;
    phoneNumber: string;
    email?: string;
    totalAppointments: number;
    lastVisit: string;
    profileImage?: string | null;
    /**
     * Enriched clinical context fields surfaced by the registry endpoint.
     * Optional on the type so older fixtures / mocks predating PR #N still
     * satisfy the shape — the patient profile page (PR #2) consumes them.
     */
    dateOfBirth?: string | null;
    gender?: string | null;
    bloodGroup?: string | null;
    medicalConditions?: string | null;
    allergies?: string | null;
    latestRiskScore?: number | null;
    lifecycleStage?: PatientLifecycleStage;
    acuityLevel?: PatientAcuityLevel;
    /**
     * Patient age in completed years, derived server-side from DOB at
     * query time. Optional because older fixtures predating the advanced
     * filter rollout do not emit it.
     */
    ageYears?: number | null;
}

/** Filter keys accepted by the registry endpoint. Mirror of the backend
 *  whitelist — frontend chips bind one-to-one to these values. */
export type PatientRegistryFilter =
    | 'active'
    | 'lapsed'
    | 'due-for-follow-up'
    | 'at-risk'
    | 'high-acuity';

/** Counts returned alongside the patient list — drive the chip badges. */
export interface PatientRegistryCounts {
    all: number;
    active: number;
    lapsed: number;
    dueForFollowUp: number;
    atRisk: number;
    highAcuity: number;
}

export interface PatientRegistryResponse {
    patients: Patient[];
    counts: PatientRegistryCounts;
}

/** Sort dimension accepted by the registry endpoint. Default `last-visit`. */
export type PatientRegistrySortKey = 'name' | 'last-visit' | 'total-visits' | 'age';
/** Sort direction. Default `desc`. */
export type PatientRegistrySortOrder = 'asc' | 'desc';

/**
 * Shape consumed by the AdvancedFilterDrawer. Every field is optional —
 * the drawer collects whichever dimensions the doctor has actually set
 * and threads them through `PatientRegistryParams` below. The wire layer
 * preserves the same optionality so a bare `getDoctorPatients()` call
 * still returns the full registry.
 */
export interface PatientRegistryAdvancedFilters {
    ageMin?: number;
    ageMax?: number;
    gender?: 'male' | 'female' | 'other';
    bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
    minVisits?: number;
    /** ISO date string (YYYY-MM-DD). Inclusive lower bound on `lastVisit`. */
    lastVisitFrom?: string;
    /** ISO date string (YYYY-MM-DD). Inclusive upper bound on `lastVisit`. */
    lastVisitTo?: string;
    sort?: PatientRegistrySortKey;
    order?: PatientRegistrySortOrder;
}

export interface PatientRegistryParams extends PatientRegistryAdvancedFilters {
    /** Free-text search across name, email, phone, national ID, conditions. */
    search?: string;
    /** Active filter chip (single-select). Omit for "no filter". */
    filter?: PatientRegistryFilter;
}

// List all verified doctors
export const listDoctors = async (params?: { specialization?: string; search?: string }) => {
    const response = await api.get<ApiResponse<DoctorProfile[]>>('/doctor', { params });
    return normalizeResponse(response);
};

// Get doctor profile by ID
export const getDoctorProfile = async (id: string) => {
    const response = await api.get<ApiResponse<DoctorProfile>>(`/doctor/${id}`);
    return normalizeResponse(response);
};

// Get list of specializations
export const getSpecializations = async () => {
    const response = await api.get<ApiResponse<string[]>>('/doctor/specializations');
    return normalizeResponse(response);
};

// Update doctor's own profile (Doctor only)
export const updateDoctorProfile = async (data: {
    specialization?: string;
    yearsOfExperience?: number;
    bio?: string;
    consultationFee?: number;
}): Promise<DoctorProfile> => {
    const response = await api.put<ApiResponse<DoctorProfile>>('/doctor/profile', data);
    return normalizeResponse(response);
};

// Get doctor's schedule
export const getDoctorSchedule = async () => {
    const response = await api.get<ApiResponse<DoctorSchedule[]>>('/doctor/me/schedule');
    return normalizeResponse(response);
};

// Update doctor's schedule
export const updateDoctorSchedule = async (schedule: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
}>): Promise<DoctorSchedule[]> => {
    const response = await api.put<ApiResponse<DoctorSchedule[]>>('/doctor/me/schedule', { schedule });
    return normalizeResponse(response);
};

// Get doctor's patients (registry endpoint with search + filter + counts).
// `params` is fully optional — calling without args returns the full,
// unfiltered set with counts attached.
export const getDoctorPatients = async (
    params?: PatientRegistryParams
): Promise<PatientRegistryResponse> => {
    const query: Record<string, string> = {};
    if (params?.search !== undefined && params.search.length > 0) query.search = params.search;
    if (params?.filter !== undefined) query.filter = params.filter;
    // Advanced filters — only emit each key when the doctor has actually
    // set it, so the registry URL stays tidy and the backend skip-logic
    // (missing → no filter on this dimension) holds.
    if (params?.ageMin !== undefined) query.ageMin = String(params.ageMin);
    if (params?.ageMax !== undefined) query.ageMax = String(params.ageMax);
    if (params?.gender !== undefined) query.gender = params.gender;
    if (params?.bloodGroup !== undefined) query.bloodGroup = params.bloodGroup;
    if (params?.minVisits !== undefined) query.minVisits = String(params.minVisits);
    if (params?.lastVisitFrom !== undefined && params.lastVisitFrom.length > 0) {
        query.lastVisitFrom = params.lastVisitFrom;
    }
    if (params?.lastVisitTo !== undefined && params.lastVisitTo.length > 0) {
        query.lastVisitTo = params.lastVisitTo;
    }
    if (params?.sort !== undefined) query.sort = params.sort;
    if (params?.order !== undefined) query.order = params.order;
    const response = await api.get<ApiResponse<PatientRegistryResponse>>(
        '/doctor/me/patients',
        { params: query }
    );
    return normalizeResponse(response);
};

// ─── DOCTOR → PATIENT INVITE FLOW (PR #3) ────────────────────────────────────

/** Lifecycle status returned by the invite endpoints. Mirror of the
 *  backend `InviteStatus` union. `expired` is computed live — the row
 *  still says `pending` in the DB, but the wire layer surfaces the live
 *  status so the UI never has to recompute. */
export type DoctorPatientInviteStatus = 'pending' | 'claimed' | 'expired' | 'revoked';

export interface DoctorPatientInvite {
    id: string;
    token: string;
    /**
     * Fully-resolved invite link the doctor copies. Composed server-side
     * from the deploy URL + the token, so the doctor never has to
     * concatenate manually and a future domain change cannot leave stale
     * links behind.
     */
    shareUrl: string;
    inviteeName: string | null;
    inviteePhone: string | null;
    inviteeEmail: string | null;
    note: string | null;
    status: DoctorPatientInviteStatus;
    claimedByUserId: string | null;
    claimedAt: string | null;
    expiresAt: string;
    createdAt: string;
}

export interface DoctorPatientInviteCounts {
    pending: number;
    claimed: number;
    expired: number;
    revoked: number;
}

export interface ListInvitesResponse {
    invites: DoctorPatientInvite[];
    counts: DoctorPatientInviteCounts;
}

export interface CreateInviteInput {
    inviteeName?: string;
    inviteePhone?: string;
    inviteeEmail?: string;
    note?: string;
    /** Days until expiry. Clamped server-side to [1, 365]. Defaults to 30. */
    expiresInDays?: number;
}

export const createPatientInvite = async (
    input: CreateInviteInput
): Promise<DoctorPatientInvite> => {
    const response = await api.post<ApiResponse<DoctorPatientInvite>>(
        '/doctor/me/invites',
        input
    );
    return normalizeResponse(response);
};

export const listPatientInvites = async (): Promise<ListInvitesResponse> => {
    const response = await api.get<ApiResponse<ListInvitesResponse>>(
        '/doctor/me/invites'
    );
    return normalizeResponse(response);
};

export const revokePatientInvite = async (inviteId: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(
        `/doctor/me/invites/${encodeURIComponent(inviteId)}`
    );
};

/**
 * Public response from the unauthenticated `/api/invites/:token`
 * endpoint. Used by the signup page to render the "Invited by Dr. X"
 * banner before the patient creates their account. `valid: false`
 * carries a stable machine-readable `reason` so the signup form can
 * surface the right copy without parsing free-text messages.
 */
export interface InviteTokenVerification {
    valid: boolean;
    reason: 'not-found' | 'expired' | 'revoked' | 'claimed' | null;
    doctorName: string | null;
    doctorSpecialization: string | null;
    inviteeName: string | null;
    inviteePhone: string | null;
    inviteeEmail: string | null;
}

export const verifyInviteToken = async (token: string): Promise<InviteTokenVerification> => {
    const response = await api.get<ApiResponse<InviteTokenVerification>>(
        `/invites/${encodeURIComponent(token)}`
    );
    return normalizeResponse(response);
};

// ─── DOCTOR: Patient Profile Deep-Dive (PR #2) ───────────────────────────────

/**
 * Per-tab row shapes returned by the patient profile aggregator
 * endpoint. Optional fields on the patient summary are present when
 * the underlying clinical record exists; null otherwise. Keep these
 * shapes strict — they bind directly to the typed UI consumers.
 */
export interface PatientProfileSummary {
    id: string;
    name: string;
    email: string | null;
    phoneNumber: string | null;
    nationalId: string | null;
    profileImage: string | null;
    profileImageMime: string | null;
    initials: string | null;
    dateOfBirth: string | null;
    age: number | null;
    gender: string | null;
    bloodGroup: string | null;
    medicalConditions: string | null;
    allergies: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    lifecycleStage: PatientLifecycleStage;
    acuityLevel: PatientAcuityLevel;
    latestRiskScore: number | null;
    completedWithDoctor: number;
    firstSeenWithDoctor: string | null;
    lastVisit: string | null;
}

export interface PatientProfileAppointment {
    id: number;
    appointmentDate: string;
    appointmentTime: string;
    durationMinutes: number;
    status: string;
    consultationType: string | null;
    reason: string | null;
    notes: string | null;
    createdAt: string;
}

export interface PatientProfilePrescription {
    id: number;
    doctorId: string;
    doctorName: string | null;
    specialization: string | null;
    appointmentId: number | null;
    prescriptionDate: string;
    status: string;
    notes: string | null;
    itemCount: number;
    issuedByMe: boolean;
    createdAt: string;
}

export interface PatientProfileRecord {
    id: string;
    name: string;
    recordType: string;
    status: string;
    notes: string | null;
    uploadedAt: string;
    doctorName: string | null;
    facilityName: string | null;
    dateOfService: string | null;
    fileMime: string | null;
}

export interface PatientProfileScreeningResponse {
    questionText: string | null;
    diseaseTag: string | null;
    responseValue: boolean;
    additionalNotes: string | null;
    riskScore: number;
}

export interface PatientProfileScreeningGroup {
    appointmentId: number;
    appointmentDate: string;
    averageRiskScore: number;
    responses: PatientProfileScreeningResponse[];
}

export interface PatientProfilePayload {
    patient: PatientProfileSummary;
    appointments: PatientProfileAppointment[];
    prescriptions: PatientProfilePrescription[];
    records: PatientProfileRecord[];
    screenings: PatientProfileScreeningGroup[];
}

/**
 * Fetch the full patient dossier for the registry deep-dive page.
 * The server enforces a clinical-relationship gate (must have ≥1
 * completed appointment with this patient) — a 403 here is an
 * authorization signal, not an error to retry. Surface the message
 * inline at the call site.
 */
export const getDoctorPatientProfile = async (patientId: string): Promise<PatientProfilePayload> => {
    const response = await api.get<ApiResponse<PatientProfilePayload>>(
        `/doctor/me/patients/${encodeURIComponent(patientId)}`
    );
    return normalizeResponse(response);
};

// Phase 3 — Timezone Sovereignty.
// Updates the doctor's authoritative clinic timezone. Wraps the
// PATCH /api/doctor/me/clinic-timezone endpoint added in Phase 2.
// The server validates IANA + emits a DOCTOR_CLINIC_TIMEZONE_UPDATED
// audit event, so the client just supplies a string and surfaces the
// outcome via toast.
export interface UpdateClinicTimezoneResponse {
    clinicTimezone: string;
}

export const updateClinicTimezone = async (timezone: string): Promise<UpdateClinicTimezoneResponse> => {
    const response = await api.patch<ApiResponse<UpdateClinicTimezoneResponse>>(
        '/doctor/me/clinic-timezone',
        { timezone }
    );
    return normalizeResponse(response);
};

// Alias for listDoctors (used by some components)
export const getDoctors = listDoctors;

export default {
    listDoctors,
    getDoctors,
    getDoctorProfile,
    getSpecializations,
    updateDoctorProfile,
    getDoctorSchedule,
    updateDoctorSchedule,
    updateClinicTimezone,
    getDoctorPatients
};
