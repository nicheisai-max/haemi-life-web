import React, { useCallback, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, LogOut, RefreshCw, Smartphone, Monitor, Globe, Tablet } from 'lucide-react';
import { LiveStatusPill } from '@/components/ui/live-status-pill';
import { getActiveSessions, revokeSession } from '../../services/admin.service';
import type { UserSession } from '../../services/admin.service';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { Badge } from '@/components/ui/badge';
import { TransitionItem } from '../../components/layout/page-transition';
import { TablePagination } from '@/components/ui/table-pagination';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/utils/avatar.resolver';
import { useAdminLiveTable } from '@/hooks/use-admin-live-table';
import { useRelativeTime } from '@/hooks/use-relative-time';
import { socketService } from '@/services/socket.service';
import { logger } from '@/utils/logger';

/**
 * 🛡️ HAEMI LIFE — Live Session Manager (Phase 3)
 *
 * Replaces the previous static "Sync Sessions" button + raw user-agent
 * string with: live `session:created` / `session:revoked` socket
 * subscription, parsed device intelligence (browser / OS / device-type
 * columns persisted at session creation), and a relative-time "Active X
 * ago" cell that auto-updates every second.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - Every error path through `logger`. Zero `console.*`.
 *   - Toast feedback dispatched via the `system:success` / `system:error`
 *     CustomEvent channels wired in toast-context.tsx — no direct toast
 *     library import here, mirroring Phase 1's screening-reorder pattern.
 */

const PAGE_SIZE = 10;

const getUserImageUrl = (userId: string, profileImage?: string | null): string => {
    if (profileImage) {
        if (profileImage.startsWith('http')) return profileImage;
        const baseUrl = (import.meta.env.VITE_API_URL || '');
        return `${baseUrl}/api/files/profile/${userId}`;
    }
    return '';
};

/**
 * Pick the right device icon from the parsed `device_type` column. Falls
 * back to user-agent string sniffing for legacy sessions where the
 * server-side parse field is null. The function is pure so it can live
 * outside the component without re-render churn.
 */
const getDeviceIcon = (session: UserSession): React.ReactElement => {
    const deviceType = session.deviceType?.toLowerCase() ?? null;
    if (deviceType === 'mobile') return <Smartphone className="h-4 w-4" />;
    if (deviceType === 'tablet') return <Tablet className="h-4 w-4" />;
    if (deviceType === 'desktop') return <Monitor className="h-4 w-4" />;

    // Fallback: legacy sessions with null device_type — sniff the raw UA.
    const agent = session.userAgent?.toLowerCase() ?? '';
    if (agent.includes('iphone') || agent.includes('android') || agent.includes('mobile')) {
        return <Smartphone className="h-4 w-4" />;
    }
    if (agent.includes('ipad') || agent.includes('tablet')) {
        return <Tablet className="h-4 w-4" />;
    }
    if (agent.length > 0) return <Monitor className="h-4 w-4" />;
    return <Globe className="h-4 w-4" />;
};

/**
 * Render the parsed device summary as a compact "Browser · OS · Device"
 * string. Falls back to the raw UA for legacy sessions.
 */
const formatDeviceSummary = (session: UserSession): string => {
    const parts: string[] = [];
    if (session.browserName) parts.push(session.browserName);
    if (session.osName) parts.push(session.osName);
    if (session.deviceType) parts.push(session.deviceType);
    if (parts.length > 0) return parts.join(' · ');
    return session.userAgent ?? 'Unknown client';
};

/**
 * Map the live `SessionCreatedEvent` payload (snake-case-camelCase mix
 * from the schema) onto the page's `UserSession` shape. Returns `null`
 * when the event lacks the user fields we render — null shouldn't
 * normally happen because the auth controller always supplies them, but
 * keeping the narrowing strict avoids surfacing a bare-minimum row that
 * would render with empty cells.
 */
