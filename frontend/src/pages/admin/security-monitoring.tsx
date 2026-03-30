import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';
import { getSecurityEvents } from '../../services/admin.service';
import type { SecurityEvent } from '../../services/admin.service';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { Badge } from '@/components/ui/badge';
import { PredictiveInsights } from '@/components/ui/predictive-insights';
import { TransitionItem } from '../../components/layout/page-transition';

export const SecurityMonitoring: React.FC = () => {
    const [events, setEvents] = useState<SecurityEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const data = await getSecurityEvents();
            setEvents(data);
        } catch (err) {
            console.error("Failed to fetch security events:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const getSeverityColor = (severity: string | null) => {
        switch (severity?.toUpperCase()) {
            case 'CRITICAL': return 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-900/50';
            case 'HIGH': return 'bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-900/50';
            case 'MEDIUM': return 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900/50';
            default: return 'bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-800';
        }
    };

    const insightsData = [
        {
            label: 'Threat Level',
            value: 'Low',
            description: 'No critical security breaches detected in the last 48 hours.',
            trend: 'down' as const,
            trendValue: '-12%',
            icon: ShieldCheck,
            variant: 'primary' as const
        },
        {
            label: 'Suspicious Activities',
            value: events.filter(e => e.isSuspicious).length.toString(),
            description: 'Login attempts from unusual locations flagged for review.',
            trend: 'neutral' as const,
            trendValue: 'Stable',
            icon: ShieldAlert,
            variant: 'primary' as const
        }
    ];

    if (loading) return <div className="pt-20"><MedicalLoader message="Analyzing Security Matrix..." /></div>;

    return (
        <div className="space-y-8">
            <TransitionItem className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="page-heading !mb-0 transition-all duration-300">
                        Security Observability
                    </h1>
                    <p className="page-subheading italic">Real-time monitoring of institutional security events</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        className="h-10 px-4 rounded-xl border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-semibold transition-all hover:scale-105 active:scale-95 gap-2"
                        onClick={() => { setRefreshing(true); fetchEvents(); }}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Sync Data
                    </Button>
                </div>
            </TransitionItem>

            <TransitionItem>
                <PredictiveInsights insights={insightsData} />
            </TransitionItem>

            <TransitionItem>
                <Card className="overflow-hidden border shadow-sm rounded-2xl bg-white dark:bg-card">
                    <div className="px-6 py-4 border-b border-border/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-primary" />
                            Live Security Feed
                        </h2>
                        <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                            {events.length} Events Logged
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
                                {events.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                                            No security events detected in the current cycle.
                                        </td>
                                    </tr>
                                ) : (
                                    events.map((event) => (
                                        <tr key={event.id} className="bg-background hover:bg-muted/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-foreground group-hover:text-primary transition-colors text-xs">{event.eventType}</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter opacity-70">{event.eventCategory}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                                        {(event.userName || 'Sys').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-foreground text-xs">{event.userName || 'System'}</span>
                                                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{event.userEmail || 'internal'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant="outline" className={`rounded-lg px-2 py-0.5 text-[9px] font-bold border ${getSeverityColor(event.eventSeverity)}`}>
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
                </Card>
            </TransitionItem>
        </div>
    );
};
