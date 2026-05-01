import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Monitor, RefreshCw, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getAuditLogs } from '../../services/admin.service';
import type { AuditLog } from '../../services/admin.service';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { getErrorMessage } from '../../lib/error';
import { usePagination } from '@/hooks/use-pagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { isObject } from '../../utils/type-guards';
import { getInitials, getProfileImageUrl } from '../../utils/avatar.resolver';

export const SystemLogs: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const data = await getAuditLogs();
            setLogs(data);
        } catch (err: unknown) {
            console.error("Failed to fetch logs:", getErrorMessage(err));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchLogs();
    };

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.userName && log.userName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Must be called unconditionally before any early returns — React Rules of Hooks.
    const {
        currentPage,
        setCurrentPage,
        resetPage,
        totalPages,
        paginatedData: paginatedLogs,
        showPagination,
        totalItems,
        startIndex,
        endIndex,
    } = usePagination(filteredLogs);

    // resetPage is stable (useCallback with no deps) — safe in event handlers.
    const handleSearch = (value: string) => {
        setSearchTerm(value);
        resetPage();
    };

    const getActionColor = (action: string) => {
        if (action.includes('LOGIN')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
        if (action.includes('UPDATE')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
        if (action.includes('DELETE') || action.includes('FAIL')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
        if (action.includes('CREATE')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400';
    };

    /**
     * Renders an audit-log `details` payload into a human-readable summary.
     *
     * The backend column is `JSONB` and the `pg` driver auto-deserialises
     * it into a structured JS value, so what we receive can be any
     * combination of primitives, arrays, or nested objects depending on
     * the action that produced the entry. The previous implementation
     * naïvely template-stringed each top-level value, which produced the
     * `[object Object]` rendering whenever a writer (e.g. screening
     * `metadata: { changes: data }`) included a nested object.
     *
     * Bounded depth + bounded list length protect against degenerate or
     * unexpectedly large payloads becoming UI hazards.
     */
    const AUDIT_DETAIL_MAX_DEPTH = 3;
    const AUDIT_DETAIL_MAX_LIST = 5;

    const humanizeKey = (key: string): string =>
        key
            .replace(/[_-]/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^./, (s) => s.toUpperCase());

    const formatScalar = (val: unknown): string => {
        if (val === null || val === undefined) return '—';
        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        if (typeof val === 'number' || typeof val === 'bigint') return String(val);
        if (typeof val === 'string') return val;
        return '';
    };

    const formatValue = (val: unknown, depth: number = 0): string => {
        if (depth >= AUDIT_DETAIL_MAX_DEPTH) return '…';
        if (val === null || val === undefined) return '—';
        if (typeof val !== 'object') return formatScalar(val);

        if (Array.isArray(val)) {
            const head = val
                .slice(0, AUDIT_DETAIL_MAX_LIST)
                .map((x) => formatValue(x, depth + 1))
                .join(', ');
            return val.length > AUDIT_DETAIL_MAX_LIST
                ? `${head}, +${val.length - AUDIT_DETAIL_MAX_LIST} more`
                : head;
        }

        // `isObject` narrows `unknown` to `Record<string, unknown>` via a
        // user-defined type predicate — no `as` cast needed. The runtime
        // checks (typeof + null + !Array) live inside the predicate so the
        // narrowing and the assertion can never drift apart.
        if (!isObject(val)) return '';
        const entries = Object.entries(val);
        if (entries.length === 0) return '—';
        return entries
            .map(([k, v]) => `${humanizeKey(k)}: ${formatValue(v, depth + 1)}`)
            .join(', ');
    };

    const renderLogDetails = (log: AuditLog): string => {
        if (!log.details) return 'System event record';

        // `isObject` consolidates the typeof + null + !Array runtime checks
        // and narrows the type in one step — eliminates trust-me casts at
        // both branches and keeps this file in lock-step with the project's
        // shared predicate vocabulary (see frontend/src/utils/type-guards.ts).
        let details: Record<string, unknown> = {};
        if (typeof log.details === 'string') {
            try {
                const parsed: unknown = JSON.parse(log.details);
                if (isObject(parsed)) {
                    details = parsed;
                } else {
                    return log.details;
                }
            } catch {
                return log.details;
            }
        } else if (isObject(log.details)) {
            details = log.details;
        }

        if (Object.keys(details).length === 0) return 'System event record';

        // Semantic mapping for known institutional actions — these read better
        // as bespoke phrases than as generic `key: value` pairs.
        switch (log.action) {
            case 'VERIFY_DOCTOR':
                return `Verification: ${details.verified ? 'Approved' : 'Rejected'}`;
            case 'UPDATE_USER_STATUS':
                return `Account Status: ${formatScalar(details.status) || 'Updated'}`;
            case 'LOGIN_SUCCESS':
                return 'Authentication: Session Established';
            case 'LOGIN_FAILURE':
                return 'Security: Unsuccessful Login Attempt';
        }

        // Convention used by mutation writers across the backend:
        // `metadata: { changes: { ... } }`. Unwrap the `changes` envelope so
        // the diff renders as a flat list of fields rather than nesting one
        // level deeper than necessary. `isObject` narrows in one step so no
        // cast is needed at the assignment.
        const target: Record<string, unknown> = isObject(details.changes)
            ? details.changes
            : details;

        return formatValue(target);
    };

    if (loading) {
        return <MedicalLoader message="Syncing System Logs..." />;
    }

    return (<div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="page-heading !mb-0 transition-all duration-300">
                    System Audit Logs
                </h1>
                <p className="page-subheading italic">Track comprehensive system activities and security events</p>
            </div>
            <div className="flex items-center gap-3">
                <Button
                    variant="outline"
                    className="h-10 px-4 rounded-[var(--card-radius)] border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-semibold transition-all hover:scale-105 active:scale-95 gap-2"
                    onClick={handleRefresh}
                    disabled={refreshing}
                >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
                <div className="h-10 px-4 flex items-center justify-center rounded-[var(--card-radius)] bg-muted/50 border border-muted-foreground/20 text-muted-foreground text-sm font-bold min-w-[124px] gap-2">
                    <History className="h-4 w-4" />
                    {logs.length} Events
                </div>
            </div>
        </div>

        <Card className="p-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by action, user, or details..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                />
            </div>
        </Card>

        <Card className="overflow-hidden border shadow-sm">
            <div className="hl-table-container">
                <Table className="hl-table">
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="text-left">Event</TableHead>
                            <TableHead className="text-left">User</TableHead>
                            <TableHead className="text-left">Details</TableHead>
                            <TableHead className="text-left">Technical</TableHead>
                            <TableHead className="text-left">Timestamp</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-12 px-6">
                                    No logs found matching your criteria
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedLogs.map((log) => (
                                <TableRow key={log.id} className="hover:bg-muted/50">
                                    <TableCell>
                                        <Badge variant="secondary" className={`text-[10px] uppercase ${getActionColor(log.action)}`}>
                                            {log.action}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {/* Avatar pattern matches the rest of the admin surface
                                                (user-management, chat-hub). `<AvatarImage>` fetches the
                                                profile picture from the canonical `/api/files/profile/:userId`
                                                endpoint; on 204 No Content (no picture) or any load error,
                                                Radix transparently switches to `<AvatarFallback>`, which
                                                shows the institutional first+last initials via
                                                `getInitials` — e.g. "Dr. Mpho Modise" → "MM", not "D". */}
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage
                                                    src={getProfileImageUrl(log.userId)}
                                                    alt={log.userName ?? 'System User'}
                                                    className="object-cover"
                                                />
                                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                                    {log.userName ? getInitials(log.userName) : 'SY'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-foreground">{log.userName ?? 'System User'}</span>
                                                <span className="text-xs text-muted-foreground">{log.userEmail}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate text-muted-foreground" title={JSON.stringify(log.details)}>
                                        {renderLogDetails(log)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        <div className="flex items-center gap-2">
                                            <Monitor className="h-3 w-3" />
                                            {log.ipAddress || '127.0.0.1'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-left whitespace-nowrap">
                                        <div className="flex flex-col items-start">
                                            <span className="text-sm font-medium text-foreground">
                                                {new Date(log.createdAt).toLocaleDateString()}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(log.createdAt).toLocaleTimeString()}
                                            </span>
                                        </div>
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
                itemLabel="events"
            />
        </Card>
    </div>);
};
