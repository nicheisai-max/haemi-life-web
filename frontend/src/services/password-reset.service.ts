import api from './api';

/**
 * Request password reset - sends OTP to email/phone
 */
export const requestPasswordReset = async (identifier: string) => {
    const response = await api.post('/password-reset/request-reset', { identifier });
    return response.data;
};

/**
 * Verify OTP for password reset
 */
export const verifyResetOTP = async (identifier: string, otp: string) => {
    const response = await api.post('/password-reset/verify-otp', { identifier, otp });
    return response.data;
};

/**
 * Reset password with verified token
 */
export const resetPassword = async (resetToken: string, newPassword: string) => {
    const response = await api.post('/password-reset/reset-password', { resetToken, newPassword });
    return response.data;
};

/**
 * Resend OTP for password reset
 */
export const resendResetOTP = async (identifier: string) => {
    const response = await api.post('/password-reset/resend-otp', { identifier });
    return response.data;
};
