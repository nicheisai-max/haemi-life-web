import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Monitor, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getAuditLogs } from '../../services/admin.service';
import type { AuditLog } from '../../services/admin.service';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { getErrorMessage } from '../../lib/error';
import { usePagination } from '@/hooks/use-pagination';
import { TablePagination } from '@/components/ui/table-pagination';

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
                <div className="h-10 px-4 flex items-center justify-center rounded-xl bg-muted/50 border border-muted-foreground/20 text-muted-foreground text-sm font-bold min-w-[100px]">
                    {logs.length} events
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
                <table className="hl-table">
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>User</th>
                            <th>Details</th>
                            <th>Technical</th>
                            <th className="text-right">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedLogs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center text-muted-foreground" style={{ padding: '3rem 1.5rem' }}>
                                    No logs found matching your criteria
                                </td>
                            </tr>
                        ) : (
                            paginatedLogs.map((log) => (
                                <tr key={log.id}>
                                    <td>
                                        <Badge variant="secondary" className={`font-mono text-[10px] uppercase ${getActionColor(log.action)}`}>
                                            {log.action}
                                        </Badge>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                                {(log.userName || 'Sys').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-foreground">{log.userName || 'System User'}</span>
                                                <span className="text-xs text-muted-foreground">{log.userEmail}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="max-w-xs truncate text-muted-foreground" title={JSON.stringify(log.details)}>
                                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                                    </td>
                                    <td className="text-muted-foreground font-mono text-xs">
                                        <div className="flex items-center gap-2">
                                            <Monitor className="h-3 w-3" />
                                            {log.ipAddress || '127.0.0.1'}
                                        </div>
                                    </td>
                                    <td className="text-right whitespace-nowrap">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-medium text-foreground">
                                                {new Date(log.createdAt).toLocaleDateString()}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(log.createdAt).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
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
