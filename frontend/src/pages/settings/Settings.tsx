import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../context/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle2, User, Mail, Phone, Shield, Pencil, Lock, Bell, MessageSquare, Megaphone, Trash2, Power } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { changePassword } from '../../services/user.service';
import { changePasswordSchema, type ChangePasswordFormData } from '../../lib/validation/auth.schema';
import { preferencesSchema, type PreferencesFormData } from '../../lib/validation/preferences.schema';

export const Settings: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [generalError, setGeneralError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const form = useForm<ChangePasswordFormData>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: {
            current_password: '',
            new_password: '',
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
                current_password: data.current_password,
                new_password: data.new_password
            });

            setSuccess('Password changed successfully!');
            form.reset();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setGeneralError(err.response?.data?.message || 'Failed to change password');
        }
    };

    const onPrefSubmit = async (data: PreferencesFormData) => {
        try {
            setGeneralError(null);
            setSuccess(null);
            // Simulate API call
            console.log('Saving preferences:', data);
            setSuccess('Preferences updated successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setGeneralError('Failed to update preferences');
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-[1200px] space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Settings</h1>
                <p className="text-muted-foreground text-lg">Manage your account preferences and security settings</p>
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
                                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Name</div>
                                <div className="font-medium">{user?.name}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Mail className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Email</div>
                                <div className="font-medium">{user?.email}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Phone className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Phone</div>
                                <div className="font-medium">{user?.phone_number}</div>
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
                        variant="outline"
                        className="w-full mt-8 gap-2"
                        onClick={() => navigate('/profile')}
                    >
                        <Pencil className="h-4 w-4" />
                        Edit Profile
                    </Button>
                </Card>

                {/* Change Password */}
                <Card className="p-6 h-full flex flex-col">
                    <div className="mb-6 pb-4 border-b">
                        <h2 className="text-xl font-semibold">Change Password</h2>
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmitPassword)} className="space-y-4 flex-1">
                            <FormField
                                control={form.control}
                                name="current_password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Current Password</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder="Enter current password"
                                                {...field}
                                                className="bg-background"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="new_password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Password</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder="Enter new password"
                                                {...field}
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
                                    variant="default"
                                    className="w-full gap-2"
                                    disabled={form.formState.isSubmitting}
                                >
                                    <Lock className="h-4 w-4" />
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
                        <form onSubmit={prefForm.handleSubmit(onPrefSubmit)} className="space-y-6">
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
                                variant="outline"
                                className="w-full mt-4"
                                disabled={prefForm.formState.isSubmitting}
                            >
                                {prefForm.formState.isSubmitting ? 'Saving...' : 'Save Preferences'}
                            </Button>
                        </form>
                    </Form>
                </Card>

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
                            <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive gap-2">
                                <Power className="h-4 w-4" />
                                Deactivate
                            </Button>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <div className="font-medium text-destructive">Delete Account</div>
                                <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
                            </div>
                            <Button variant="destructive" className="gap-2">
                                <Trash2 className="h-4 w-4" />
                                Delete Account
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
