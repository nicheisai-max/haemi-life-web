import React, { useCallback, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getPendingVerifications, verifyDoctor } from '../../services/admin.service';
import type { PendingVerification } from '../../services/admin.service';
import { Clock, AlertCircle, X, ShieldCheck, User, Check, Mail, Phone, Calendar, Briefcase, FileText, DollarSign, Video } from 'lucide-react';
import { LiveStatusPill } from '@/components/ui/live-status-pill';
import { useAdminLiveTable } from '@/hooks/use-admin-live-table';
import { logger } from '@/utils/logger';
import { socketService } from '@/services/socket.service';

/**
 * 🛡️ HAEMI LIFE — Verify Doctors (Phase 3)
 *
 * Replaces the previous spinner-only feedback + bare card with: live
 * `doctor:verified` socket subscription that auto-removes verified or
 * rejected doctors from the queue, persistent toast feedback on every
 * approve/reject action, and a richer card that surfaces the full
 * clinical profile (consultation fee, video-consult capability, bio)
 * not just name / license.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - Every error path through `logger`. Zero `console.*`.
 *   - Toast feedback dispatched through `system:success` / `system:error`
 *     CustomEvent channels (mirrors Phase 1's screening-reorder pattern).
 */

export const VerifyDoctors: React.FC = () => {
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetcher = useCallback(async (): Promise<ReadonlyArray<PendingVerification>> => {
        try {
            return await getPendingVerifications();
        } catch (error: unknown) {
            logger.error('[VerifyDoctors] Failed to fetch pending verifications', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }, []);

    const subscribeEvents = useMemo(() => ['doctor:verified'] as const, []);

    const { items, isLoading, error, refetch } = useAdminLiveTable<PendingVerification, 'doctor:verified'>({
        fetcher,
        subscribeEvents,
        // The doctor disappears from the pending queue regardless of
        // outcome — both 'approved' and 'rejected' move them out of the
        // is_verified=false bucket. Filter out the matching userId; if
        // no match exists locally (event fired before this admin loaded
        // the page), it is a no-op and the next refetch will reconcile.
        onEvent: (_event, payload, current) => {
            return current.filter((doctor) => String(doctor.id) !== payload.userId);
        },
    });

    const handleVerify = async (doctor: PendingVerification, approved: boolean): Promise<void> => {
        const idStr: string = doctor.id.toString();
        try {
            setProcessingId(idStr);
            await verifyDoctor(idStr, approved);

            // Toast feedback — replaces the previous spinner-only flow.
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('system:success', {
                    detail: {
                        message: approved
                            ? `${doctor.name || 'Doctor'} approved.`
                            : `${doctor.name || 'Doctor'} application rejected.`,
                    },
                }));
            }

            // The live `doctor:verified` event will remove the row, but
            // if the socket is disconnected, refetch keeps the UI fresh.
            if (!socketService.isConnected()) {
                void refetch();
            }
        } catch (err: unknown) {
            logger.error('[VerifyDoctors] Verification action failed', {
                error: err instanceof Error ? err.message : String(err),
                doctorId: idStr,
                approved,
            });
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('system:error', {
                    detail: { message: 'Could not process verification. Please try again.' },
                }));
            }
        } finally {
            setProcessingId(null);
        }
    };

    const isLiveConnected = socketService.isConnected();

    if (isLoading && items.length === 0) {
        return (
            <div className="pt-8 mx-auto p-8">
                <Card className="p-8 text-center">
                    <div className="animate-pulse text-muted-foreground">Loading verifications...</div>
                </Card>
            </div>
        );
    }

    return (<div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="page-heading !mb-0 transition-all duration-300">Verify Doctors</h1>
                    <LiveStatusPill isConnected={isLiveConnected} />
                </div>
                <p className="page-subheading italic">Review and approve doctor registrations</p>
            </div>
            <div className="flex items-center gap-3">
                <Badge variant="secondary" className="px-3 py-1.5 text-sm font-medium flex items-center gap-2 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <Clock className="h-4 w-4" />
                    {items.length} Pending
                </Badge>
            </div>
        </div>

        {error !== null && (
            <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md flex items-center gap-2 border border-destructive/20">
                <AlertCircle className="h-5 w-5" />
                <span className="flex-1">{error.message}</span>
                <button onClick={() => { void refetch(); }} className="hover:bg-destructive/10 p-1 rounded text-xs font-bold">
                    Retry
                </button>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.length === 0 ? (
                <Card className="col-span-full p-12 text-center flex flex-col items-center justify-center space-y-4">
                    <ShieldCheck className="h-16 w-16 text-green-500/50" />
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold">All Caught Up!</h3>
                        <p className="text-muted-foreground">
                            There are no pending doctor verifications at the moment.
                        </p>
                    </div>
                </Card>
            ) : (
                items.map((verification) => (
                    <DoctorCard
                        key={verification.id}
                        verification={verification}
                        isProcessing={processingId === verification.id.toString()}
                        onApprove={() => { void handleVerify(verification, true); }}
                        onReject={() => { void handleVerify(verification, false); }}
                    />
                ))
            )}
        </div>
    </div>);
};

