import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import logo from '../../assets/logo.svg';
import './ForgotPassword.css';

type Step = 'request' | 'verify' | 'reset' | 'success';

export const ForgotPassword: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('request');
    const [identifier, setIdentifier] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [otpResendTimer, setOtpResendTimer] = useState(0);

    // Start OTP timer
    const startOtpTimer = () => {
        setOtpResendTimer(60);
        const interval = setInterval(() => {
            setOtpResendTimer((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleRequestReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // TODO: Replace with actual API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Simulate API success
            setStep('verify');
            startOtpTimer();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to send reset code');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (otp.length !== 6) {
            setError('Please enter a valid 6-digit code');
            return;
        }

        setLoading(true);
        try {
            // TODO: Replace with actual API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            setStep('reset');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Invalid verification code');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            // TODO: Replace with actual API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            setStep('success');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (otpResendTimer > 0) return;

        setLoading(true);
        try {
            // TODO: Replace with actual API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            startOtpTimer();
        } catch (err: any) {
            setError('Failed to resend code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="forgot-password-container">
            <div className="forgot-password-content">
                <div className="forgot-password-header">
                    <img src={logo} alt="Haemi Life" className="logo" />
                </div>

                <Card className="forgot-password-card">
                    {/* Request Reset */}
                    {step === 'request' && (
                        <div className="step-content fade-in">
                            <div className="step-header">
                                <h1>Reset Password</h1>
                                <p>Enter your email or phone number to receive a verification code</p>
                            </div>

                            {error && (
                                <div className="alert alert-error">
                                    <span className="material-icons-outlined">error</span>
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleRequestReset}>
                                <div className="form-group">
                                    <label htmlFor="identifier">Email or Phone Number</label>
                                    <input
                                        id="identifier"
                                        type="text"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        placeholder="Enter your email or phone"
                                        required
                                        className="form-input"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    fullWidth
                                    disabled={loading}
                                >
                                    {loading ? 'Sending...' : 'Send Verification Code'}
                                </Button>

                                <button
                                    type="button"
                                    onClick={() => navigate('/login')}
                                    className="back-to-login"
                                >
                                    <span className="material-icons-outlined">arrow_back</span>
                                    Back to Login
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Verify OTP */}
                    {step === 'verify' && (
                        <div className="step-content fade-in">
                            <div className="step-header">
                                <h1>Enter Verification Code</h1>
                                <p>We sent a 6-digit code to <strong>{identifier}</strong></p>
                            </div>

                            {error && (
                                <div className="alert alert-error">
                                    <span className="material-icons-outlined">error</span>
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleVerifyOtp}>
                                <div className="form-group">
                                    <label htmlFor="otp">Verification Code</label>
                                    <input
                                        id="otp"
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="000000"
                                        required
                                        className="form-input otp-input"
                                        maxLength={6}
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    fullWidth
                                    disabled={loading || otp.length !== 6}
                                >
                                    {loading ? 'Verifying...' : 'Verify Code'}
                                </Button>

                                <div className="resend-section">
                                    {otpResendTimer > 0 ? (
                                        <p className="resend-timer">Resend code in {otpResendTimer}s</p>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleResendOtp}
                                            className="resend-btn"
                                            disabled={loading}
                                        >
                                            Resend Code
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Reset Password */}
                    {step === 'reset' && (
                        <div className="step-content fade-in">
                            <div className="step-header">
                                <h1>Create New Password</h1>
                                <p>Choose a strong password for your account</p>
                            </div>

                            {error && (
                                <div className="alert alert-error">
                                    <span className="material-icons-outlined">error</span>
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleResetPassword}>
                                <div className="form-group">
                                    <label htmlFor="password">New Password</label>
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        required
                                        className="form-input"
                                    />
                                    <span className="field-hint">Minimum 8 characters</span>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="confirmPassword">Confirm Password</label>
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                        required
                                        className="form-input"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    fullWidth
                                    disabled={loading}
                                >
                                    {loading ? 'Resetting...' : 'Reset Password'}
                                </Button>
                            </form>
                        </div>
                    )}

                    {/* Success */}
                    {step === 'success' && (
                        <div className="step-content success-content fade-in">
                            <div className="success-icon">
                                <span className="material-icons-outlined">check_circle</span>
                            </div>
                            <h1>Password Reset Successful!</h1>
                            <p>Your password has been reset successfully. You can now log in with your new password.</p>

                            <Button
                                variant="primary"
                                fullWidth
                                onClick={() => navigate('/login')}
                                leftIcon={<span className="material-icons-outlined">login</span>}
                            >
                                Go to Login
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};
