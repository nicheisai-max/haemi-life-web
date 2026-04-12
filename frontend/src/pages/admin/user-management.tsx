import React, { useState, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/utils/avatar.resolver';
import { useConfirm } from '@/hooks/use-confirm';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAllUsers, updateUserStatus } from '../../services/admin.service';
import type { UserListItem } from '../../services/admin.service';
import { Search, Users, AlertCircle, X, Shield, ShieldAlert, Heart, Stethoscope, Briefcase, Mail, CheckCircle2, CircleOff, Filter } from 'lucide-react';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { PremiumLoader } from '@/components/ui/premium-loader';
import { getErrorMessage } from '../../lib/error';
import { usePagination } from '@/hooks/use-pagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<UserListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const { confirm } = useConfirm();

    // Must be called unconditionally before any early returns — React Rules of Hooks.
    const {
        currentPage,
        setCurrentPage,
        resetPage,
        totalPages,
        paginatedData: paginatedUsers,
        showPagination,
        totalItems,
        startIndex,
        endIndex,
    } = usePagination(filteredUsers);

    const applyFilters = useCallback(() => {
        let filtered = users;

        if (searchTerm) {
            filtered = filtered.filter(user =>
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                user.phoneNumber.includes(searchTerm)
            );
        }

        if (roleFilter !== 'all') {
            filtered = filtered.filter(user => user.role === roleFilter);
        }

        if (statusFilter !== 'all') {
            const isActive = statusFilter === 'active';
            filtered = filtered.filter(user => (user.status === 'ACTIVE') === isActive);
        }

        setFilteredUsers(filtered);
    }, [users, searchTerm, roleFilter, statusFilter]);

    // Reset to page 1 whenever any filter changes. resetPage is stable (see usePagination).
    useEffect(() => {
        resetPage();
    }, [searchTerm, roleFilter, statusFilter, resetPage]);

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [searchTerm, roleFilter, statusFilter, users, applyFilters]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await getAllUsers();
            setUsers(data);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load users'));
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (userId: string, currentActive: boolean, userName: string) => {
        const action = currentActive ? 'deactivate' : 'activate';
        const newStatus = currentActive ? 'INACTIVE' : 'ACTIVE';

        await confirm({
            title: `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
            message: `Are you sure you want to ${action} ${userName}? ${currentActive ? 'They will lose access immediately.' : 'They will regain access.'}`,
            type: currentActive ? 'error' : 'warning',
            confirmText: `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
            cancelText: 'Cancel',
            onAsyncConfirm: async () => {
                try {
                    setProcessing(userId);
                    await updateUserStatus(userId, newStatus);
                    await fetchUsers();
                } catch (err: unknown) {
                    setError(getErrorMessage(err, 'Failed to update user status'));
                } finally {
                    setProcessing(null);
                }
            }
        });
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

    const getUserImageUrl = (user: UserListItem) => {
        if (user.profileImage) {
            if (user.profileImage.startsWith('http')) return user.profileImage;
            const baseUrl = (import.meta.env.VITE_API_URL || '');
            return `${baseUrl}/api/files/profile/${user.id}`;
        }
        return '';
    };

    if (loading) {
        return <MedicalLoader message="Retrieving user database..." />;
    }

    return (<div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="page-heading !mb-0 transition-all duration-300">User Management</h1>
                <p className="page-subheading italic">Manage user accounts and permissions</p>
            </div>

            {/* Stats */}
            <div className="flex gap-4">
                <Card className="px-4 py-2 flex flex-col items-center justify-center min-w-[100px]">
                    <span className="text-2xl font-bold text-primary leading-none">{users.length}</span>
                    <span className="text-xs text-muted-foreground font-medium mt-1">Total Users</span>
                </Card>
                <Card className="px-4 py-2 flex flex-col items-center justify-center w-24">
                    <span className="text-2xl font-bold text-green-600 leading-none">{users.filter(u => u.status === 'ACTIVE').length}</span>
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Search by name, email, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 border-none bg-muted/30 focus-visible:bg-muted/50 transition-all shadow-inner"
                />
            </div>
            <div className="flex flex-wrap gap-2">
                {['all', 'patient', 'doctor', 'admin', 'pharmacist'].map(role => (
                    <button
                        key={role}
                        onClick={() => setRoleFilter(role)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${roleFilter === role
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.05]'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                    >
                        {role === 'all' && <Users className="h-3.5 w-3.5" />}
                        {role === 'patient' && <Heart className="h-3.5 w-3.5" />}
                        {role === 'doctor' && <Stethoscope className="h-3.5 w-3.5" />}
                        {role === 'admin' && <Shield className="h-3.5 w-3.5" />}
                        {role === 'pharmacist' && <Briefcase className="h-3.5 w-3.5" />}
                        <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-3 border-t">
                <div className="flex items-center text-sm text-muted-foreground mr-2 font-medium">
                    <Filter className="h-3.5 w-3.5 mr-1.5" />
                    Status:
                </div>
                {(['all', 'active', 'inactive'] as const).map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${statusFilter === status
                            ? 'bg-secondary text-secondary-foreground shadow-md scale-[1.05]'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                    >
                        {status === 'all' && <Users className="h-3.5 w-3.5" />}
                        {status === 'active' && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {status === 'inactive' && <CircleOff className="h-3.5 w-3.5" />}
                        <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    </button>
                ))}
            </div>
        </Card>

        {/* Users Table */}
        <Card className="overflow-hidden">
            <div className="hl-table-container">
                <Table className="hl-table">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[18.75rem]">User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="hidden md:table-cell">Contact</TableHead>
                            <TableHead className="hidden md:table-cell">Joined</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-left">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedUsers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No users found matching your filters
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedUsers.map(user => (
                                <TableRow key={user.id} className="hover:bg-muted/50">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage src={getUserImageUrl(user)} alt={user.name} className="object-cover" />
                                                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                                                    {user.name ? getInitials(user.name) : 'U'}
                                                </AvatarFallback>
                                            </Avatar>
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
                                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                                        {user.phoneNumber}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={user.status === 'ACTIVE' ? "outline" : "destructive"} className={user.status === 'ACTIVE' ? "text-green-500 border-green-500/30 bg-green-500/10" : ""}>
                                            {user.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-left">
                                        <Button
                                            size="sm"
                                            className={user.status === 'ACTIVE'
                                                ? "user-action-btn user-action-btn-deactivate"
                                                : "user-action-btn user-action-btn-activate"
                                            }
                                            onClick={() => handleToggleStatus(user.id, user.status === 'ACTIVE', user.name)}
                                            disabled={processing === user.id}
                                        >
                                            {processing === user.id ? (
                                                <PremiumLoader size="xs" bubbleClassName="bg-white" />
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    {user.status === 'ACTIVE' ? (
                                                        <ShieldAlert className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <Shield className="h-3.5 w-3.5" />
                                                    )}
                                                    <span>{user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                                                </div>
                                            )}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                startIndex={startIndex}
                endIndex={endIndex}
                showPagination={showPagination}
                onPageChange={setCurrentPage}
                itemLabel="users"
            />
        </Card>
    </div>);
};
