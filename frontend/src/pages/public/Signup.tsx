import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
            <div className="flex flex-col space-y-2 text-center">
                <div className="flex justify-center mb-6">
                    <Logo size="md" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Create Account</h1>
                <p className="text-sm text-muted-foreground">Choose your account type to get started</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <RoleCard
                    icon={<User className="h-6 w-6" />}
                    title="Member"
                    description="Personal Health"
                    onClick={() => handleRoleSelect('patient')}
                />
                <RoleCard
                    icon={<Stethoscope className="h-6 w-6" />}
                    title="Doctor"
                    description="Practice Admin"
                    onClick={() => handleRoleSelect('doctor')}
                />
                <RoleCard
                    icon={<Building2 className="h-6 w-6" />}
                    title="Pharmacist"
                    description="Dispensary"
                    onClick={() => handleRoleSelect('pharmacist')}
                />
            </div>

            <div className="text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <Button
                    variant="link"
                    className="p-0 h-auto font-semibold text-primary hover:text-primary/80 hover:no-underline"
                    onClick={() => navigate('/login')}
                >
                    Sign In
                </Button>
            </div>
        </>
    ) : (
        <>
            <div className="flex flex-col space-y-2 text-center relative">
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-0 top-0 -mt-2 h-8 w-8"
                    onClick={() => setStep('role')}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex justify-center mb-4">
                    <Logo size="md" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">
                    Sign up as {selectedRole === 'patient' ? 'Patient' : selectedRole === 'doctor' ? 'Doctor' : 'Pharmacist'}
                </h1>
                <p className="text-sm text-muted-foreground">Create your account to continue</p>
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
                                        <Input
                                            type="tel"
                                            placeholder="+267 1234 5678"
                                            className="bg-background h-10"
                                            {...field}
                                        />
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
                                        <Input
                                            type="password"
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
                                        <Input
                                            type="password"
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
            title={<>{step === 'role' ? 'Join the Health Revolution.' : 'Your Journey Starts Here.'}</>}
            subtitle="Experience the future of healthcare management with Haemi Life. Secure, efficient, and centered around you."
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
    onClick: () => void;
}

const RoleCard: React.FC<RoleCardProps> = ({ icon, title, description, onClick }) => (
    <div
        onClick={onClick}
        className="group relative flex flex-col items-start p-4 rounded-xl border border-input bg-background hover:bg-accent/5 hover:border-primary/50 transition-all cursor-pointer hover:shadow-md"
    >
        <div className="mb-3 p-2.5 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            {icon}
        </div>
        <h3 className="font-semibold text-sm mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
    </div>
);
