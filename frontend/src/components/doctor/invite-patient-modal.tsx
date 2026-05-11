import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { AnimatedAlert } from '@/components/ui/animated-alert';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
    Mail, Phone, User as UserIcon, FileText, Copy, Check, Trash2, Loader2, ExternalLink, Sparkles,
} from 'lucide-react';
import {
    createPatientInvite,
    listPatientInvites,
    revokePatientInvite,
    type DoctorPatientInvite,
    type DoctorPatientInviteStatus,
} from '@/services/doctor.service';
import { logger } from '@/utils/logger';
import { getErrorMessage } from '@/lib/error';

/**
 * 🩺 HAEMI LIFE — DOCTOR → PATIENT INVITE MODAL
 *
 * Drives the doctor-side of the zero-cost invite flow. Doctor optionally
 * pre-fills the invitee's name / phone / email + a private note, clicks
 * "Create invite", and gets a shareable URL they can copy and send via
 * any channel (WhatsApp, in person, etc.). No SMS or email infrastructure
 * is used — the doctor owns the share channel.
 *
 * The same modal lists every outstanding invite for this doctor so they
 * can copy a link again, see who claimed it, or revoke a link that's no
 * longer wanted. Strict-TS posture: zero `any`, brand-token CSS, no
 * inline styles, no px literals.
 */

interface InvitePatientModalProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    /** Optional callback fired after a successful invite create, so the
     *  registry page can refetch its outer "invites" counter without
     *  threading the full invite list through props. */
    readonly onInviteCreated?: () => void;
}

const inviteFormSchema = z.object({
    inviteeName: z.string().max(120, { message: 'Name is too long' }).optional(),
    inviteePhone: z.string().max(40, { message: 'Phone is too long' }).optional(),
    inviteeEmail: z.string().email({ message: 'Enter a valid email' }).optional().or(z.literal('')),
    note: z.string().max(500, { message: 'Note must be 500 characters or fewer' }).optional(),
    expiresInDays: z.coerce.number().int().min(1).max(365),
});

type InviteFormValues = z.input<typeof inviteFormSchema>;

const statusMeta: Readonly<Record<DoctorPatientInviteStatus, { label: string; className: string }>> = {
    pending: {
        label: 'Pending',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-900',
    },
    claimed: {
        label: 'Claimed',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
    },
    expired: {
        label: 'Expired',
        className: 'bg-muted text-muted-foreground border-border',
    },
    revoked: {
        label: 'Revoked',
        className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-900',
    },
};