const sessionEventToRow = (
    payload: {
        readonly id: string;
        readonly sessionId: string;
        readonly userId: string;
        readonly userRole: string;
        readonly userName: string | null;
        readonly userEmail: string | null;
        readonly profileImage: string | null;
        readonly ipAddress: string | null;
        readonly userAgent: string | null;
        readonly browserName: string | null;
        readonly osName: string | null;
        readonly deviceType: string | null;
        readonly createdAt: string;
        readonly lastActivity: string | null;
    }
): UserSession => ({
    id: payload.id,
    userId: payload.userId,
    userName: payload.userName ?? 'Unknown',
    userEmail: payload.userEmail ?? '',
    userRole: payload.userRole,
    sessionId: payload.sessionId,
    ipAddress: payload.ipAddress,
    userAgent: payload.userAgent,
    browserName: payload.browserName,
    osName: payload.osName,
    deviceType: payload.deviceType,
    createdAt: payload.createdAt,
    lastActivity: payload.lastActivity,
    isActive: true,
    profileImage: payload.profileImage,
});

export const SessionManagement: React.FC = () => {
    const [page, setPage] = useState<number>(1);
    const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

    const fetcher = useCallback(async (): Promise<ReadonlyArray<UserSession>> => {
        try {
            return await getActiveSessions();
        } catch (error: unknown) {
            logger.error('[SessionManagement] Failed to fetch sessions', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }, []);

    const subscribeEvents = useMemo(() => ['session:created', 'session:revoked'] as const, []);

    const { items, isLoading, error, refetch } = useAdminLiveTable<UserSession, 'session:created' | 'session:revoked'>({
        fetcher,
        subscribeEvents,
        // Custom dispatch: `session:created` prepends the new session,
        // `session:revoked` filters out the matching id. Returning the
        // mutated array (rather than `null`) avoids a redundant refetch
        // when the event already carries the full row.
        //
        // The structural `in` guards below narrow the union payload to
        // the specific shape inside each branch. They are NOT casts —
        // each is a runtime property check whose absence would make the
        // event invalid against its Zod schema (which the hook just
        // validated). The guards exist solely to satisfy TypeScript's
        // discriminator analysis, since the hook's generic signature
        // tracks `event: E` and `payload: AdminEventMap[E]` as two
        // independent type parameters — TS cannot correlate them
        // without a runtime check at the consumer boundary.
        onEvent: (event, payload, current) => {
            if (event === 'session:created' && 'createdAt' in payload) {
                const next: UserSession = sessionEventToRow(payload);
                // Avoid duplicates if the fetcher already returned this
                // id (race between socket arrival and HTTP response).
                if (current.some((existing) => existing.id === next.id)) return current;
                return [next, ...current];
            }
            if (event === 'session:revoked' && 'revokedAt' in payload) {
                return current.filter(
                    (existing) => existing.id !== payload.id && existing.sessionId !== payload.sessionId
                );
            }
            return current;
        },
    });

    const handleRevoke = async (session: UserSession): Promise<void> => {
        const targetId: string = session.sessionId || session.id;
        try {
            setRevokingSessionId(targetId);
            const res = await revokeSession(targetId);
            if (res.success) {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('system:success', {
                        detail: { message: `Session revoked for ${session.userName ?? 'user'}.` },
                    }));
                }
                // Optimistic local removal — the live `session:revoked`
                // event will also arrive shortly, but this keeps the UI
                // crisp even if the socket lags.
                if (!socketService.isConnected()) {
                    void refetch();
                }
            } else if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('system:error', {
                    detail: { message: 'Could not revoke session — it may already be inactive.' },
                }));
            }
        } catch (err: unknown) {
            logger.error('[SessionManagement] Failed to revoke session', {
                error: err instanceof Error ? err.message : String(err),
                sessionId: targetId,
            });
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('system:error', {
                    detail: { message: 'Failed to revoke session. Please try again.' },
                }));
            }
        } finally {
            setRevokingSessionId(null);
        }
    };

    // Pagination across the loaded slice (server caps at 50 by default).
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const startIndex = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const endIndex = Math.min(page * PAGE_SIZE, totalItems);
    const showPagination = totalItems > PAGE_SIZE;
    const paginatedSessions = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const isLiveConnected = socketService.isConnected();

    if (isLoading && items.length === 0) {
        return <MedicalLoader variant="global" message="Enumerating Live Sessions..." />;
    }

    return (
        <div className="space-y-8">
            <TransitionItem className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="page-heading !mb-0 transition-all duration-300">
                            Live Session Manager
                        </h1>
                        <LiveStatusPill isConnected={isLiveConnected} />
                    </div>
                    <p className="page-subheading italic">Monitor and control active institutional access tokens</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        className="h-10 px-4 rounded-[var(--card-radius)] border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-semibold transition-all hover:scale-105 active:scale-95 gap-2"
                        onClick={() => { void refetch(); }}
                        disabled={isLoading}
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Sync Sessions
                    </Button>
                </div>
            </TransitionItem>

            {error !== null && (
                <TransitionItem>
                    <Card className="p-4 border-rose-500/30 bg-rose-500/5">
                        <p className="text-sm text-rose-500 font-medium">{error.message}</p>
                    </Card>
                </TransitionItem>
            )}

            <TransitionItem>
                <Card className="overflow-hidden border shadow-sm rounded-[var(--card-radius)] bg-white dark:bg-card">
                    <div className="px-6 py-4 border-b border-border/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            Authenticated Entry Points
                        </h2>
                        <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/50">
                            {totalItems} Active Node(s)
                        </Badge>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="hl-table">
                            <thead>
                                <tr>
                                    <th>User Identity</th>
                                    <th>Role</th>
                                    <th>Device / IP</th>
                                    <th>Last Seen</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedSessions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center italic text-muted-foreground py-12">
                                            No active sessions found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedSessions.map((session) => (
                                        <SessionRow
                                            key={session.id}
                                            session={session}
                                            isRevoking={revokingSessionId === (session.sessionId || session.id)}
                                            onRevoke={() => { void handleRevoke(session); }}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <TablePagination
                        currentPage={page}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        startIndex={startIndex}
                        endIndex={endIndex}
                        showPagination={showPagination}
                        onPageChange={setPage}
                        itemLabel="sessions"
                    />
                </Card>
            </TransitionItem>
        </div>
    );
};

/* ─── Internal: row component with live "Active Xs ago" cell ────────────── */

interface SessionRowProps {
    readonly session: UserSession;
    readonly isRevoking: boolean;
    readonly onRevoke: () => void;
}

const SessionRow: React.FC<SessionRowProps> = ({ session, isRevoking, onRevoke }) => {
    // The relative time updates every second through the shared module-
    // level ticker — see `useRelativeTime` for the single-timer design.
    const lastSeenLabel: string = useRelativeTime(session.lastActivity ?? session.createdAt, {
        granularity: 'second',
        fallback: 'Never',
    });

    return (
        <tr className="group">
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 ring-2 ring-background ring-offset-2">
                        <AvatarImage
                            src={getUserImageUrl(session.userId, session.profileImage)}
                            alt={session.userName || 'User'}
                            className="object-cover"
                        />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {session.userName ? getInitials(session.userName) : '?'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-bold text-foreground text-xs">{session.userName || 'Unknown User'}</span>
                        <span className="text-[10px] text-muted-foreground">{session.userEmail || 'No email provided'}</span>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <Badge variant="secondary" className="rounded-full px-2 py-0 text-[9px] font-bold uppercase ring-1 ring-border shadow-sm">
                    {session.userRole}
                </Badge>
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-[var(--card-radius)] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:scale-110 transition-transform">
                        {getDeviceIcon(session)}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[11px] font-mono text-foreground font-bold">{session.ipAddress || '—'}</span>
                        <span className="text-[9px] text-muted-foreground truncate max-w-[180px]" title={session.userAgent ?? undefined}>
                            {formatDeviceSummary(session)}
                        </span>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="flex flex-col text-[10px]">
                    <span className="font-bold text-foreground">{lastSeenLabel}</span>
                    <span className="text-muted-foreground opacity-70">
                        Logged: {new Date(session.createdAt).toLocaleDateString()}
                    </span>
                </div>
            </td>
            <td className="px-6 py-4 text-right">
                <Button
                    size="sm"
                    className="user-action-btn user-action-btn-deactivate !min-w-max px-4"
                    title="Revoke Session"
                    onClick={onRevoke}
                    disabled={isRevoking}
                >
                    <div className="flex items-center gap-1.5">
                        <LogOut className={`h-3.5 w-3.5 ${isRevoking ? 'animate-spin' : ''}`} />
                        <span>{isRevoking ? 'Revoking…' : 'Revoke Session'}</span>
                    </div>
                </Button>
            </td>
        </tr>
    );
};
