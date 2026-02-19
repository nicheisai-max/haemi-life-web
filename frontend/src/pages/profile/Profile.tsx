import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, Pencil, Save, Shield, Calendar, BadgeCheck, Settings as SettingsIcon, Lock, User, Camera, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { getProfile, updateProfile, uploadProfileImage } from '../../services/user.service';
import type { UserProfile } from '../../services/user.service';
import { profileUpdateSchema, type ProfileUpdateFormData } from '../../lib/validation/profile.schema';
import { useAuth } from '../../context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


export const Profile: React.FC = () => {
    const navigate = useNavigate();
    const { refreshUser } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
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

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            setGeneralError(null);
            await uploadProfileImage(file);
            await refreshUser(); // Refresh auth state
            await fetchProfile(); // Refresh local profile state
            setSuccess('Profile image updated successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            console.error('[Profile] Upload error:', err.response?.data);
            const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to upload image';
            setGeneralError(errorMsg);
        } finally {
            setUploading(false);
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
        <div className="container mx-auto p-4 md:p-8 max-w-[1200px] space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">My Profile</h1>
                <p className="text-muted-foreground text-lg">Manage your personal information and account settings</p>
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

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
                {/* Left: Profile Info */}
                <Card className="p-6">
                    <div className="flex flex-col md:flex-row items-center gap-6 mb-8 pb-6 border-b">
                        <div className="relative group">
                            <Avatar className="h-24 w-24 ring-4 ring-background shadow-lg border">
                                <AvatarImage
                                    src={profile?.id ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/files/profile/${profile.id}` : ''}

                                    alt={profile?.name}
                                />
                                <AvatarFallback className="bg-primary/5 text-primary text-2xl font-bold">
                                    {profile?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || <User />}
                                </AvatarFallback>
                            </Avatar>
                            <label
                                htmlFor="avatar-upload"
                                className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full cursor-pointer shadow-md hover:scale-110 transition-transform duration-200 ring-2 ring-background"
                            >
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                                <input
                                    id="avatar-upload"
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    disabled={uploading}
                                />
                            </label>
                        </div>
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl font-bold mb-1">{profile?.name}</h2>
                            <p className="text-muted-foreground flex items-center justify-center md:justify-start gap-2">
                                <Shield className="h-4 w-4" />
                                <span className="capitalize">{profile?.role}</span>
                            </p>
                        </div>
                        {!editing && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditing(true)}
                                className="md:ml-auto gap-2"
                            >
                                <Pencil className="h-4 w-4" />
                                Edit Basic Info
                            </Button>
                        )}
                    </div>

                    <div className="mb-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Personal Details</h3>
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
                                                maxLength={8}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                                                    field.onChange(value);
                                                }}
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