export const InvitePatientModal: React.FC<InvitePatientModalProps> = ({ open, onOpenChange, onInviteCreated }) => {
    const [invites, setInvites] = useState<DoctorPatientInvite[]>([]);
    const [loadingList, setLoadingList] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [recentlyCreated, setRecentlyCreated] = useState<DoctorPatientInvite | null>(null);
    const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const form = useForm<InviteFormValues>({
        resolver: zodResolver(inviteFormSchema),
        defaultValues: {
            inviteeName: '',
            inviteePhone: '',
            inviteeEmail: '',
            note: '',
            expiresInDays: 30,
        },
    });

    const fetchInvites = useCallback(async (): Promise<void> => {
        try {
            setLoadingList(true);
            const response = await listPatientInvites();
            setInvites(response.invites);
        } catch (err: unknown) {
            const message: string = getErrorMessage(err, 'Failed to load invites');
            setError(message);
            logger.error('[InvitePatientModal] list failed', {
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setLoadingList(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            void fetchInvites();
        } else {
            // Clear transient state when the modal closes so re-opening
            // doesn't show a stale "just created" banner.
            setRecentlyCreated(null);
            setError(null);
            form.reset();
        }
    }, [open, fetchInvites, form]);

    const onSubmit = useCallback(async (values: InviteFormValues): Promise<void> => {
        setError(null);
        setSubmitting(true);
        try {
            // Resolve `expiresInDays` to a concrete number — RHF emits the
            // raw input (the schema's `z.coerce.number()` runs inside
            // zodResolver for validation but the form value preserves the
            // unparsed type). Forcing through `Number()` aligns the wire
            // contract without weakening the schema's coerce.
            const expiresInDays: number = Number(values.expiresInDays);
            const created = await createPatientInvite({
                inviteeName: values.inviteeName !== undefined && values.inviteeName.length > 0
                    ? values.inviteeName
                    : undefined,
                inviteePhone: values.inviteePhone !== undefined && values.inviteePhone.length > 0
                    ? values.inviteePhone
                    : undefined,
                inviteeEmail: values.inviteeEmail !== undefined && values.inviteeEmail.length > 0
                    ? values.inviteeEmail
                    : undefined,
                note: values.note !== undefined && values.note.length > 0 ? values.note : undefined,
                expiresInDays,
            });
            setRecentlyCreated(created);
            form.reset();
            toast.success('Invite created — share the link with your patient');
            onInviteCreated?.();
            // Refresh the list so the new invite appears at the top.
            await fetchInvites();
        } catch (err: unknown) {
            const message: string = getErrorMessage(err, 'Failed to create invite');
            setError(message);
            logger.error('[InvitePatientModal] create failed', {
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setSubmitting(false);
        }
    }, [form, fetchInvites, onInviteCreated]);

    const handleCopy = useCallback(async (invite: DoctorPatientInvite): Promise<void> => {
        try {
            await navigator.clipboard.writeText(invite.shareUrl);
            setCopiedTokenId(invite.id);
            toast.success('Invite link copied to clipboard');
            window.setTimeout(() => {
                setCopiedTokenId((current) => (current === invite.id ? null : current));
            }, 2000);
        } catch (err: unknown) {
            // Clipboard API can be unavailable (insecure context / older
            // browsers). Surface a clear toast rather than failing silently.
            toast.error('Could not copy automatically. Long-press the link to copy manually.');
            logger.error('[InvitePatientModal] clipboard.writeText failed', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }, []);

    const handleRevoke = useCallback(async (invite: DoctorPatientInvite): Promise<void> => {
        if (invite.status !== 'pending') return;
        setRevokingId(invite.id);
        try {
            await revokePatientInvite(invite.id);
            toast.success('Invite revoked');
            // If the revoked invite is the "just created" banner, clear it.
            setRecentlyCreated((current) => (current?.id === invite.id ? null : current));
            await fetchInvites();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to revoke invite'));
            logger.error('[InvitePatientModal] revoke failed', {
                error: err instanceof Error ? err.message : String(err),
                inviteId: invite.id,
            });
        } finally {
            setRevokingId(null);
        }
    }, [fetchInvites]);

    const orderedInvites: DoctorPatientInvite[] = useMemo(() => {
        // Status priority: pending → claimed → expired → revoked. Within
        // each bucket, newest first (the API already returns newest-first
        // so we just need a stable status partition).
        const priority: Record<DoctorPatientInviteStatus, number> = {
            pending: 0, claimed: 1, expired: 2, revoked: 3,
        };
        return [...invites].sort((a, b) => priority[a.status] - priority[b.status]);
    }, [invites]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                /*
                 * Viewport breathing space — `w-[calc(100vw-2rem)]` reserves
                 * 1rem on each horizontal edge on mobile so the modal never
                 * touches the screen; `sm:w-full` releases that constraint
                 * once `max-w-2xl` (42rem) kicks in. `max-h-[calc(100dvh-4rem)]`
                 * guarantees 2rem above and below the modal on every device
                 * (using `dvh` so mobile browser chrome doesn't squeeze it).
                 * Strict-TS posture: relative units only, no px literals.
                 */
                className="w-[calc(100vw-2rem)] sm:w-full max-w-2xl max-h-[calc(100dvh-4rem)] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
                        Invite a patient
                    </DialogTitle>
                    <DialogDescription>
                        Create a shareable link your patient can use to sign up and connect to your practice. Send the link
                        through any channel — WhatsApp, SMS, in person. No platform fees, no auto-dispatched emails.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                    <AnimatedAlert visible={error !== null}>
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    </AnimatedAlert>

                    <AnimatedAlert visible={recentlyCreated !== null}>
                        {recentlyCreated !== null ? (
                            <Alert className="border-primary/20 bg-primary/5">
                                <AlertDescription className="space-y-3">
                                    <div className="text-sm font-semibold text-foreground">Invite ready — copy the link below to share.</div>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            readOnly
                                            value={recentlyCreated.shareUrl}
                                            className="h-9 font-mono text-xs"
                                            onFocus={(e) => e.currentTarget.select()}
                                            aria-label="Invite share link"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="default"
                                            onClick={() => void handleCopy(recentlyCreated)}
                                            className="shrink-0"
                                        >
                                            {copiedTokenId === recentlyCreated.id ? (
                                                <><Check className="h-4 w-4 mr-1" /> Copied</>
                                            ) : (
                                                <><Copy className="h-4 w-4 mr-1" /> Copy</>
                                            )}
                                        </Button>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        ) : null}
                    </AnimatedAlert>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <FormField
                                    control={form.control}
                                    name="inviteeName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Patient name (optional)</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        placeholder="e.g. Naledi Moeti"
                                                        className="pl-10"
                                                        {...field}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="inviteePhone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Phone (optional)</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        placeholder="+267 71 234 567"
                                                        className="pl-10"
                                                        {...field}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <FormField
                                    control={form.control}
                                    name="inviteeEmail"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email (optional)</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        type="email"
                                                        placeholder="patient@example.com"
                                                        className="pl-10"
                                                        {...field}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="expiresInDays"
                                    render={({ field }) => {
                                        // `field.value` is `unknown` because the schema uses
                                        // `z.coerce.number()` — narrow to the HTML input's
                                        // accepted shape (string|number) without `any`.
                                        const rawValue: unknown = field.value;
                                        const value: string | number =
                                            typeof rawValue === 'number' || typeof rawValue === 'string'
                                                ? rawValue
                                                : '';
                                        return (
                                            <FormItem>
                                                <FormLabel>Expires in (days)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={365}
                                                        name={field.name}
                                                        onBlur={field.onBlur}
                                                        onChange={field.onChange}
                                                        ref={field.ref}
                                                        value={value}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="note"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Private note (optional)</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Textarea
                                                    placeholder="Why you're inviting this patient — only you can see this."
                                                    className="pl-10 min-h-[5rem] rounded-[var(--card-radius)]"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-end">
                                <Button type="submit" disabled={submitting} className="min-w-[10rem]">
                                    {submitting ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…</>
                                    ) : (
                                        <>Create invite</>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>

                    <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">
                                Your invites
                            </h3>
                            {loadingList ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                            ) : (
                                <span className="text-xs text-muted-foreground">
                                    {orderedInvites.length} total
                                </span>
                            )}
                        </div>

                        {orderedInvites.length === 0 && !loadingList ? (
                            <div className="text-center py-6 border-2 border-dashed rounded-[var(--card-radius)] bg-muted/30">
                                <p className="text-sm text-muted-foreground">
                                    No invites yet. Create one above to get started.
                                </p>
                            </div>
                        ) : null}

                        <div className="space-y-2">
                            {orderedInvites.map((invite) => {
                                const meta = statusMeta[invite.status];
                                const expiresAt: Date = new Date(invite.expiresAt);
                                const isRevoking: boolean = revokingId === invite.id;
                                return (
                                    <div
                                        key={invite.id}
                                        className="flex items-center justify-between gap-3 p-3 rounded-[var(--card-radius)] border border-border bg-card hover:bg-muted/40 transition-colors"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                <span className="font-semibold text-sm truncate">
                                                    {invite.inviteeName !== null && invite.inviteeName.length > 0
                                                        ? invite.inviteeName
                                                        : 'Unnamed invite'}
                                                </span>
                                                <Badge
                                                    variant="secondary"
                                                    className={`uppercase text-[10px] font-bold tracking-wide border ${meta.className}`}
                                                >
                                                    {meta.label}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {invite.inviteePhone !== null && invite.inviteePhone.length > 0
                                                    ? invite.inviteePhone
                                                    : invite.inviteeEmail !== null && invite.inviteeEmail.length > 0
                                                        ? invite.inviteeEmail
                                                        : 'No contact info'}
                                                {' · '}
                                                {invite.status === 'pending'
                                                    ? `expires ${expiresAt.toLocaleDateString('en-GB')}`
                                                    : invite.status === 'claimed' && invite.claimedAt !== null
                                                        ? `claimed ${new Date(invite.claimedAt).toLocaleDateString('en-GB')}`
                                                        : invite.status === 'expired'
                                                            ? `expired ${expiresAt.toLocaleDateString('en-GB')}`
                                                            : 'revoked'}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {invite.status === 'pending' ? (
                                                <>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => void handleCopy(invite)}
                                                        aria-label="Copy invite link"
                                                    >
                                                        {copiedTokenId === invite.id ? (
                                                            <Check className="h-4 w-4" />
                                                        ) : (
                                                            <Copy className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => window.open(invite.shareUrl, '_blank', 'noopener,noreferrer')}
                                                        aria-label="Open invite link in new tab"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => void handleRevoke(invite)}
                                                        disabled={isRevoking}
                                                        aria-label="Revoke invite"
                                                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                    >
                                                        {isRevoking ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
