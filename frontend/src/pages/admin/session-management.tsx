import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, LogOut, RefreshCw, Smartphone, Monitor, Globe } from 'lucide-react';
import { getActiveSessions, revokeSession } from '../../services/admin.service';
import type { UserSession } from '../../services/admin.service';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { Badge } from '@/components/ui/badge';
import { TransitionItem } from '../../components/layout/page-transition';
import { toast } from 'sonner';
import { usePagination } from '@/hooks/use-pagination';
import { TablePagination } from '@/components/ui/table-pagination';

export const SessionManagement: React.FC = () => {
    const [sessions, setSessions] = useState<UserSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const data = await getActiveSessions();
            setSessions(data);
        } catch (err) {
            console.error("Failed to fetch sessions:", err);
            toast.error("Failed to sync sessions");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRevoke = async (sessionId: string) => {
        try {
            const res = await revokeSession(sessionId);
            if (res.success) {
                toast.success("Session revoked successfully");
                setSessions(prev => prev.filter(s => s.sessionId !== sessionId && s.id !== sessionId));
            }
        } catch (err) {
            console.error("Failed to revoke session:", err);
            toast.error("Failed to revoke session");
        }
    };

    const getDeviceIcon = (agent: string | null) => {
        if (!agent) return <Globe className="h-4 w-4" />;
        const lower = agent.toLowerCase();
        if (lower.includes('iphone') || lower.includes('android')) return <Smartphone className="h-4 w-4" />;
        return <Monitor className="h-4 w-4" />;
    };

    // Must be called unconditionally before any early returns — React Rules of Hooks.
    const {
        currentPage,
        setCurrentPage,
        totalPages,
        paginatedData: paginatedSessions,
        showPagination,
        totalItems,
        startIndex,
        endIndex,
    } = usePagination(sessions);

    if (loading) return <MedicalLoader variant="global" message="Enumerating Live Sessions..." />;

    return (
        <div className="space-y-8">
            <TransitionItem className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="page-heading !mb-0 transition-all duration-300">
                        Live Session Manager
                    </h1>
                    <p className="page-subheading italic">Monitor and control active institutional access tokens</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        className="h-10 px-4 rounded-[var(--card-radius)] border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-semibold transition-all hover:scale-105 active:scale-95 gap-2"
                        onClick={() => { setRefreshing(true); fetchSessions(); }}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Sync Sessions
                    </Button>
                </div>
            </TransitionItem>

            <TransitionItem>
                <Card className="overflow-hidden border shadow-sm rounded-2xl bg-white dark:bg-card">
                    <div className="px-6 py-4 border-b border-border/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            Authenticated Entry Points
                        </h2>
                        <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/50">
                            {sessions.length} Active Node(s)
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
                                        <tr key={session.id} className="group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold ring-2 ring-background ring-offset-2">
                                                        {session.userName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-foreground text-xs">{session.userName}</span>
                                                        <span className="text-[10px] text-muted-foreground">{session.userEmail}</span>
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
                                                        {getDeviceIcon(session.userAgent)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-mono text-foreground font-bold">{session.ipAddress || '127.0.0.1'}</span>
                                                        <span className="text-[9px] text-muted-foreground truncate max-w-[150px]">{session.userAgent || 'Client Agent'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col text-[10px]">
                                                    <span className="font-bold text-foreground">{session.last_activity ? new Date(session.last_activity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}</span>
                                                    <span className="text-muted-foreground opacity-70">Logged: {new Date(session.loginTime).toLocaleDateString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 rounded-[var(--card-radius)] text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all hover:scale-110 active:scale-95"
                                                    title="Revoke Session"
                                                    onClick={() => handleRevoke(session.sessionId || session.id)}
                                                >
                                                    <LogOut className="h-4 w-4" />
                                                </Button>
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
                        itemLabel="sessions"
                    />
                </Card>
            </TransitionItem>
        </div>
    );
};
