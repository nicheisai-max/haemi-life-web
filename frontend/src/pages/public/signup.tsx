import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AnimatedAlert } from '@/components/ui/animated-alert';
import { User, Stethoscope, Building2, AlertCircle, ArrowLeft, Mail, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AuthLayout } from '../../components/layout/auth-layout';
import { signupSchema, type SignupFormData } from '../../lib/validation/auth.schema';
import { getErrorMessage } from '../../lib/error';
import loginBg from '../../assets/images/login_bg_premium.png';
import type { UserRole } from '../../types/auth.types';
import { verifyInviteToken, type InviteTokenVerification } from '../../services/doctor.service';

export const Signup: React.FC = () => {
    const navigate = useNavigate();
    const { signup } = useAuth();
    const [searchParams] = useSearchParams();
    const inviteToken: string = searchParams.get('invite') ?? '';

    const [step, setStep] = useState<'role' | 'form'>('role');
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
    const [generalError, setGeneralError] = useState<string>('');
    const [inviteState, setInviteState] = useState<InviteTokenVerification | null>(null);
    const { isAuthenticated, user } = useAuth();

    // PRODUCTION UX: Redirect to the role-specific dashboard URL once authenticated.
    // Ensure all authenticated flows (Signup/Login) land on the correct landing zone.
    useEffect(() => {
        if (isAuthenticated && user) {
            // Role-based routing: Admin users land on /admin, all others /dashboard
            const target = user.role === 'admin' ? '/admin' : '/dashboard';
            navigate(target, { replace: true });
        }
    }, [isAuthenticated, user, navigate]);

    const form = useForm<SignupFormData>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            name: '',
            email: '',
            phoneNumber: '',
            idNumber: '',
            password: '',
            confirmPassword: '',
            role: 'patient',
        },
    });

    // Resolve the invite token (if any) once per mount. A valid invite
    // bypasses the role picker (patient-only by design) and pre-fills
    // whichever invitee hints the doctor captured at invite-creation
    // time. An invalid token degrades silently to a normal signup flow —
    // we never block the patient on a bad link they cannot remediate.
    useEffect(() => {
        if (inviteToken.length === 0) return;
        let cancelled = false;
        (async () => {
            try {
                const result = await verifyInviteToken(inviteToken);
                if (cancelled) return;
                setInviteState(result);
                if (result.valid) {
                    setSelectedRole('patient');
                    setStep('form');
                    form.setValue('role', 'patient');
                    if (result.inviteeName !== null && result.inviteeName.length > 0) {
                        form.setValue('name', result.inviteeName);
                    }
                    if (result.inviteeEmail !== null && result.inviteeEmail.length > 0) {
                        form.setValue('email', result.inviteeEmail);
                    }
                    if (result.inviteePhone !== null && result.inviteePhone.length > 0) {
                        // Strip leading +267 if present so the form's
                        // pre-pended country code stays canonical.
                        const local: string = result.inviteePhone.replace(/^\+?267/, '').replace(/\D/g, '').slice(0, 8);
                        form.setValue('phoneNumber', local);
                    }
                }
            } catch {
                // Network/server failure verifying the token — fall back
                // to a normal signup. The patient can still create the
                // account; they just won't be auto-linked to the doctor.
                if (!cancelled) setInviteState(null);
            }
        })();
        return () => { cancelled = true; };
    }, [inviteToken, form]);

    const handleRoleSelect = (role: UserRole) => {
        setSelectedRole(role);
        form.setValue('role', role as 'patient' | 'doctor' | 'pharmacist');
        setStep('form');
    };

    const onSubmit = async (data: SignupFormData) => {
        setGeneralError('');

        try {
            await signup({
                name: data.name,
                phoneNumber: `+267${data.phoneNumber}`,
                email: data.email || undefined,
                password: data.password,
                role: data.role,
                idNumber: data.idNumber || undefined,
                // Only forward the token when the verify step succeeded.
                // Forwarding a known-bad token would just be ignored
                // server-side, but pruning it here keeps the request
                // body honest and trims wire bytes.
                inviteToken: (inviteState !== null && inviteState.valid && data.role === 'patient')
                    ? inviteToken
                    : undefined,
            });

            // Navigation is now handled by the AuthContext state change effect
            // which detects the new user and redirects to /dashboard automatically.
        } catch (error: unknown) {
            console.error('Signup failed:', error);
            setGeneralError(getErrorMessage(error, 'Signup failed. Please try again.'));
        }
    };

    const content = step === 'role' ? (
        <>
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
            <div className="relative">
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-0 top-0 -mt-16 h-8 w-8 border border-gray-200 bg-white/50 backdrop-blur-sm hover:bg-white transition-all shadow-sm rounded-full"
                    onClick={() => {
                        setStep('role');
                        setSelectedRole(null);
                    }}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
            </div>

            <Form {...form}>
                <AnimatedAlert visible={Boolean(generalError)}>
                    <Alert variant="destructive">
                        <div className="flex-shrink-0 flex items-center justify-center">
                            <AlertCircle className="h-4 w-4" />
                        </div>
                        <AlertDescription>{generalError}</AlertDescription>
                    </Alert>
                </AnimatedAlert>

                <AnimatedAlert visible={inviteState !== null && inviteState.valid && selectedRole === 'patient'}>
                    <Alert className="border-primary/20 bg-primary/5">
                        <div className="flex-shrink-0 flex items-center justify-center text-primary">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <AlertDescription className="text-foreground/90">
                            You were invited by <span className="font-semibold text-primary">
                                Dr. {inviteState?.doctorName ?? 'your doctor'}
                            </span>
                            {inviteState?.doctorSpecialization !== null && inviteState?.doctorSpecialization !== undefined
                                ? ` (${inviteState.doctorSpecialization})`
                                : ''}
                            . Complete your account to connect with their practice.
                        </AlertDescription>
                    </Alert>
                </AnimatedAlert>

                <AnimatedAlert visible={inviteState !== null && !inviteState.valid && inviteToken.length > 0}>
                    <Alert>
                        <div className="flex-shrink-0 flex items-center justify-center text-muted-foreground">
                            <AlertCircle className="h-4 w-4" />
                        </div>
                        <AlertDescription className="text-muted-foreground">
                            {inviteState?.reason === 'expired' && 'This invite link has expired. You can still create your account — please ask your doctor for a new link to connect.'}
                            {inviteState?.reason === 'revoked' && 'This invite link has been revoked. You can still create an account; please contact your doctor for a fresh link.'}
                            {inviteState?.reason === 'claimed' && 'This invite link has already been used. You can still create a new account independently.'}
                            {inviteState?.reason === 'not-found' && 'We could not verify the invite link. You can still create an account.'}
                        </AlertDescription>
                    </Alert>
                </AnimatedAlert>
                <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Enter your full name"
                                                className="pl-10"
                                                {...field}
                                                autoComplete="name"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="phoneNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Phone Number</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                                <span className="text-primary text-sm">+267</span>
                                            </div>
                                            <Input
                                                type="tel"
                                                placeholder="71 234 567"
                                                className="pl-14"
                                                {...field}
                                                autoComplete="tel"
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
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="email"
                                            placeholder="your.email@example.com"
                                            className="h-11 pl-10"
                                            {...field}
                                            autoComplete="email"
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {selectedRole === 'patient' && (
                        <FormField
                            control={form.control}
                            name="idNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Omang ID (Optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Enter your Omang ID"
                                            {...field}
                                            autoComplete="username"
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
                                            leftIcon={<Lock className="h-4 w-4" />}
                                            autoComplete="new-password"
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
                                            leftIcon={<ShieldCheck className="h-4 w-4" />}
                                            autoComplete="new-password"
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
                        className="w-full mt-4"
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
            brandingTitle="Join the Health Revolution."
            brandingSubtitle="Haemi Life is Botswana's national digital healthcare ecosystem. Secure, efficient, and centered around you."
            title={step === 'role' ? 'Create Account' : `Sign up as ${selectedRole === 'patient' ? 'Patient' : selectedRole === 'doctor' ? 'Doctor' : 'Pharmacist'}`}
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
        className={`group interactive-card premium-gradient-border flex flex-col items-center text-center p-6 rounded-[var(--card-radius)] cursor-pointer outline-none transition-all ${isSelected ? 'selected-card' : ''}`}
    >
        <div className={`mb-4 p-3 rounded-full bg-primary/5 text-primary transition-all transition-duration-[var(--duration-hover)] ease-[var(--ease-premium)] group-hover:scale-[1.08] group-hover:bg-primary group-hover:text-white group-hover:shadow-[0_0_15px_-3px_rgba(27,167,166,0.3)] icon-wrapper`}>
            {icon}
        </div>
        <h3 className="text-sm font-semibold mb-1 tracking-tight transition-colors group-hover:text-primary">{title}</h3>
        <p className="text-[11px] leading-relaxed text-muted-foreground/80 opacity-90 group-hover:opacity-100 transition-opacity">{description}</p>
    </div>
);
