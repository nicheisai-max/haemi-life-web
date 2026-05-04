import React, { useCallback, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';
import { LiveStatusPill } from '@/components/ui/live-status-pill';
import { getSecurityEvents } from '../../services/admin.service';
import type { SecurityEvent } from '../../services/admin.service';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PredictiveInsights } from '@/components/ui/predictive-insights';
import { TransitionItem } from '../../components/layout/page-transition';
import { TablePagination } from '@/components/ui/table-pagination';
import { getInitials, getProfileImageUrl } from '../../utils/avatar.resolver';
import { useAdminLiveTable } from '@/hooks/use-admin-live-table';
import { isSuspiciousSecurityEvent } from '../../../../shared/schemas/admin-events.schema';
import { logger } from '@/utils/logger';
import { socketService } from '@/services/socket.service';

/**
 * 🛡️ HAEMI LIFE — Security Observability (Phase 2: live + dynamic threat level)
 *
 * Replaces the previous static "Sync Data" button + hardcoded "Low" threat
 * level with: a live `security:event` socket subscription delivered via
 * `useAdminLiveTable`, and a frontend-computed threat level derived from
 * the count of suspicious events in the last hour.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - All errors flow through `logger`. No `console.*`.
 */

const PAGE_SIZE = 10;
const ONE_HOUR_MS = 60 * 60 * 1000;

type ThreatLevel = 'Low' | 'Medium' | 'High' | 'Critical';

interface ThreatAssessment {
    readonly level: ThreatLevel;
    readonly suspiciousLastHour: number;
    readonly description: string;
    readonly trend: 'up' | 'down' | 'neutral';
}

/**
 * Compute the current threat level from the loaded security events. Pure
 * function over the event list — recomputes automatically on every state
 * change without an effect or extra fetch. Threshold mapping documented
 * inline so adjusting levels later is a one-place edit.
 */
const computeThreatLevel = (events: ReadonlyArray<SecurityEvent>): ThreatAssessment => {
    const oneHourAgo = Date.now() - ONE_HOUR_MS;
    const suspiciousLastHour = events.filter((event) => {
        if (!isSuspiciousSecurityEvent(event)) return false;
        const eventTime = new Date(event.createdAt).getTime();
        return Number.isFinite(eventTime) && eventTime >= oneHourAgo;
    }).length;

    // Threshold mapping. Calibrated for a small-team admin surface — adjust
    // as production data grows. The bands are ordered most-permissive first
    // so the dispatch is a single chain of comparisons.
    let level: ThreatLevel;
    let description: string;
    let trend: 'up' | 'down' | 'neutral';
    if (suspiciousLastHour >= 50) {
        level = 'Critical';
        description = `${suspiciousLastHour} suspicious events in the last hour. Immediate review recommended.`;
        trend = 'up';
    } else if (suspiciousLastHour >= 20) {
        level = 'High';
        description = `${suspiciousLastHour} suspicious events in the last hour. Elevated activity detected.`;
        trend = 'up';
    } else if (suspiciousLastHour >= 5) {
        level = 'Medium';
        description = `${suspiciousLastHour} suspicious events in the last hour.`;
        trend = 'neutral';
    } else if (suspiciousLastHour > 0) {
        level = 'Low';
        description = `${suspiciousLastHour} suspicious event${suspiciousLastHour === 1 ? '' : 's'} in the last hour.`;
        trend = 'neutral';
    } else {
        level = 'Low';
        description = 'No suspicious events detected in the last hour.';
        trend = 'down';
    }

    return { level, suspiciousLastHour, description, trend };
};

const getSeverityColor = (severity: string | null): string => {
    switch (severity?.toUpperCase()) {
        case 'CRITICAL': return 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-900/50';
        case 'HIGH': return 'bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-900/50';
        case 'MEDIUM': return 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900/50';
        default: return 'bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-800';
    }
};

const getThreatLevelIcon = (level: ThreatLevel): React.ElementType => {
    return level === 'Low' ? ShieldCheck : ShieldAlert;
};

