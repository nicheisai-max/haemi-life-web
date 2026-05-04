import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/utils/avatar.resolver';
import { useConfirm } from '@/hooks/use-confirm';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAllUsers, updateUserStatus, getSystemStats } from '../../services/admin.service';
import type { UserListItem, SystemStats, PaginatedResponse } from '../../services/admin.service';
import { Search, Users, AlertCircle, X, Shield, ShieldAlert, Heart, Stethoscope, Briefcase, Mail, CheckCircle2, CircleOff, Filter } from 'lucide-react';
import { LiveStatusPill } from '@/components/ui/live-status-pill';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { PremiumLoader } from '@/components/ui/premium-loader';
import { TablePagination } from '@/components/ui/table-pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminLiveTable } from '@/hooks/use-admin-live-table';
import { useRelativeTime } from '@/hooks/use-relative-time';
import { socketService } from '@/services/socket.service';
import { logger } from '../../utils/logger';

/**
 * 🛡️ HAEMI LIFE — User Management (Phase 4: live + last_activity)
 *
 * Replaces the previous static manual-fetch pattern with: live
 * `user:registered` / `user:status_changed` socket subscription, a new
 * "Last Seen" column powered by `useRelativeTime` (auto-updates every
 * 30 seconds), and a brief highlight animation when a freshly-
 * registered user appears at the top of the list.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - Multi-event union payloads narrowed via structural `'createdAt' in payload`
 *     guards (NOT casts) — runtime invariant is the Zod parse already
 *     validated for each branch.
 *   - All errors via `logger`. Toast feedback dispatched through the
 *     symmetric `system:success` / `system:error` CustomEvent channels
 *     (mirrors Phase 1 / 3 patterns).
 */

const PAGE_SIZE = 10;
const NEW_ROW_HIGHLIGHT_MS = 4_000;

type RoleFilter = 'all' | 'patient' | 'doctor' | 'admin' | 'pharmacist';
type StatusFilter = 'all' | 'active' | 'inactive';

const ROLE_FILTER_OPTIONS: ReadonlyArray<RoleFilter> = ['all', 'patient', 'doctor', 'admin', 'pharmacist'];
const STATUS_FILTER_OPTIONS: ReadonlyArray<StatusFilter> = ['all', 'active', 'inactive'];

/**
 * Convert an incoming `user:registered` event payload onto the page's
 * `UserListItem` shape. Returns the fields the table renders, defaulting
 * the ones that are not present on a fresh registration (`phoneNumber`
 * cannot be transmitted unencrypted, `initials` is server-computed but
 * may be null on the wire — we fall back to a runtime initials helper
 * downstream).
 */
const userEventToListItem = (
    payload: {
        readonly id: string;
        readonly name: string;
        readonly email: string | null;
        readonly phoneNumber: string | null;
        readonly role: string;
        readonly status: string;
        readonly initials: string | null;
        readonly profileImage: string | null;
        readonly createdAt: string;
        readonly lastActivity: string | null;
    }
): UserListItem => ({
    id: payload.id,
    name: payload.name,
    email: payload.email ?? '',
    phoneNumber: payload.phoneNumber ?? '',
    role: payload.role,
    status: payload.status,
    initials: payload.initials ?? undefined,
    profileImage: payload.profileImage,
    createdAt: payload.createdAt,
    lastActivity: payload.lastActivity,
});

