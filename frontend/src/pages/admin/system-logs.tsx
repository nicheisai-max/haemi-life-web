import React, { useCallback, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Monitor, RefreshCw, History, ChevronDown, ChevronRight, Radio } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getAuditLogs } from '../../services/admin.service';
import type { AuditLog } from '../../services/admin.service';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { TablePagination } from '@/components/ui/table-pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { isObject } from '../../utils/type-guards';
import { getInitials, getProfileImageUrl } from '../../utils/avatar.resolver';
import { useAdminLiveTable } from '@/hooks/use-admin-live-table';
import { logger } from '@/utils/logger';
import { socketService } from '@/services/socket.service';

/**
 * 🛡️ HAEMI LIFE — System Audit Logs (Phase 2: live + server-side filters)
 *
 * Replaces the previous client-side full-load + filter pattern that broke
 * past ~10k rows with: server-side `q` / `action` / `entityType` query
 * params, paginated response (`items` + `pagination.total`), and a live
 * stream via the `audit:new` socket event delivered by `useAdminLiveTable`.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - Every `unknown` (e.g. JSONB `details` from the wire) is structurally
 *     narrowed via the shared `isObject` predicate before access.
 *   - All errors flow through `logger`. No `console.*`.
 */

const PAGE_SIZE = 25;
// Debounce input changes so a fast typist doesn't fire one fetch per keystroke.
const FILTER_DEBOUNCE_MS = 300;

type FilterState = {
    readonly q: string;
    readonly action: string;
    readonly entityType: string;
};

const EMPTY_FILTERS: FilterState = { q: '', action: '', entityType: '' };

/**
 * Recognised audit actions, surfaced as filter chips so admins do not need
 * to remember exact verbs. Adding a new action here is purely cosmetic —
 * the underlying server-side filter accepts any case-insensitive prefix,
 * so unknown verbs still match. The list mirrors what the backend's audit
 * service currently writes (search backend/src for `auditService.log({ action`).
 */
const ACTION_FILTER_OPTIONS: ReadonlyArray<string> = [
    'LOGIN',
    'LOGOUT',
    'VERIFY_DOCTOR',
    'REJECT_DOCTOR',
    'UPDATE_USER_STATUS',
    'SCREENING',
    'REVOKE',
];

