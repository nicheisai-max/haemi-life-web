import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { loginSchema, type LoginFormData } from '../../lib/validation/auth.schema';
import loginBg from '../../assets/images/login_bg_premium.png';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login, isAuthenticated } = useAuth();
    const [generalError, setGeneralError] = useState<string>('');

    // PRODUCTION UX: Instant redirection if already authenticated
    // This maintains the "polished" feel the user prefers
    React.useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const form = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            emailOrPhone: '',
            password: '',
        },
    });

    const onSubmit = async (data: LoginFormData) => {
        setGeneralError('');

        try {
            const cleanIdentifier = data.emailOrPhone.trim().toLowerCase();
            const credentials = {
                identifier: cleanIdentifier,
                password: data.password,
            };

            await login(credentials);
            // The useEffect above will handle the navigation once state updates
        } catch (error: any) {
            console.error('Login failed:', error);
            setGeneralError(
                error.response?.data?.message || 'Login failed. Please check your credentials.'
            );
        }
    };

    return (
        <AuthLayout
            brandingTitle="Your Health, Reimagined."
            brandingSubtitle="Experience the future of healthcare management with Haemi Life. Secure, efficient, and centered around you."
            title="Welcome Back"
            subtitle="Sign in to access your dashboard"
            image={loginBg}
        >
            <Form {...form}>
                {generalError && (
                    <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                        <div className="flex-shrink-0 flex items-center justify-center">
                            <AlertCircle className="h-4 w-4" />
                        </div>
                        <AlertDescription>{generalError}</AlertDescription>
                    </Alert>
                )}
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="emailOrPhone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email or Phone</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="user@example.com"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center justify-between">
                                    <FormLabel>Password</FormLabel>
                                    <Link
                                        to="/forgot-password"
                                        className="text-xs font-semibold text-primary hover:text-primary hover:bg-primary/5 hover:no-underline px-3 py-1 rounded-full transition-all border border-transparent hover:border-primary/20"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <FormControl>
                                    <PasswordInput
                                        placeholder="Enter your password"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button
                        type="submit"
                        className="w-full mt-2"
                        size="lg"
                        disabled={form.formState.isSubmitting}
                    >
                        {form.formState.isSubmitting ? 'Signing in...' : 'Sign In'}
                    </Button>
                </form>
            </Form>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-muted" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
            </div>

            <div className="text-center text-sm">
                <span className="text-muted-foreground">Don't have an account? </span>
                <Button
                    variant="link"
                    className="p-0 h-auto font-bold text-primary hover:text-primary hover:bg-primary/5 hover:no-underline px-3 py-1 rounded-full transition-all border border-transparent hover:border-primary/20"
                    onClick={() => navigate('/signup')}
                >
                    Create Account
                </Button>
            </div>
        </AuthLayout>
    );
};