export const UserManagement: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [debouncedSearch, setDebouncedSearch] = useState<string>('');
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalItems, setTotalItems] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);
    /**
     * IDs of rows that arrived live (rather than via the initial fetch).
     * Used to apply a brief highlight class so admins notice the new
     * user. Each id auto-clears after `NEW_ROW_HIGHLIGHT_MS` so the
     * effect is transient — not a permanent visual indicator.
     */
    const [highlightedRowIds, setHighlightedRowIds] = useState<ReadonlySet<string>>(() => new Set());
    const { confirm } = useConfirm();

    // Debounce search to avoid one fetch per keystroke. Resets to page 1
    // on filter change so the user sees the first page of the new
    // result set.
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetcher = useCallback(async (): Promise<ReadonlyArray<UserListItem>> => {
        try {
            logger.debug('[Admin] Fetching users page', {
                page: currentPage,
                role: roleFilter,
                status: statusFilter,
                search: debouncedSearch
            });
            const [data, statsData] = await Promise.all([
                getAllUsers({
                    page: currentPage,
                    limit: PAGE_SIZE,
                    role: roleFilter,
                    status: statusFilter,
                    search: debouncedSearch
                }),
                getSystemStats()
            ]);
            setTotalItems(data.pagination.total);
            setTotalPages(data.pagination.totalPages);
            setStats(statsData);
            return data.users;
        } catch (error: unknown) {
            logger.error('[Admin] User fetch failed', {
                error: error instanceof Error ? error.message : String(error),
                page: currentPage,
                role: roleFilter,
                status: statusFilter,
                search: debouncedSearch,
            });
            throw error;
        }
    }, [currentPage, roleFilter, statusFilter, debouncedSearch]);

    const subscribeEvents = useMemo(
        () => ['user:registered', 'user:status_changed'] as const,
        []
    );

    const { items, isLoading, error, refetch } = useAdminLiveTable<
        UserListItem,
        'user:registered' | 'user:status_changed'
    >({
        fetcher,
        subscribeEvents,
        // Custom dispatch for both events. The structural `in payload`
        // guards narrow the union without casts — runtime invariant is
        // that Zod already validated each branch's shape.
        onEvent: (event, payload, current) => {
            if (event === 'user:registered' && 'createdAt' in payload) {
                // Only prepend if we are on page 1 and the new row would
                // pass the active filters. Otherwise the new row may not
                // belong on the visible page; let the next refetch
                // reconcile.
                if (currentPage !== 1) return current;
                const matchesRole = roleFilter === 'all' || payload.role === roleFilter;
                const matchesStatus = statusFilter === 'all'
                    || (statusFilter === 'active' && payload.status === 'ACTIVE')
                    || (statusFilter === 'inactive' && payload.status !== 'ACTIVE');
                if (!matchesRole || !matchesStatus) return current;

                // Avoid duplicate keys if the fetcher already returned
                // this id (race between socket arrival and HTTP
                // response).
                if (current.some((existing) => existing.id === payload.id)) return current;

                const next: UserListItem = userEventToListItem(payload);

                // Briefly highlight the freshly-arrived row so admins
                // notice it. The id is auto-cleared from the set after
                // `NEW_ROW_HIGHLIGHT_MS` via a separate effect (see
                // `useEffect` below).
                setHighlightedRowIds((prev) => {
                    const updated = new Set(prev);
                    updated.add(next.id);
                    return updated;
                });
                setTotalItems((prev) => prev + 1);

                // Trim to page size so the visible slice stays
                // consistent. The trimmed row will still appear when the
                // user paginates.
                return [next, ...current].slice(0, PAGE_SIZE);
            }

            if (event === 'user:status_changed' && 'previousStatus' in payload) {
                // Update the matching row in-place. Refresh stats only
                // if the active/inactive count would shift (i.e. the
                // status crossed the ACTIVE / not-ACTIVE boundary).
                let shifted = false;
                const next: UserListItem[] = current.map((existing) => {
                    if (existing.id !== payload.userId) return existing;
                    if (existing.status !== payload.newStatus) shifted = true;
                    return { ...existing, status: payload.newStatus };
                });
                if (shifted && stats !== null) {
                    // Optimistic stats adjustment — exact +1 / -1 on
                    // `activeUsers`. The next fetcher tick will reconcile
                    // any drift.
                    const becameActive = payload.newStatus === 'ACTIVE' && payload.previousStatus !== 'ACTIVE';
                    const becameInactive = payload.previousStatus === 'ACTIVE' && payload.newStatus !== 'ACTIVE';
                    if (becameActive) setStats({ ...stats, activeUsers: stats.activeUsers + 1 });
                    if (becameInactive) setStats({ ...stats, activeUsers: Math.max(0, stats.activeUsers - 1) });
                }
                return next;
            }

            return current;
        },
    });

    // Auto-clear highlight ids after the configured window so the
    // visual cue is transient. Each highlight id has its own timeout —
    // intentional, because batched user:registered events should each
    // get the full visual lifetime, not a shared one.
    useEffect(() => {
        if (highlightedRowIds.size === 0) return;
        const timeouts: Array<ReturnType<typeof setTimeout>> = [];
        for (const id of highlightedRowIds) {
            const timeoutId = setTimeout(() => {
                setHighlightedRowIds((prev) => {
                    if (!prev.has(id)) return prev;
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }, NEW_ROW_HIGHLIGHT_MS);
            timeouts.push(timeoutId);
        }
        return () => {
            for (const t of timeouts) clearTimeout(t);
        };
    }, [highlightedRowIds]);

    const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const endIndex = Math.min(currentPage * PAGE_SIZE, totalItems);
    const showPagination = totalItems > PAGE_SIZE;
    const isLiveConnected = socketService.isConnected();

    const handleToggleStatus = async (userId: string, currentActive: boolean, userName: string): Promise<void> => {
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
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('system:success', {
                            detail: {
                                message: `${userName} ${currentActive ? 'deactivated' : 'activated'}.`,
                            },
                        }));
                    }
                    // The live `user:status_changed` event will update the
                    // row in place; refetch only if the socket is down.
                    if (!socketService.isConnected()) {
                        void refetch();
                    }
                } catch (err: unknown) {
                    logger.error('[Admin] Status update failed', {
                        userId,
                        error: err instanceof Error ? err.message : String(err),
                    });
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('system:error', {
                            detail: { message: 'Failed to update user status. Please try again.' },
                        }));
                    }
                } finally {
                    setProcessing(null);
                }
            }
        });
    };

    if (isLoading && items.length === 0) {
        return <MedicalLoader message="Retrieving user database..." />;
    }

    return (<div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="page-heading !mb-0 transition-all duration-300">User Management</h1>
                    <LiveStatusPill isConnected={isLiveConnected} />
                </div>
                <p className="page-subheading italic">Manage user accounts and permissions</p>
            </div>

            <div className="flex gap-4 items-stretch">
                <Card className="px-4 py-2 flex flex-col items-center justify-center min-w-[100px]">
                    <span className="text-2xl font-bold text-primary leading-none">{totalItems}</span>
                    <span className="text-xs text-muted-foreground font-medium mt-1">Total Users</span>
                </Card>
                <Card className="px-4 py-2 flex flex-col items-center justify-center w-24">
                    <span className="text-2xl font-bold text-green-600 leading-none">{stats?.activeUsers ?? 0}</span>
                    <span className="text-xs text-muted-foreground font-medium mt-1">Active</span>
                </Card>
            </div>
        </div>

        {error !== null && (
            <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md flex items-center gap-2 border border-destructive/20">
                <AlertCircle className="h-5 w-5" />
                <span className="flex-1">{error.message}</span>
                <button onClick={() => { void refetch(); }} className="hover:bg-destructive/10 p-1 rounded text-xs font-bold">
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
                {ROLE_FILTER_OPTIONS.map(role => (
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
                {STATUS_FILTER_OPTIONS.map(status => (
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
                            <TableHead className="hidden lg:table-cell">Last Seen</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-left">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    No users found matching your filters
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map(user => (
                                <UserRow
                                    key={user.id}
                                    user={user}
                                    isProcessing={processing === user.id}
                                    isHighlighted={highlightedRowIds.has(user.id)}
                                    onToggleStatus={() => { void handleToggleStatus(user.id, user.status === 'ACTIVE', user.name); }}
                                />
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

/* ─── Internal: row component with live "Last Seen" cell ──────────────── */

interface UserRowProps {
    readonly user: UserListItem;
    readonly isProcessing: boolean;
    readonly isHighlighted: boolean;
    readonly onToggleStatus: () => void;
}

const getRoleIcon = (role: string): React.ReactElement => {
    switch (role) {
        case 'doctor': return <Stethoscope className="h-4 w-4 mr-2" />;
        case 'patient': return <Heart className="h-4 w-4 mr-2" />;
        case 'pharmacist': return <Briefcase className="h-4 w-4 mr-2" />;
        case 'admin': return <Shield className="h-4 w-4 mr-2" />;
        default: return <Users className="h-4 w-4 mr-2" />;
    }
};

const getRoleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (role) {
        case 'admin': return 'destructive';
        case 'doctor': return 'default';
        case 'pharmacist': return 'secondary';
        default: return 'outline';
    }
};

const getUserImageUrl = (user: UserListItem): string => {
    if (user.profileImage) {
        if (user.profileImage.startsWith('http')) return user.profileImage;
        const baseUrl = (import.meta.env.VITE_API_URL || '');
        return `${baseUrl}/api/files/profile/${user.id}`;
    }
    return '';
};

const UserRow: React.FC<UserRowProps> = ({ user, isProcessing, isHighlighted, onToggleStatus }) => {
    // The relative-time hook auto-updates every 30 seconds via the
    // shared module-level ticker — see `use-relative-time.ts` for the
    // single-timer design.
    const lastSeenLabel: string = useRelativeTime(user.lastActivity, {
        granularity: 'minute',
        fallback: 'Never',
    });

    return (
        <TableRow
            className={`hover:bg-muted/50 transition-colors duration-700 ${isHighlighted ? 'bg-primary/5 ring-1 ring-primary/30' : ''}`}
        >
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
                {user.phoneNumber || '—'}
            </TableCell>
            <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                {new Date(user.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell className="hidden lg:table-cell text-muted-foreground text-sm" title={user.lastActivity ?? 'Never seen'}>
                {lastSeenLabel}
            </TableCell>
            <TableCell>
                <Badge variant={user.status === 'ACTIVE' ? 'outline' : 'destructive'} className={user.status === 'ACTIVE' ? 'text-green-500 border-green-500/30 bg-green-500/10' : ''}>
                    {user.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                </Badge>
            </TableCell>
            <TableCell className="text-left">
                <Button
                    size="sm"
                    className={user.status === 'ACTIVE'
                        ? 'user-action-btn user-action-btn-deactivate'
                        : 'user-action-btn user-action-btn-activate'
                    }
                    onClick={onToggleStatus}
                    disabled={isProcessing}
                >
                    {isProcessing ? (
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
    );
};

// Re-export of imported type for downstream consumers if needed.
export type { PaginatedResponse };
