import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Stethoscope, Building2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Logo } from '../../components/ui/Logo';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { signupSchema, type SignupFormData } from '../../lib/validation/auth.schema';
import loginBg from '../../assets/images/login_bg_premium.png';
import type { UserRole } from '../../types/auth.types';

export const Signup: React.FC = () => {
    const navigate = useNavigate();
    const { signup } = useAuth();

    const [step, setStep] = useState<'role' | 'form'>('role');
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
    const [generalError, setGeneralError] = useState<string>('');

    const form = useForm<SignupFormData>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            name: '',
            email: '',
            phone_number: '',
            omang_id: '',
            password: '',
            confirmPassword: '',
            role: 'patient',
        },
    });

    const handleRoleSelect = (role: UserRole) => {
        setSelectedRole(role);
        form.setValue('role', role as any);
        setStep('form');
    };

    const onSubmit = async (data: SignupFormData) => {
        setGeneralError('');

        try {
            await signup({
                name: data.name,
                phone_number: data.phone_number,
                email: data.email || undefined,
                password: data.password,
                role: data.role,
                id_number: data.omang_id || undefined,
            });

            navigate('/dashboard');
        } catch (error: any) {
            console.error('Signup failed:', error);
            setGeneralError(
                error.response?.data?.message || 'Signup failed. Please try again.'
            );
        }
    };

    const content = step === 'role' ? (
        <>
            <div className="hidden lg:flex flex-col space-y-2 text-center">
                <div className="flex justify-center mb-6">
                    <Logo size="auth" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Create Account</h1>
                <p className="text-sm text-muted-foreground">Choose your account type to get started</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <RoleCard
                    icon={<User className="h-6 w-6" />}
                    title="Member"
                    description="Personal Health"
                    isSelected={selectedRole === 'patient'}
                    onClick={() => handleRoleSelect('patient')}
                />
                <RoleCard
                    icon={<Stethoscope className="h-6 w-6" />}
                    title="Doctor"
                    description="Practice Admin"
                    isSelected={selectedRole === 'doctor'}
                    onClick={() => handleRoleSelect('doctor')}
                />
                <RoleCard
                    icon={<Building2 className="h-6 w-6" />}
                    title="Pharmacist"
                    description="Dispensary"
                    isSelected={selectedRole === 'pharmacist'}
                    onClick={() => handleRoleSelect('pharmacist')}
                />
            </div>

            <div className="text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <Button
                    variant="link"
                    className="p-0 h-auto font-bold text-primary hover:text-primary hover:bg-primary/5 hover:no-underline px-3 py-1 rounded-full transition-all border border-transparent hover:border-primary/20"
                    onClick={() => navigate('/login')}
                >
                    Sign In
                </Button>
            </div>
        </>
    ) : (
        <>
            <div className="hidden lg:flex flex-col space-y-2 text-center relative">
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-0 top-0 -mt-2 h-8 w-8 border border-gray-200 bg-white/50 backdrop-blur-sm hover:bg-white transition-all shadow-sm rounded-full"
                    onClick={() => setStep('role')}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex justify-center mb-4">
                    <Logo size="auth" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">
                    Sign up as {selectedRole === 'patient' ? 'Patient' : selectedRole === 'doctor' ? 'Doctor' : 'Pharmacist'}
                </h1>
                <p className="text-sm text-muted-foreground">Create your account to continue</p>
            </div>

            {/* Mobile Back Button (Visible only on small screens since header is hidden) */}
            <div className="lg:hidden flex items-center mb-4">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-muted-foreground hover:text-foreground border border-gray-200 bg-white/50 backdrop-blur-sm hover:bg-white transition-all shadow-sm rounded-full"
                    onClick={() => setStep('role')}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
            </div>

            <Form {...form}>
                {generalError && (
                    <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{generalError}</AlertDescription>
                    </Alert>
                )}
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Enter your full name"
                                            className="bg-background h-10"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="phone_number"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Phone Number</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                                <span className="text-[#1BA7A6] text-sm">+267</span>
                                            </div>
                                            <Input
                                                type="tel"
                                                placeholder="71 234 567"
                                                className="bg-background h-10 pl-14"
                                                {...field}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                                                    field.onChange(value);
                                                }}
                                                maxLength={8}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <Input
                                        type="email"
                                        placeholder="your.email@example.com"
                                        className="bg-background h-10"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {selectedRole === 'patient' && (
                        <FormField
                            control={form.control}
                            name="omang_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Omang ID (Optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Enter your Omang ID"
                                            className="bg-background h-10"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <PasswordInput
                                            placeholder="Create a strong password"
                                            className="bg-background h-10"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Confirm Password</FormLabel>
                                    <FormControl>
                                        <PasswordInput
                                            placeholder="Re-enter your password"
                                            className="bg-background h-10"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-11 mt-4"
                        size="lg"
                        disabled={form.formState.isSubmitting}
                    >
                        {form.formState.isSubmitting ? 'Creating account...' : 'Create Account'}
                    </Button>
                </form>
            </Form>
        </>
    );

    return (
        <AuthLayout
            title={step === 'role' ? 'Join the Health Revolution.' : `Sign up as ${selectedRole === 'patient' ? 'Patient' : selectedRole === 'doctor' ? 'Doctor' : 'Pharmacist'}`}
            subtitle={step === 'role' ? 'Choose your account type to get started' : 'Create your account to continue'}
            image={loginBg}
        >
            {content}
        </AuthLayout>
    );
};

interface RoleCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    isSelected?: boolean;
    onClick: () => void;
}

const RoleCard: React.FC<RoleCardProps> = ({ icon, title, description, isSelected, onClick }) => (
    <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
            }
        }}
        className={`group interactive-card premium-gradient-border flex flex-col items-center text-center p-6 rounded-2xl cursor-pointer outline-none transition-all ${isSelected ? 'selected-card' : ''}`}
    >
        <div className={`mb-4 p-3 rounded-full bg-primary/5 text-primary transition-all transition-duration-[var(--duration-hover)] ease-[var(--ease-premium)] group-hover:scale-[1.08] group-hover:bg-primary group-hover:text-white group-hover:shadow-[0_0_15px_-3px_rgba(27,167,166,0.3)] icon-wrapper`}>
            {icon}
        </div>
        <h3 className="text-sm font-semibold mb-1 tracking-tight transition-colors group-hover:text-primary">{title}</h3>
        <p className="text-[11px] leading-relaxed text-muted-foreground/80 opacity-90 group-hover:opacity-100 transition-opacity">{description}</p>
    </div>
);
