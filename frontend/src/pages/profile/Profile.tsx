import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, Pencil, Save, Shield, Calendar, BadgeCheck, Settings as SettingsIcon, Lock, User } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { getProfile, updateProfile } from '../../services/user.service';
import type { UserProfile } from '../../services/user.service';
import { profileUpdateSchema, type ProfileUpdateFormData } from '../../lib/validation/profile.schema';

export const Profile: React.FC = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [generalError, setGeneralError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const form = useForm<ProfileUpdateFormData>({
        resolver: zodResolver(profileUpdateSchema),
        defaultValues: {
            name: '',
            email: '',
            phone_number: ''
        },
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const data = await getProfile();
            setProfile(data);
            form.reset({
                name: data.name,
                email: data.email,
                phone_number: data.phone_number
            });
        } catch (err: any) {
            setGeneralError(err.response?.data?.message || 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: ProfileUpdateFormData) => {
        try {
            setGeneralError(null);
            setSuccess(null);
            await updateProfile(data);
            await fetchProfile();
            setSuccess('Profile updated successfully!');
            setEditing(false);
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setGeneralError(err.response?.data?.message || 'Failed to update profile');
        }
    };

    const handleCancel = () => {
        form.reset({
            name: profile?.name || '',
            email: profile?.email || '',
            phone_number: profile?.phone_number || ''
        });
        setEditing(false);
        setGeneralError(null);
    };

    if (loading) {
        return (
            <div className="container mx-auto p-4 md:p-8 max-w-[1200px] space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
                    <Skeleton className="h-96 rounded-xl" />
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-[1200px] space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">My Profile</h1>
                <p className="text-muted-foreground text-lg">Manage your personal information and account settings</p>
            </div>

            {generalError && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{generalError}</AlertDescription>
                </Alert>
            )}

            {success && (
                <Alert className="border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
                {/* Left: Profile Info */}
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            Personal Information
                        </h2>
                        {!editing && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditing(true)}
                                className="gap-2"
                            >
                                <Pencil className="h-4 w-4" />
                                Edit
                            </Button>
                        )}
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                disabled={!editing}
                                                className="bg-background"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email Address</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                {...field}
                                                disabled={!editing}
                                                className="bg-background"
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
                                                {...field}
                                                disabled={!editing}
                                                className="bg-background"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {editing && (
                                <div className="flex gap-4 justify-end pt-4 border-t">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleCancel}
                                        disabled={form.formState.isSubmitting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="default"
                                        disabled={form.formState.isSubmitting}
                                        className="gap-2"
                                    >
                                        <Save className="h-4 w-4" />
                                        {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </div>
                            )}
                        </form>
                    </Form>
                </Card>

                {/* Right: Account Info */}
                <Card className="p-6 flex flex-col h-fit">
                    <div className="mb-6 pb-4 border-b">
                        <h2 className="text-xl font-semibold">Account Details</h2>
                    </div>

                    <div className="space-y-6 mb-8">
                        <div className="flex gap-4 items-start">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Shield className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Role</div>
                                <div className="font-medium capitalize">{profile?.role}</div>
                            </div>
                        </div>

                        <div className="flex gap-4 items-start">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Calendar className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Member Since</div>
                                <div className="font-medium">
                                    {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    }) : 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 items-start">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <BadgeCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Account Status</div>
                                <div className={`font-medium ${profile?.is_active ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                                    {profile?.is_active ? 'Active' : 'Inactive'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-6 border-t space-y-3">
                        <h3 className="font-semibold text-sm mb-3">Quick Actions</h3>
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-2 h-auto py-2"
                            onClick={() => navigate('/settings')}
                        >
                            <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                            Account Settings
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-2 h-auto py-2"
                            onClick={() => navigate('/settings')}
                        >
                            <Lock className="h-4 w-4 text-muted-foreground" />
                            Change Password
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};
