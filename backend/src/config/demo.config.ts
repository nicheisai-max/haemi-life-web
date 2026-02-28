/**
 * Demo Mode Configuration
 * Controls demo-safe behavior for investor presentations
 */

export const demoConfig = {
    // Check if demo mode is enabled
    isDemoMode: (): boolean => {
        return process.env.DEMO_MODE === 'true';
    },

    // Demo mode logging
    log: (_action: string, _data?: unknown) => {
        if (demoConfig.isDemoMode()) {
            // Silenced for production-grade terminal clarity
        }
    },

    // Check if external services should be disabled
    shouldDisableExternalServices: (): boolean => {
        return demoConfig.isDemoMode();
    },

    // Demo session duration (longer for demos)
    DEMO_SESSION_DURATION: '24h',
};

export default demoConfig;
