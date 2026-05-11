/**
 * Centralized Route Registry
 * Single source of truth for all application paths.
 */

export const PATHS = {
    // Public
    ROOT: '/',
    LOGIN: '/login',
    SIGNUP: '/signup',
    FORGOT_PASSWORD: '/forgot-password',
    STYLE_GUIDE: '/style-guide',
    NOT_FOUND: '/404',

    // Legal / Support
    PRIVACY: '/privacy-policy',
    TERMS: '/terms-of-service',
    HELP: '/help',
    CONSENT: '/telemedicine/consent',
    TELEMEDICINE: '/telemedicine',
    ONBOARDING: '/onboarding',

    // Dashboard (Role Based Redirect)
    DASHBOARD: '/dashboard',

    // Patient
    PATIENT: {
        DASHBOARD: '/dashboard',
        APPOINTMENTS: '/appointments',
        BOOK_APPOINTMENT: '/appointments/book',
        PRESCRIPTIONS: '/prescriptions',
        MEDICAL_RECORDS: '/records',
        FIND_DOCTORS: '/doctors',
    },

    // Doctor
    DOCTOR: {
        DASHBOARD: '/dashboard',
        SCHEDULE: '/doctor/schedule',
        PATIENTS: '/doctor/patients',
        /**
         * Per-patient deep-dive page (full clinical dossier, 5+ tabs).
         * Builder must substitute `:id` with the patient's UUID.
         * Route handler is added in PR #2 of the Patient Registry rollout —
         * the path is reserved here so the registry row actions and any
         * other deep-link source can settle on the canonical URL ahead of
         * the page landing.
         */
        PATIENT_PROFILE: '/doctor/patients/:id',
        REPORTS: '/doctor/reports',
        // Legacy redirects
        DASHBOARD_LEGACY: '/doctor/dashboard',
    },

    // Pharmacist
    PHARMACIST: {
        DASHBOARD: '/dashboard',
        QUEUE: '/pharmacist/queue',
        INVENTORY: '/pharmacist/inventory',
        DISPENSE: '/pharmacist/dispense',
        PRESCRIPTION_DETAIL: (id: string | number) => `/prescriptions/${id}`,
    },

    // Admin
    ADMIN: {
        DASHBOARD: '/admin',
        USERS: '/admin/users',
        VERIFY_DOCTORS: '/admin/verify-doctors',
        SYSTEM_LOGS: '/admin/logs',
        SECURITY: '/admin/security',
        SESSIONS: '/admin/sessions',
        SCREENING: '/admin/screening',
        // Legacy redirects
        DASHBOARD_LEGACY: '/admin/dashboard',
    },

    // Common Protected
    PROFILE: '/profile',
    SETTINGS: '/settings',
    CONSULTATION: (id: string) => `/consultation/${id}`,
};
