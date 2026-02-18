import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Shield, Activity, Monitor, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getAuditLogs } from '../../services/admin.service';
import type { AuditLog } from '../../services/admin.service';

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
        } catch (err: any) {
            console.error("Failed to fetch logs:", err);
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
        (log.user_name && log.user_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getActionColor = (action: string) => {
        if (action.includes('LOGIN')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
        if (action.includes('UPDATE')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
        if (action.includes('DELETE') || action.includes('FAIL')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
        if (action.includes('CREATE')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400';
    };

    if (loading && !refreshing) {
        return (
            <div className="max-w-[1400px] mx-auto p-8 animate-in fade-in">
                <Card className="p-12 text-center space-y-4">
                    <Activity className="h-12 w-12 text-primary/50 mx-auto animate-pulse" />
                    <div className="text-muted-foreground font-medium">Loading system audit logs...</div>
                </Card>
            </div>
        );
    }

    return (<div className="max-w-[1400px] mx-auto p-6 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <Shield className="h-8 w-8 text-primary" />
                    System Audit Logs
                </h1>
                <p className="text-muted-foreground mt-1">Track comprehensive system activities and security events</p>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                    <Badge variant="outline" className="bg-background">
                        {logs.length} events
                    </Badge>
                </div>
            </div>
        </div>

        <Card className="p-4">
            <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by action, user, or details..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                />
            </div>
        </Card>

        <Card className="overflow-hidden border shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                        <tr>
                            <th className="px-6 py-4 font-semibold">Event</th>
                            <th className="px-6 py-4 font-semibold">User</th>
                            <th className="px-6 py-4 font-semibold">Details</th>
                            <th className="px-6 py-4 font-semibold">Technical</th>
                            <th className="px-6 py-4 font-semibold text-right">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {filteredLogs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                    No logs found matching your criteria
                                </td>
                            </tr>
                        ) : (
                            filteredLogs.map((log) => (
                                <tr key={log.id} className="bg-background hover:bg-muted/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <Badge variant="secondary" className={`font-mono text-[10px] uppercase ${getActionColor(log.action)}`}>
                                            {log.action}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                                {(log.user_name || 'Sys').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-foreground">{log.user_name || 'System User'}</span>
                                                <span className="text-xs text-muted-foreground">{log.user_email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 max-w-xs truncate text-muted-foreground" title={JSON.stringify(log.details)}>
                                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                                        <div className="flex items-center gap-2">
                                            <Monitor className="h-3 w-3" />
                                            {log.ip_address || '127.0.0.1'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap text-muted-foreground">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                {new Date(log.created_at).toLocaleDateString()}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {new Date(log.created_at).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    </div>);
};
