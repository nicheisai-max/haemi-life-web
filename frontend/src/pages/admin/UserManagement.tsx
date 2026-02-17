import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { getAllUsers, updateUserStatus } from '../../services/admin.service';
import type { UserListItem } from '../../services/admin.service';
import { Search, Users, AlertCircle, X, Shield, ShieldAlert, Heart, Stethoscope, Briefcase, Mail } from 'lucide-react';
import { Loader } from '@/components/ui/Loader';

export const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<UserListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [searchTerm, roleFilter, users]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await getAllUsers();
            setUsers(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = users;

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(user =>
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                user.phone_number.includes(searchTerm)
            );
        }

        // Role filter
        if (roleFilter !== 'all') {
            filtered = filtered.filter(user => user.role === roleFilter);
        }

        setFilteredUsers(filtered);
    };

    const handleToggleStatus = async (userId: number, currentStatus: boolean) => {
        try {
            setProcessing(userId);
            // Service expects (id, is_active)
            await updateUserStatus(userId, !currentStatus);
            await fetchUsers();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to update user status');
        } finally {
            setProcessing(null);
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'doctor': return <Stethoscope className="h-4 w-4 mr-2" />;
            case 'patient': return <Heart className="h-4 w-4 mr-2" />;
            case 'pharmacist': return <Briefcase className="h-4 w-4 mr-2" />;
            case 'admin': return <Shield className="h-4 w-4 mr-2" />;
            default: return <Users className="h-4 w-4 mr-2" />;
        }
    };

    const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" | null | undefined => {
        switch (role) {
            case 'admin': return 'destructive';
            case 'doctor': return 'default';
            case 'pharmacist': return 'secondary';
            default: return 'outline';
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <Loader size="lg" />
            </div>
        );
    }

    return (            <div className="max-w-[1400px] mx-auto p-6 md:p-8 space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                        <p className="text-muted-foreground mt-1">Manage user accounts and permissions</p>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4">
                        <Card className="px-4 py-2 flex flex-col items-center justify-center min-w-[100px]">
                            <span className="text-2xl font-bold text-primary leading-none">{users.length}</span>
                            <span className="text-xs text-muted-foreground font-medium mt-1">Total Users</span>
                        </Card>
                        <Card className="px-4 py-2 flex flex-col items-center justify-center min-w-[100px]">
                            <span className="text-2xl font-bold text-green-600 leading-none">{users.filter(u => u.is_active).length}</span>
                            <span className="text-xs text-muted-foreground font-medium mt-1">Active</span>
                        </Card>
                    </div>
                </div>

                {error && (
                    <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md flex items-center gap-2 border border-destructive/20">
                        <AlertCircle className="h-5 w-5" />
                        <span className="flex-1">{error}</span>
                        <button onClick={() => setError(null)} className="hover:bg-destructive/10 p-1 rounded">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Filters */}
                <Card className="p-4 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search by name, email, or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-10"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['all', 'patient', 'doctor', 'admin', 'pharmacist'].map(role => (
                            <button
                                key={role}
                                onClick={() => setRoleFilter(role)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${roleFilter === role
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground'
                                    }`}
                            >
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                            </button>
                        ))}
                    </div>
                </Card>

                {/* Users Table */}
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[300px]">User</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                                    <TableHead className="hidden md:table-cell">Joined</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No users found matching your filters
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map(user => (
                                        <TableRow key={user.id} className="hover:bg-muted/50">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                                                        {user.name?.charAt(0).toUpperCase() || 'U'}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-foreground">{user.name || 'Unknown'}</span>
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Mail className="h-3 w-3" />
                                                            {user.email || 'No email'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize pl-2 pr-3 py-1">
                                                    {getRoleIcon(user.role)}
                                                    {user.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-muted-foreground font-mono text-sm">
                                                {user.phone_number}
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={user.is_active ? "outline" : "destructive"} className={user.is_active ? "text-green-600 border-green-600 bg-green-50 dark:bg-green-900/20" : ""}>
                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant={user.is_active ? "ghost" : "default"}
                                                    className={user.is_active ? "text-destructive hover:text-destructive hover:bg-destructive/10" : "bg-green-600 hover:bg-green-700"}
                                                    onClick={() => handleToggleStatus(user.id, user.is_active)}
                                                    disabled={processing === user.id}
                                                >
                                                    {processing === user.id ? (
                                                        <Loader size="xs" className="mr-2" />
                                                    ) : user.is_active ? (
                                                        <ShieldAlert className="h-4 w-4 mr-2" />
                                                    ) : (
                                                        <Shield className="h-4 w-4 mr-2" />
                                                    )}
                                                    {user.is_active ? 'Deactivate' : 'Activate'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>    );
};
