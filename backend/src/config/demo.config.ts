/**
 * Demo Mode Configuration
 * Controls demo-safe behavior for investor presentations
 */

export const demoConfig = {
    // Check if demo mode is enabled
    isDemoMode: (): boolean => {
        return process.env.DEMO_MODE === 'true';
    },

    // Demo-safe OTP (always valid in demo mode)
    DEMO_OTP: '123456',

    // Demo mode logging
    log: (action: string, data?: any) => {
        if (demoConfig.isDemoMode()) {
            console.log(`[DEMO MODE] ${action}`, data || '');
        }
    },

    // Check if external services should be disabled
    shouldDisableExternalServices: (): boolean => {
        return demoConfig.isDemoMode();
    },

    // Demo verification token (pre-seeded in DB)
    DEMO_VERIFICATION_TOKEN: 'demo-verified-token-2026',

    // Demo session duration (longer for demos)
    DEMO_SESSION_DURATION: '24h',
};

export default demoConfig;
