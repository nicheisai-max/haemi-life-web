import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ArrowLeft, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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
        if (step !== 'verify' || otpTimer <= 0) return;
        const timer = setTimeout(() => {
            if (otpTimer === 1) {
                setCanResend(true);
            }
            setOtpTimer(prev => prev - 1);
        }, 1000);
        return () => clearTimeout(timer);
    }, [step, otpTimer]);

    const handleRequestSubmit = async (data: ForgotPasswordFormData) => {
        try {
            setError(null);
            setEmail(data.email);
            setStep('verify');
            setOtpTimer(60);
            setCanResend(false);
        } catch (err: unknown) {
            const apiErr = err as { response?: { data?: { message?: string } } };
            setError(apiErr.response?.data?.message || 'Failed to send reset code');
        }
    };

    const handleOtpSubmit = async (_data: OtpFormData) => {
        try {
            setError(null);
            setStep('reset');
        } catch (err: unknown) {
            const apiErr = err as { response?: { data?: { message?: string } } };
            setError(apiErr.response?.data?.message || 'Invalid verification code');
        }
    };

    const handleResetSubmit = async (_data: ResetPasswordFormData) => {
        try {
            setError(null);
            setStep('success');
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: unknown) {
            const apiErr = err as { response?: { data?: { message?: string } } };
            setError(apiErr.response?.data?.message || 'Failed to reset password');
        }
    };

    const handleResendOtp = async () => {
        try {
            setError(null);
            setOtpTimer(60);
            setCanResend(false);
        } catch (err: unknown) {
            const apiErr = err as { response?: { data?: { message?: string } } };
            setError(apiErr.response?.data?.message || 'Failed to resend code');
        }
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

    const renderForm = () => {
        if (step === 'success') {
            return (
                <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400 mb-2">
                        <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg w-full max-w-sm border border-muted text-center">
                        <p className="text-sm font-medium animate-pulse">Redirecting to login...</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {(step === 'verify' || step === 'reset') && (
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute left-0 top-0 -mt-16 h-8 w-8 border border-gray-200 bg-white/50 backdrop-blur-sm hover:bg-white transition-all shadow-sm rounded-full"
                            onClick={() => setStep(step === 'verify' ? 'request' : 'verify')}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                {error && (
                    <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                        <div className="flex-shrink-0 flex items-center justify-center">
                            <AlertCircle className="h-4 w-4" />
                        </div>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {step === 'request' && (
                    <Form {...requestForm}>
                        <form onSubmit={requestForm.handleSubmit(handleRequestSubmit)} className="space-y-4" noValidate>
                            <FormField
                                control={requestForm.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email Address</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="email"
                                                    placeholder="Enter your email"
                                                    className="pl-10 bg-background h-11"
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
                                className="w-full rounded-full hover:bg-muted/50 border border-transparent hover:border-border transition-all"
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
                                                    className="text-center text-sm font-bold tracking-[1em] h-11 w-full max-w-[300px] bg-background"
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
                                        className="p-0 h-auto font-bold text-primary hover:text-primary hover:bg-primary/5 hover:no-underline px-3 py-1 rounded-full transition-all border border-transparent hover:border-primary/20"
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
                                            <PasswordInput
                                                placeholder="Create new password"
                                                leftIcon={<KeyRound className="h-4 w-4" />}
                                                {...field}
                                            />
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
                                            <PasswordInput
                                                placeholder="Confirm new password"
                                                leftIcon={<ShieldCheck className="h-4 w-4" />}
                                                {...field}
                                            />
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
            </div>
        );
    };

    return (
        <AuthLayout
            brandingTitle="Security & Trust"
            brandingSubtitle="Haemi Life ensures your health data is always protected and your account remains secure."
            title={getTitle()}
            subtitle={getSubtitle()}
            image={loginBg}
        >
            {renderForm()}
        </AuthLayout>
    );
};
