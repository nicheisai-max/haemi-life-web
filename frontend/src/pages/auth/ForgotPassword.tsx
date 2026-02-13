import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ArrowLeft, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Logo } from '../../components/ui/Logo';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../../lib/validation/auth.schema';
import loginBg from '../../assets/images/login_bg_premium.png';

type Step = 'request' | 'verify' | 'reset' | 'success';

// OTP schema for step 2
const otpSchema = z.object({
    otp: z.string().length(6, { message: 'Please enter a valid 6-digit code' }),
});

// Reset password schema for step 3
const resetPasswordSchema = z.object({
    password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
    confirmPassword: z.string().min(8, { message: 'Please confirm your password' }),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

type OtpFormData = z.infer<typeof otpSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export const ForgotPassword: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('request');
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [otpTimer, setOtpTimer] = useState(60);
    const [canResend, setCanResend] = useState(false);

    // Form for step 1: request password reset
    const requestForm = useForm<ForgotPasswordFormData>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: { email: '' },
    });

    // Form for step 2: verify OTP
    const otpForm = useForm<OtpFormData>({
        resolver: zodResolver(otpSchema),
        defaultValues: { otp: '' },
    });

    // Form for step 3: reset password
    const resetForm = useForm<ResetPasswordFormData>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: { password: '', confirmPassword: '' },
    });

    // OTP timer countdown
    useEffect(() => {
        if (step === 'verify' && otpTimer > 0) {
            const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
            return () => clearTimeout(timer);
        } else if (otpTimer === 0) {
            setCanResend(true);
        }
    }, [step, otpTimer]);

    const handleRequestSubmit = async (data: ForgotPasswordFormData) => {
        try {
            setError(null);
            // TODO: Call API to send reset email/OTP
            // await forgotPassword(data.email);

            setEmail(data.email);
            setStep('verify');
            setOtpTimer(60);
            setCanResend(false);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to send reset code');
        }
    };

    const handleOtpSubmit = async (_data: OtpFormData) => {
        try {
            setError(null);
            // TODO: Call API to verify OTP
            // await verifyOTP(email, data.otp);

            setStep('reset');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Invalid verification code');
        }
    };

    const handleResetSubmit = async (_data: ResetPasswordFormData) => {
        try {
            setError(null);
            // TODO: Call API to reset password
            // await resetPassword(email, data.password);

            setStep('success');
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to reset password');
        }
    };

    const handleResendOtp = async () => {
        try {
            setError(null);
            // TODO: Call API to resend OTP
            // await forgotPassword(email);

            setOtpTimer(60);
            setCanResend(false);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to resend code');
        }
    };

    const renderContent = () => {
        if (step === 'success') {
            return (
                <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400 mb-2">
                        <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold tracking-tight">Password Reset Successful!</h2>
                        <p className="text-muted-foreground">Your password has been successfully reset.</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg w-full max-w-sm border border-muted">
                        <p className="text-sm font-medium animate-pulse">Redirecting to login...</p>
                    </div>
                </div>
            );
        }

        return (
            <>
                <div className="hidden lg:flex flex-col space-y-2 text-center relative">
                    {step !== 'request' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute left-0 top-0 -mt-2 h-8 w-8 border border-gray-200 bg-white/50 backdrop-blur-sm hover:bg-white transition-all shadow-sm rounded-full"
                            onClick={() => setStep(step === 'verify' ? 'request' : 'verify')}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <div className="flex justify-center mb-6">
                        <Logo size="auth" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {step === 'request' && 'Forgot Password'}
                        {step === 'verify' && 'Verify Your Identity'}
                        {step === 'reset' && 'Reset Password'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {step === 'request' && "Enter your email address and we'll send you a verification code"}
                        {step === 'verify' && `We sent a 6-digit code to ${email}`}
                        {step === 'reset' && 'Create a new secure password for your account'}
                    </p>
                </div>

                {/* Mobile Navigation Header (Visible only on mobile) */}
                {step !== 'request' && (
                    <div className="lg:hidden flex items-center mb-6">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-muted-foreground hover:text-foreground border border-gray-200 bg-white/50 backdrop-blur-sm hover:bg-white transition-all shadow-sm rounded-full"
                            onClick={() => setStep(step === 'verify' ? 'request' : 'verify')}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                        </Button>
                    </div>
                )}

                {error && (
                    <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {step === 'request' && (
                    <Form {...requestForm}>
                        <form onSubmit={requestForm.handleSubmit(handleRequestSubmit)} className="space-y-4">
                            <FormField
                                control={requestForm.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email Address</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="email"
                                                    placeholder="Enter your email"
                                                    className="pl-9 bg-background h-11"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Button
                                type="submit"
                                className="w-full h-11 mt-2"
                                size="lg"
                                disabled={requestForm.formState.isSubmitting}
                            >
                                {requestForm.formState.isSubmitting ? 'Sending...' : 'Send Verification Code'}
                            </Button>

                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full"
                                onClick={() => navigate('/login')}
                            >
                                Back to Login
                            </Button>
                        </form>
                    </Form>
                )}

                {step === 'verify' && (
                    <Form {...otpForm}>
                        <form onSubmit={otpForm.handleSubmit(handleOtpSubmit)} className="space-y-6">
                            <FormField
                                control={otpForm.control}
                                name="otp"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <div className="relative flex justify-center">
                                                <Input
                                                    type="text"
                                                    placeholder="000000"
                                                    maxLength={6}
                                                    className="text-center text-3xl tracking-[1em] font-mono h-16 w-full max-w-[300px] bg-background"
                                                    {...field}
                                                    onChange={(e) => {
                                                        const value = e.target.value.replace(/\D/g, '');
                                                        field.onChange(value);
                                                    }}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage className="text-center" />
                                    </FormItem>
                                )}
                            />

                            <div className="text-center text-sm">
                                {canResend ? (
                                    <Button
                                        type="button"
                                        variant="link"
                                        onClick={handleResendOtp}
                                        className="p-0 h-auto font-semibold text-primary"
                                    >
                                        Resend Code
                                    </Button>
                                ) : (
                                    <span className="text-muted-foreground">
                                        Resend code in <span className="font-mono font-medium text-foreground">{otpTimer}s</span>
                                    </span>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-11"
                                size="lg"
                                disabled={otpForm.formState.isSubmitting}
                            >
                                {otpForm.formState.isSubmitting ? 'Verifying...' : 'Verify Code'}
                            </Button>
                        </form>
                    </Form>
                )}

                {step === 'reset' && (
                    <Form {...resetForm}>
                        <form onSubmit={resetForm.handleSubmit(handleResetSubmit)} className="space-y-4">
                            <FormField
                                control={resetForm.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Password</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="password"
                                                    placeholder="Create new password"
                                                    className="pl-9 bg-background h-11"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={resetForm.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Confirm Password</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="password"
                                                    placeholder="Confirm new password"
                                                    className="pl-9 bg-background h-11"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Button
                                type="submit"
                                className="w-full h-11 mt-2"
                                size="lg"
                                disabled={resetForm.formState.isSubmitting}
                            >
                                {resetForm.formState.isSubmitting ? 'Resetting...' : 'Reset Password'}
                            </Button>
                        </form>
                    </Form>
                )}
            </>
        );
    };

    const getTitle = () => {
        if (step === 'success') return 'Success!';
        if (step === 'verify') return 'Verify Identity';
        if (step === 'reset') return 'Reset Password';
        return 'Forgot Password';
    };

    const getSubtitle = () => {
        if (step === 'success') return 'Your password has been successfully reset.';
        if (step === 'verify') return `We sent a code to ${email}`;
        if (step === 'reset') return 'Create a new secure password';
        return "We'll help you get back into your account.";
    };

    return (
        <AuthLayout
            title={getTitle()}
            subtitle={getSubtitle()}
            image={loginBg}
        >
            {renderContent()}
        </AuthLayout>
    );
};