/* ─── Internal: richer Doctor card ────────────────────────────────────────── */

interface DoctorCardProps {
    readonly verification: PendingVerification;
    readonly isProcessing: boolean;
    readonly onApprove: () => void;
    readonly onReject: () => void;
}

/**
 * Format consultation fee for display. The DB column is `DECIMAL(10, 2)`
 * which the `pg` driver returns as `string | number | null`. We narrow
 * to `number` and render with locale-formatted thousands; null renders
 * as a placeholder dash so the row still pads correctly.
 */
const formatConsultationFee = (fee: number | null | undefined): string => {
    if (fee === null || fee === undefined) return '—';
    if (typeof fee === 'number' && Number.isFinite(fee)) {
        return fee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    // Fee may arrive as a numeric string from the DB driver; coerce
    // defensively without `as unknown as` — Number() returns NaN for
    // unparseable input which we replace with the dash.
    const parsed = Number(fee);
    return Number.isFinite(parsed)
        ? parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '—';
};

const DoctorCard: React.FC<DoctorCardProps> = ({ verification, isProcessing, onApprove, onReject }) => {
    const hasBio = typeof verification.bio === 'string' && verification.bio.trim().length > 0;

    return (
        <Card className="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6 border-b bg-muted/30">
                <div className="flex items-start gap-4">
                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                        <User className="h-7 w-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate" title={verification.name}>
                            {verification.name || 'Unknown Name'}
                        </h3>
                        <div className="flex flex-col gap-1 mt-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2 truncate" title={verification.email}>
                                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{verification.email || 'No email'}</span>
                            </div>
                            <div className="flex items-center gap-2 truncate">
                                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                                <span>{verification.phoneNumber || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 flex-1 space-y-4 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-2">
                        <Briefcase className="h-3.5 w-3.5" />
                        Specialization
                    </span>
                    <span className="font-medium text-right">{verification.specialization || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5" />
                        License Number
                    </span>
                    <span className="font-medium text-right font-mono">{verification.licenseNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" />
                        Experience
                    </span>
                    <span className="font-medium text-right">{verification.yearsOfExperience || 0} years</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-2">
                        <DollarSign className="h-3.5 w-3.5" />
                        Consultation Fee
                    </span>
                    <span className="font-medium text-right font-mono">
                        {formatConsultationFee(verification.consultationFee)}
                    </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground flex items-center gap-2">
                        <Video className="h-3.5 w-3.5" />
                        Video Consultation
                    </span>
                    <span className="font-medium text-right">
                        {verification.canVideoConsult === true
                            ? 'Enabled'
                            : verification.canVideoConsult === false
                                ? 'Disabled'
                                : '—'}
                    </span>
                </div>
                <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        Registered
                    </span>
                    <span className="font-medium text-right">
                        {new Date(verification.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </span>
                </div>
                {hasBio && (
                    <div className="pt-3 border-t border-border/50">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1.5">
                            Professional Bio
                        </p>
                        <p className="text-xs text-foreground leading-relaxed line-clamp-3" title={verification.bio}>
                            {verification.bio}
                        </p>
                    </div>
                )}
            </div>

            <div className="p-4 bg-muted/30 border-t grid grid-cols-2 gap-3">
                <Button
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                    onClick={onReject}
                    disabled={isProcessing}
                >
                    {isProcessing ? (
                        <span className="animate-spin mr-2">⏳</span>
                    ) : (
                        <X className="h-4 w-4 mr-2" />
                    )}
                    Reject
                </Button>
                <Button
                    variant="default"
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={onApprove}
                    disabled={isProcessing}
                >
                    {isProcessing ? (
                        <span className="animate-spin mr-2">⏳</span>
                    ) : (
                        <Check className="h-4 w-4 mr-2" />
                    )}
                    Approve
                </Button>
            </div>
        </Card>
    );
};