export const SecurityMonitoring: React.FC = () => {
    const [page, setPage] = useState<number>(1);

    // Stable fetcher: no filters yet on this page (Phase 2 ships live + threat
    // level; richer filtering belongs on a future iteration). The list is
    // bounded to a reasonable upper limit so threat-level computation has a
    // representative window without paginating through the whole table.
    const fetcher = useCallback(async (): Promise<ReadonlyArray<SecurityEvent>> => {
        try {
            return await getSecurityEvents(200, 0);
        } catch (error: unknown) {
            logger.error('[SecurityMonitoring] Failed to fetch security events', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }, []);

    const subscribeEvents = useMemo(() => ['security:event'] as const, []);

    const { items, isLoading, error, refetch } = useAdminLiveTable<SecurityEvent, 'security:event'>({
        fetcher,
        subscribeEvents,
        // Default behaviour (return null -> refetch) is what we want here:
        // a new security event flips threat-level computation and may shift
        // the "last hour" window, so refetch keeps everything coherent.
        onEvent: () => null,
    });

    // ─── Derived: threat level + insights cards ──────────────────────────────
    const threatAssessment = useMemo<ThreatAssessment>(
        () => computeThreatLevel(items),
        [items]
    );

    const totalSuspicious = useMemo<number>(
        () => items.filter(isSuspiciousSecurityEvent).length,
        [items]
    );

    const insightsData = useMemo(() => [
        {
            label: 'Threat Level',
            value: threatAssessment.level,
            description: threatAssessment.description,
            trend: threatAssessment.trend,
            trendValue: `${threatAssessment.suspiciousLastHour}/h`,
            icon: getThreatLevelIcon(threatAssessment.level),
            variant: 'primary' as const,
        },
        {
            label: 'Suspicious Activities',
            value: totalSuspicious.toString(),
            description: 'Events flagged by the heuristic across the visible window.',
            trend: totalSuspicious > 0 ? ('up' as const) : ('neutral' as const),
            trendValue: totalSuspicious > 0 ? 'Active' : 'Stable',
            icon: ShieldAlert,
            variant: 'primary' as const,
        },
    ], [threatAssessment, totalSuspicious]);

    // ─── Pagination over the loaded slice ────────────────────────────────────
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const startIndex = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const endIndex = Math.min(page * PAGE_SIZE, totalItems);
    const showPagination = totalItems > PAGE_SIZE;
    const paginatedEvents = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const isLiveConnected = socketService.isConnected();

    if (isLoading && items.length === 0) {
        return <MedicalLoader variant="global" message="Analyzing Security Matrix..." />;
    }

    return (
        <div className="space-y-8">
            <TransitionItem className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="page-heading !mb-0 transition-all duration-300">
                            Security Observability
                        </h1>
                        <LiveStatusPill isConnected={isLiveConnected} />
                    </div>
                    <p className="page-subheading italic">Real-time monitoring of institutional security events</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        className="h-10 px-4 rounded-[var(--card-radius)] border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-semibold transition-all hover:scale-105 active:scale-95 gap-2"
                        onClick={() => { void refetch(); }}
                        disabled={isLoading}
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Sync Data
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
                <PredictiveInsights insights={insightsData} />
            </TransitionItem>

            <TransitionItem>
                <Card className="overflow-hidden border shadow-sm rounded-[var(--card-radius)] bg-white dark:bg-card">
                    <div className="px-6 py-4 border-b border-border/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-primary" />
                            Live Security Feed
                        </h2>
                        <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                            {totalItems} Events Logged
                        </Badge>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[11px] text-muted-foreground uppercase bg-muted/30 border-b">
                                <tr>
                                    <th className="px-6 py-4 font-bold tracking-wider">Event / Type</th>
                                    <th className="px-6 py-4 font-bold tracking-wider">Actor</th>
                                    <th className="px-6 py-4 font-bold tracking-wider">Severity</th>
                                    <th className="px-6 py-4 font-bold tracking-wider">Network</th>
                                    <th className="px-6 py-4 font-bold tracking-wider text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {paginatedEvents.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                                            No security events detected in the current cycle.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedEvents.map((event) => (
                                        <tr key={event.id} className="bg-background hover:bg-muted/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-foreground group-hover:text-primary transition-colors text-xs">{event.eventType}</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter opacity-70">{event.eventCategory}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-7 w-7">
                                                        <AvatarImage
                                                            src={getProfileImageUrl(event.userId)}
                                                            alt={event.userName ?? 'System'}
                                                            className="object-cover"
                                                        />
                                                        <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                                            {event.userName ? getInitials(event.userName) : 'SY'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-foreground text-xs">{event.userName ?? 'System'}</span>
                                                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{event.userEmail ?? 'internal'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant="outline" className={`rounded-[var(--card-radius)] px-2 py-0.5 text-[9px] font-bold border ${getSeverityColor(event.eventSeverity)}`}>
                                                    {event.eventSeverity || 'INFO'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground font-mono text-[11px]">
                                                {event.ipAddress || '0.0.0.0'}
                                            </td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <div className="flex flex-col text-[11px]">
                                                    <span className="font-bold text-foreground">{new Date(event.createdAt).toLocaleDateString()}</span>
                                                    <span className="text-muted-foreground text-[10px]">{new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </td>
                                        </tr>
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
                        itemLabel="events"
                    />
                </Card>
            </TransitionItem>
        </div>
    );
};
