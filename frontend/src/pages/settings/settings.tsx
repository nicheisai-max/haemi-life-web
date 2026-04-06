import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle2, User, Mail, Phone, Shield, Bell, MessageSquare, Megaphone, Trash2, Power, Save, ShieldCheck, KeyRound, Settings2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { changePassword } from '../../services/user.service';
import { changePasswordSchema, type ChangePasswordFormData } from '../../lib/validation/auth.schema';
import { preferencesSchema, type PreferencesFormData } from '../../lib/validation/preferences.schema';
import { adminSettingsService } from '../../services/admin.service';
import { PremiumNumberInput } from '@/components/ui/premium-number-input';
import { getErrorMessage } from '../../lib/error';
import { Clock } from 'lucide-react';

export const Settings: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [generalError, setGeneralError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [sessionTimeout, setSessionTimeout] = useState<number>(60);
    const [isSavingTimeout, setIsSavingTimeout] = useState(false);
    const isAdmin = user?.role === 'admin';

    React.useEffect(() => {
        if (isAdmin) {
            adminSettingsService.getSessionTimeout()
                .then(data => setSessionTimeout(data.timeout))
                .catch(err => console.error('Failed to load session timeout', err));
        }
    }, [isAdmin]);

    const onUpdateTimeout = async () => {
        try {
            setIsSavingTimeout(true);
            setGeneralError(null);
            setSuccess(null);

            await adminSettingsService.updateSessionTimeout(sessionTimeout);

            setSuccess('Session timeout updated successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: unknown) {
            setGeneralError(getErrorMessage(err, 'Failed to update session timeout'));
        } finally {
            setIsSavingTimeout(false);
        }
    };

    const form = useForm<ChangePasswordFormData>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        },
    });

    const prefForm = useForm<PreferencesFormData>({
        resolver: zodResolver(preferencesSchema),
        defaultValues: {
            emailNotifications: true,
            smsNotifications: true,
            marketingCommunications: false,
        },
    });

    const onSubmitPassword = async (data: ChangePasswordFormData) => {
        try {
            setGeneralError(null);
            setSuccess(null);

            await changePassword({
                currentPassword: data.currentPassword,
                newPassword: data.newPassword
            });

            setSuccess('Password changed successfully!');
            form.reset();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: unknown) {
            setGeneralError(getErrorMessage(err, 'Failed to change password'));
        }
    };

    const onPrefSubmit = async () => {
        try {
            setGeneralError(null);
            setSuccess(null);
            // Simulate API call
            setSuccess('Preferences updated successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch {
            setGeneralError('Failed to update preferences');
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="page-heading">Settings</h1>
                <p className="page-subheading">Manage your account preferences and security settings</p>
            </div>

            {generalError && (
                <Alert variant="destructive">
                    <div className="flex-shrink-0 flex items-center justify-center">
                        <AlertCircle className="h-4 w-4" />
                    </div>
                    <AlertDescription>{generalError}</AlertDescription>
                </Alert>
            )}

            {success && (
                <Alert className="border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400">
                    <div className="flex-shrink-0 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Account Information */}
                <Card className="p-6 h-full flex flex-col">
                    <div className="mb-6 pb-4 border-b">
                        <h2 className="text-xl font-semibold">Account Information</h2>
                    </div>

                    <div className="space-y-6 flex-1">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <User className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="font-medium">{user?.name || 'N/A'}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Mail className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Email</div>
                                <div className="font-medium">{user?.email || 'N/A'}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Phone className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Phone</div>
                                <div className="font-medium">{user?.phoneNumber || 'N/A'}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Shield className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Role</div>
                                <div className="font-medium capitalize">{user?.role}</div>
                            </div>
                        </div>
                    </div>

                    <Button
                        variant="premium"
                        className="w-full mt-8 gap-2"
                        onClick={() => navigate('/profile')}
                    >
                        <User className="h-4 w-4" />
                        Edit Profile
                    </Button>
                </Card>

                {/* Change Password */}
                <Card className="p-6 h-full flex flex-col">
                    <div className="mb-6 pb-4 border-b">
                        <h2 className="text-xl font-semibold">Change Password</h2>
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmitPassword)} className="space-y-4 flex-1" noValidate>
                            {/* 🩺 HAEMI ACCESSIBILITY HARDENING (W3C/Google Standard) */}
                            {/* Hidden username field allows password managers to correctly associate new-password changes with the user account. */}
                            <input 
                                type="text"
                                name="username"
                                value={user?.email || ''}
                                readOnly
                                autoComplete="username"
                                style={{ display: 'none' }}
                                aria-hidden="true"
                            />

                            <FormField
                                control={form.control}
                                name="currentPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Current Password</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder="Enter current password"
                                                {...field}
                                                autoComplete="current-password"
                                                className="bg-background"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="newPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Password</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder="Enter new password"
                                                {...field}
                                                autoComplete="new-password"
                                                className="bg-background"
                                            />
                                        </FormControl>
                                        <p className="text-[0.8rem] text-muted-foreground">Minimum 6 characters</p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Confirm New Password</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder="Confirm new password"
                                                {...field}
                                                autoComplete="new-password"
                                                className="bg-background"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="pt-4 mt-auto">
                                <Button
                                    type="submit"
                                    variant="premium"
                                    className="w-full gap-2"
                                    disabled={form.formState.isSubmitting}
                                >
                                    <KeyRound className="h-4 w-4" />
                                    {form.formState.isSubmitting ? 'Updating...' : 'Update Password'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </Card>

                {/* Preferences */}
                <Card className="p-6">
                    <div className="mb-6 pb-4 border-b">
                        <h2 className="text-xl font-semibold">Preferences</h2>
                    </div>

                    <Form {...prefForm}>
                        <form onSubmit={prefForm.handleSubmit(onPrefSubmit)} className="space-y-6" noValidate>
                            <FormField
                                control={prefForm.control}
                                name="emailNotifications"
                                render={({ field }) => (
                                    <FormItem className="flex items-center justify-between gap-4">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <Bell className="h-4 w-4 text-muted-foreground" />
                                                <FormLabel className="text-base font-medium">Email Notifications</FormLabel>
                                            </div>
                                            <p className="text-sm text-muted-foreground pl-6">Receive email notifications for appointments</p>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={prefForm.control}
                                name="smsNotifications"
                                render={({ field }) => (
                                    <FormItem className="flex items-center justify-between gap-4">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                                <FormLabel className="text-base font-medium">SMS Notifications</FormLabel>
                                            </div>
                                            <p className="text-sm text-muted-foreground pl-6">Receive SMS reminders for appointments</p>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={prefForm.control}
                                name="marketingCommunications"
                                render={({ field }) => (
                                    <FormItem className="flex items-center justify-between gap-4">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <Megaphone className="h-4 w-4 text-muted-foreground" />
                                                <FormLabel className="text-base font-medium">Marketing Communications</FormLabel>
                                            </div>
                                            <p className="text-sm text-muted-foreground pl-6">Receive updates about new features and services</p>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <Button
                                type="submit"
                                variant="premium"
                                className="w-full mt-4 gap-2"
                                disabled={prefForm.formState.isSubmitting}
                            >
                                <Settings2 className="h-4 w-4" />
                                {prefForm.formState.isSubmitting ? 'Saving...' : 'Save Preferences'}
                            </Button>
                        </form>
                    </Form>
                </Card>

                {/* Admin Session Management */}
                {isAdmin && (
                    <Card className="p-6 h-full flex flex-col">
                        <div className="mb-6 pb-4 border-b">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <Clock className="h-5 w-5 text-primary" />
                                Session Management
                            </h2>
                        </div>

                        <div className="space-y-6 flex-1">
                            <div className="flex flex-col pt-2">
                                <label className="text-sm font-semibold tracking-wide text-muted-foreground uppercase mb-4 block">
                                    Global Session Timeout (Minutes)
                                </label>
                                <div className="flex items-center gap-4">
                                    <PremiumNumberInput
                                        id="session-timeout-input"
                                        name="sessionTimeout"
                                        value={sessionTimeout}
                                        onChange={setSessionTimeout}
                                        min={5}
                                        max={1440}
                                        className="w-40"
                                    />
                                    <Button
                                        onClick={onUpdateTimeout}
                                        disabled={isSavingTimeout || sessionTimeout < 5 || sessionTimeout > 1440}
                                        variant="premium"
                                        className="h-11 px-6 font-bold text-xs uppercase tracking-widest gap-2"
                                    >
                                        <Save className="h-4 w-4" />
                                        {isSavingTimeout ? 'Saving...' : 'Save Configuration'}
                                    </Button>
                                </div>
                                <p className="text-[0.8rem] text-muted-foreground mt-2">
                                    Minimum: 5 mins | Maximum: 1440 mins (24h)
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/10 text-muted-foreground text-sm backdrop-blur-sm">
                            <p className="font-semibold flex items-center gap-2 mb-1 text-primary">
                                <ShieldCheck className="h-4 w-4" />
                                Security Note
                            </p>
                            Changes will apply to all roles for newly issued sessions.
                        </div>
                    </Card>
                )}

                {/* Danger Zone */}
                <Card className="p-6 border-destructive/50 bg-destructive/5">
                    <div className="mb-6 pb-4 border-b border-destructive/20">
                        <h2 className="text-xl font-semibold text-destructive flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Danger Zone
                        </h2>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <div className="font-medium text-destructive">Deactivate Account</div>
                                <p className="text-sm text-muted-foreground">Temporarily disable your account</p>
                            </div>
                            <Button variant="outline" className="w-36 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive gap-2">
                                <Power className="h-4 w-4" />
                                Deactivate
                            </Button>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <div className="font-medium text-destructive">Delete Account</div>
                                <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
                            </div>
                            <Button variant="destructive" className="w-36 gap-2 text-white">
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