export const SystemLogs: React.FC = () => {
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
    const [debouncedFilters, setDebouncedFilters] = useState<FilterState>(EMPTY_FILTERS);
    const [page, setPage] = useState<number>(1);
    const [total, setTotal] = useState<number>(0);
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

    // Debounce the in-flight filter values so the fetcher only changes once
    // the user stops typing for `FILTER_DEBOUNCE_MS` — prevents N back-to-back
    // requests on a fast keystroke burst. Page resets to 1 when filters
    // change so the user sees the first page of the new result set.
    React.useEffect(() => {
        const id = setTimeout(() => {
            setDebouncedFilters(filters);
            setPage(1);
        }, FILTER_DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [filters]);

    // Stable fetcher ref-like reference — recreated only when the resolved
    // filter values change. `useAdminLiveTable` re-fetches on identity change.
    const fetcher = useCallback(async (): Promise<ReadonlyArray<AuditLog>> => {
        const offset = (page - 1) * PAGE_SIZE;
        try {
            const response = await getAuditLogs({
                limit: PAGE_SIZE,
                offset,
                q: debouncedFilters.q.length > 0 ? debouncedFilters.q : undefined,
                action: debouncedFilters.action.length > 0 ? debouncedFilters.action : undefined,
                entityType: debouncedFilters.entityType.length > 0 ? debouncedFilters.entityType : undefined,
            });
            setTotal(response.pagination.total);
            return response.items;
        } catch (error: unknown) {
            // Re-throw so `useAdminLiveTable` surfaces the error through
            // its own `error` state. We log here for diagnosis since the
            // hook only logs the message — page context is useful.
            logger.error('[SystemLogs] Audit log fetch failed', {
                error: error instanceof Error ? error.message : String(error),
                page,
                filters: debouncedFilters,
            });
            throw error;
        }
    }, [page, debouncedFilters]);

    // `subscribeEvents` is stable across renders so the hook does not
    // re-attach socket listeners on every keystroke.
    const subscribeEvents = useMemo(() => ['audit:new'] as const, []);

    const { items, isLoading, error, refetch } = useAdminLiveTable<AuditLog, 'audit:new'>({
        fetcher,
        subscribeEvents,
        // For an audit log, prepending the new row only makes sense when we
        // are on page 1 with no filters — otherwise the new row may not
        // belong on the current page. The simplest correct behaviour is to
        // refetch (return null) so the displayed slice stays consistent
        // with the active filters and page.
        onEvent: () => null,
    });

    // ─── Filter handlers ─────────────────────────────────────────────────────
    const handleSearchChange = (value: string): void => {
        setFilters((prev) => ({ ...prev, q: value }));
    };
    const handleActionChange = (value: string): void => {
        setFilters((prev) => ({ ...prev, action: value === prev.action ? '' : value }));
    };
    const handleClearFilters = (): void => {
        setFilters(EMPTY_FILTERS);
    };

    // ─── JSONB row expansion ────────────────────────────────────────────────
    const toggleExpand = (id: string): void => {
        setExpandedRowId((prev) => (prev === id ? null : id));
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const endIndex = Math.min(page * PAGE_SIZE, total);
    const showPagination = total > PAGE_SIZE;
    const isLiveConnected = socketService.isConnected();
    const hasActiveFilters = debouncedFilters.q.length > 0
        || debouncedFilters.action.length > 0
        || debouncedFilters.entityType.length > 0;

    if (isLoading && items.length === 0) {
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
                {/* Live status indicator: green dot = socket connected (events
                    will stream in); muted dot = polling fallback active. */}
                <div
                    className="h-10 px-3 flex items-center gap-2 rounded-[var(--card-radius)] bg-muted/50 border border-muted-foreground/20 text-xs font-semibold"
                    aria-live="polite"
                    title={isLiveConnected ? 'Live event stream connected' : 'Polling fallback (socket disconnected)'}
                >
                    <Radio className={`h-3.5 w-3.5 ${isLiveConnected ? 'text-green-500' : 'text-muted-foreground'}`} />
                    <span className={isLiveConnected ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                        {isLiveConnected ? 'Live' : 'Polling'}
                    </span>
                </div>
                <Button
                    variant="outline"
                    className="h-10 px-4 rounded-[var(--card-radius)] border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-semibold transition-all hover:scale-105 active:scale-95 gap-2"
                    onClick={() => { void refetch(); }}
                    disabled={isLoading}
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
                <div className="h-10 px-4 flex items-center justify-center rounded-[var(--card-radius)] bg-muted/50 border border-muted-foreground/20 text-muted-foreground text-sm font-bold min-w-[124px] gap-2">
                    <History className="h-4 w-4" />
                    {total} Events
                </div>
            </div>
        </div>

        <Card className="p-4 space-y-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by action, entity type, or details (server-side)…"
                    value={filters.q}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10"
                />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                    Action:
                </span>
                {ACTION_FILTER_OPTIONS.map((option) => {
                    const isActive = debouncedFilters.action === option;
                    return (
                        <Button
                            key={option}
                            type="button"
                            variant={isActive ? 'default' : 'outline'}
                            onClick={() => handleActionChange(option)}
                            className={`h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider rounded-[var(--card-radius)] ${isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-transparent text-muted-foreground border-muted-foreground/30 hover:border-primary/40 hover:text-foreground'
                                }`}
                        >
                            {option}
                        </Button>
                    );
                })}
                {hasActiveFilters && (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClearFilters}
                        className="h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground rounded-[var(--card-radius)]"
                    >
                        Clear
                    </Button>
                )}
            </div>
            {error !== null && (
                <p className="text-xs text-rose-500 font-medium">
                    {error.message}
                </p>
            )}
        </Card>

        <Card className="overflow-hidden border shadow-sm">
            <div className="hl-table-container">
                <Table className="hl-table">
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-8" />
                            <TableHead className="text-left">Event</TableHead>
                            <TableHead className="text-left">User</TableHead>
                            <TableHead className="text-left">Details</TableHead>
                            <TableHead className="text-left">Technical</TableHead>
                            <TableHead className="text-left">Timestamp</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-12 px-6">
                                    {hasActiveFilters
                                        ? 'No logs match the current filters.'
                                        : 'No audit log events recorded yet.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((log) => (
                                <AuditLogRow
                                    key={log.id}
                                    log={log}
                                    isExpanded={expandedRowId === log.id}
                                    onToggle={() => toggleExpand(log.id)}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                startIndex={startIndex}
                endIndex={endIndex}
                showPagination={showPagination}
                onPageChange={setPage}
                itemLabel="events"
            />
        </Card>
    </div>);
};

/* ─── Internal: row component with JSONB expand ───────────────────────────── */

interface AuditLogRowProps {
    readonly log: AuditLog;
    readonly isExpanded: boolean;
    readonly onToggle: () => void;
}

const AuditLogRow: React.FC<AuditLogRowProps> = ({ log, isExpanded, onToggle }) => {
    return (
        <>
            <TableRow className="hover:bg-muted/50 cursor-pointer" onClick={onToggle}>
                <TableCell className="w-8">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); onToggle(); }}
                        className="h-7 w-7 p-0 rounded-[var(--card-radius)] text-muted-foreground hover:text-foreground"
                        aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                    >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                </TableCell>
                <TableCell>
                    <Badge variant="secondary" className={`text-[10px] uppercase ${getActionColor(log.action)}`}>
                        {log.action}
                    </Badge>
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
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
                <TableCell className="max-w-xs truncate text-muted-foreground">
                    {renderLogSummary(log)}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                    <div className="flex items-center gap-2">
                        <Monitor className="h-3 w-3" />
                        {log.ipAddress || '—'}
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
            {isExpanded && (
                <TableRow className="bg-muted/30">
                    <TableCell />
                    <TableCell colSpan={5} className="py-4">
                        <div className="space-y-2">
                            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                                Full payload
                            </p>
                            <pre className="text-[11px] font-mono text-foreground bg-background border border-border rounded-[var(--card-radius)] p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                                {formatPayloadAsJson(log)}
                            </pre>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const getActionColor = (action: string): string => {
    if (action.includes('LOGIN')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    if (action.includes('UPDATE')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    if (action.includes('DELETE') || action.includes('FAIL')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    if (action.includes('CREATE')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400';
};

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

    if (!isObject(val)) return '';
    const entries = Object.entries(val);
    if (entries.length === 0) return '—';
    return entries
        .map(([k, v]) => `${humanizeKey(k)}: ${formatValue(v, depth + 1)}`)
        .join(', ');
};

const renderLogSummary = (log: AuditLog): string => {
    if (!log.details) return 'System event record';

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

    const target: Record<string, unknown> = isObject(details.changes)
        ? details.changes
        : details;

    return formatValue(target);
};

const formatPayloadAsJson = (log: AuditLog): string => {
    let parsedDetails: unknown = log.details;
    if (typeof log.details === 'string' && log.details.length > 0) {
        try {
            parsedDetails = JSON.parse(log.details);
        } catch {
            parsedDetails = log.details;
        }
    }
    const fullPayload: Record<string, unknown> = {
        id: log.id,
        action: log.action,
        userId: log.userId,
        userName: log.userName ?? null,
        userEmail: log.userEmail ?? null,
        entityType: log.entityType,
        entityId: log.entityId,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
        details: parsedDetails,
    };
    return JSON.stringify(fullPayload, null, 2);
};
