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
    PRIVACY: '/privacy',
    TERMS: '/terms',
    HELP: '/help',
    CONSENT: '/consent',
    ONBOARDING: '/onboarding',

    // Dashboard (Role Based Redirect)
    DASHBOARD: '/dashboard',

    // Patient
    PATIENT: {
        DASHBOARD: '/dashboard', // Patient lands here
        APPOINTMENTS: '/appointments',
        BOOK_APPOINTMENT: '/book-appointment',
        PRESCRIPTIONS: '/prescriptions',
        MEDICAL_RECORDS: '/records',
        FIND_DOCTORS: '/doctors',
    },

    // Doctor
    DOCTOR: {
        DASHBOARD: '/dashboard', // Doctor lands here
        SCHEDULE: '/doctor/schedule',
        PATIENTS: '/doctor/patients',
        // Legacy redirects
        DASHBOARD_LEGACY: '/doctor/dashboard',
    },

    // Pharmacist
    PHARMACIST: {
        DASHBOARD: '/dashboard', // Pharmacist lands here
        QUEUE: '/pharmacist/queue',
        INVENTORY: '/pharmacist/inventory',
    },

    // Admin
    ADMIN: {
        DASHBOARD: '/admin', // Admin has a specific root
        USERS: '/admin/users',
        VERIFY_DOCTORS: '/admin/verify-doctors',
        SYSTEM_LOGS: '/admin/logs', // New
        // Legacy redirects
        DASHBOARD_LEGACY: '/admin/dashboard',
    },

    // Common Protected
    PROFILE: '/profile',
    SETTINGS: '/settings',
    CONSULTATION: (id: string) => `/consultation/${id}`,
};
