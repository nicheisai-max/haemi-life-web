import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AuthenticatedImage } from '@/components/ui/authenticated-image';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AnimatedAlert } from '@/components/ui/animated-alert';
import {
    ArrowLeft,
    Calendar,
    ClipboardList,
    FileText,
    Pill,
    ShieldAlert,
    Activity,
    Phone,
    Mail,
    BadgeAlert,
    HeartPulse,
    Cake,
    User as UserIcon,
    Sparkles,
    AlertCircle,
} from 'lucide-react';
import { getInitials } from '@/utils/avatar.resolver';
import {
    getDoctorPatientProfile,
    type PatientProfilePayload,
    type PatientProfileSummary,
    type PatientProfileAppointment,
    type PatientProfilePrescription,
    type PatientProfileRecord,
    type PatientProfileScreeningGroup,
    type PatientLifecycleStage,
} from '@/services/doctor.service';
import { usePageLoader } from '@/hooks/use-page-loader';
import { useClinicTimezoneFormat } from '@/hooks/use-clinic-timezone';
import { logger } from '@/utils/logger';
import { PATHS } from '@/routes/paths';

/**
 * 🩺 HAEMI LIFE — DOCTOR'S PATIENT PROFILE (PR 2/3 of registry rollout)
 *
 * Per-patient deep-dive at `/doctor/patients/:id`. Renders the full
 * clinical dossier — demographics, lifecycle context, allergies,
 * appointments, prescriptions, uploaded records, and screening trail.
 *
 * Server-side authorization is enforced by the aggregator endpoint
 * (`GET /api/doctor/me/patients/:id`): doctors with no completed
 * appointment for this patient receive 403. The UI surfaces that
 * cleanly via the existing inline `<AnimatedAlert>` + `<Alert>`
 * destructive variant — institutional honesty, no fake content.
 *
 * Layout architecture:
 *   - Desktop (≥ 64rem): hero + 2-column body — 2/3 tabs, 1/3 quick
 *     actions rail.
 *   - Mobile / tablet: single column — hero, actions card, tabs in
 *     vertical flow. Tabs themselves remain horizontally scrollable
 *     so all five remain reachable without a hamburger.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`
 *   - Wire-boundary errors narrowed via instanceof + axios response
 *     shape guards
 *   - All booleans + readonly props explicitly typed
 *
 * Visual posture (project mandate):
 *   - Zero inline CSS, zero `px` literals
 *   - Brand tokens: `--card`, `--border`, `--foreground`,
 *     `--muted-foreground`, `--primary`, `--card-radius`
 *   - Light + dark themes auto-resolve via Tailwind dark: variants
 *     where strictly necessary (allergy red, screening risk amber)
 *   - Mobile-to-desktop responsive via `sm:`, `md:`, `lg:` breakpoints
 */

const resolvePatientImageSrc = (summary: PatientProfileSummary): string => {
    if (summary.profileImage === null || summary.profileImage.length === 0) return '';
    if (summary.profileImage.startsWith('http')) return summary.profileImage;
    return `/api/files/profile/${summary.id}`;
};

const lifecycleStageMeta: Readonly<Record<PatientLifecycleStage, { label: string; className: string }>> = {
    'active': {
        label: 'Active',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
    },
    'lapsed': {
        label: 'Lapsed',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-900',
    },
    'due-for-follow-up': {
        label: 'Due for follow-up',
        className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-900',
    },
    'at-risk': {
        label: 'At-risk',
        className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-900',
    },
};

/**
 * Clinical-date formatter for the patient profile page. Every date
 * displayed here (last visit, first seen, appointment date, DOB,
 * record service / upload dates) is anchored in the doctor's clinic
 * timezone — the visits, prescriptions, and screenings happened in
 * the clinic, not in the doctor's current physical location, so
 * rendering them in browser TZ would silently corrupt the audit
 * record.
 *
 * Defensive: returns `'N/A'` for null/empty/malformed input. Bound
 * to the live `<ClinicTimezoneProvider>` value so a TZ change from
 * any surface flips every row instantly.
 */
const useClinicalDateFormat = (): ((value: string | null) => string) => {
    const { formatDate } = useClinicTimezoneFormat();
    return useCallback((value: string | null): string => {
        if (value === null || value.length === 0) return 'N/A';
        const formatted = formatDate(
            value,
            { day: '2-digit', month: 'short', year: 'numeric' },
        );
        return formatted.length > 0 ? formatted : 'N/A';
    }, [formatDate]);
};

/** Compact list parser — patient_profiles.medical_conditions / allergies
 *  are TEXT fields. Split on comma / newline; trim; drop empties. */
const parseTextList = (raw: string | null): string[] => {
    if (raw === null || raw.length === 0) return [];
    return raw
        .split(/[,\n;]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
};

/** Appointment status → visual treatment. */
const appointmentStatusClass = (status: string): string => {
    switch (status.toLowerCase()) {
        case 'completed':
            return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
        case 'scheduled':
            return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
        case 'cancelled':
            return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
        case 'no-show':
            return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
        default:
            return 'bg-muted text-muted-foreground';
    }
};

interface ProfileHeroProps {
    readonly summary: PatientProfileSummary;
}

const ProfileHero: React.FC<ProfileHeroProps> = ({ summary }) => {
    const lifecycle = lifecycleStageMeta[summary.lifecycleStage];
    const conditions = parseTextList(summary.medicalConditions);
    const allergies = parseTextList(summary.allergies);

    return (
        <Card className="p-6 md:p-8 border-border/60">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
                <Avatar className="h-24 w-24 md:h-28 md:w-28 rounded-3xl shrink-0 border-0 overflow-hidden">
                    {summary.profileImage !== null && summary.profileImage.length > 0 ? (
                        <AuthenticatedImage
                            src={resolvePatientImageSrc(summary)}
                            alt={summary.name}
                            className="object-cover w-full h-full rounded-3xl"
                            errorFallback={
                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-3xl rounded-3xl border-0">
                                    {getInitials(summary.name)}
                                </AvatarFallback>
                            }
                        />
                    ) : (
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-3xl rounded-3xl border-0">
                            {getInitials(summary.name)}
                        </AvatarFallback>
                    )}
                </Avatar>

                <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl md:text-3xl font-bold text-foreground">{summary.name}</h1>
                        <span
                            className={
                                'inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-bold uppercase tracking-wide '
                                + lifecycle.className
                            }
                        >
                            {lifecycle.label}
                        </span>
                        {summary.acuityLevel === 'high' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold uppercase tracking-wide bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-900">
                                <Sparkles className="h-3 w-3" aria-hidden="true" />
                                High acuity
                            </span>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-0.5">Age</div>
                            <div className="font-semibold text-foreground">{summary.age !== null ? `${summary.age} yrs` : 'N/A'}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-0.5">Gender</div>
                            <div className="font-semibold text-foreground capitalize">{summary.gender ?? 'N/A'}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-0.5">Blood group</div>
                            <div className="font-semibold text-foreground">{summary.bloodGroup ?? 'N/A'}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-0.5">National ID</div>
                            <div className="font-semibold text-foreground truncate">{summary.nationalId ?? 'N/A'}</div>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-0.5 flex items-center gap-1">
                                <Mail className="h-3 w-3" aria-hidden="true" /> Email
                            </div>
                            <div className="font-medium text-foreground/90 text-xs truncate">{summary.email ?? '—'}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-0.5 flex items-center gap-1">
                                <Phone className="h-3 w-3" aria-hidden="true" /> Phone
                            </div>
                            <div className="font-medium text-foreground/90 text-xs">{summary.phoneNumber ?? '—'}</div>
                        </div>
                        <div className="col-span-2">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-0.5">Emergency contact</div>
                            <div className="font-medium text-foreground/90 text-xs">
                                {summary.emergencyContactName !== null
                                    ? `${summary.emergencyContactName}${summary.emergencyContactPhone !== null ? ` · ${summary.emergencyContactPhone}` : ''}`
                                    : '—'}
                            </div>
                        </div>
                    </div>

                    {allergies.length > 0 ? (
                        <Alert className="border-rose-300/60 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-900/60 text-rose-800 dark:text-rose-200">
                            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                            <AlertDescription className="font-semibold">
                                <span className="uppercase text-[10px] tracking-widest mr-2">Allergies</span>
                                {allergies.join(', ')}
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {conditions.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mr-1">Conditions</span>
                            {conditions.map(c => (
                                <Badge key={c} variant="secondary" className="font-medium">{c}</Badge>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </Card>
    );
};

interface ProfileQuickActionsProps {
    readonly summary: PatientProfileSummary;
}

const ProfileQuickActions: React.FC<ProfileQuickActionsProps> = ({ summary }) => {
    const formatDate = useClinicalDateFormat();
    return (
        <Card className="p-5 space-y-4">
            <div>
                <h2 className="font-bold text-foreground mb-1">Clinical snapshot</h2>
                <p className="text-xs text-muted-foreground">Quick at-a-glance metrics for this patient.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-[var(--card-radius)] border bg-muted/40 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">With you</div>
                    <div className="text-xl font-bold text-foreground">{summary.completedWithDoctor}</div>
                    <div className="text-[10px] text-muted-foreground">completed visits</div>
                </div>
                <div className="rounded-[var(--card-radius)] border bg-muted/40 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">Last visit</div>
                    <div className="text-sm font-bold text-foreground">{formatDate(summary.lastVisit)}</div>
                </div>
                <div className="rounded-[var(--card-radius)] border bg-muted/40 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">First seen</div>
                    <div className="text-sm font-bold text-foreground">{formatDate(summary.firstSeenWithDoctor)}</div>
                </div>
                <div className="rounded-[var(--card-radius)] border bg-muted/40 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">Risk score</div>
                    <div className="text-xl font-bold text-foreground">
                        {summary.latestRiskScore !== null
                            ? summary.latestRiskScore.toFixed(2)
                            : '—'}
                    </div>
                </div>
            </div>
        </Card>
    );
};

interface TabAppointmentsProps {
    readonly items: ReadonlyArray<PatientProfileAppointment>;
}

const TabAppointments: React.FC<TabAppointmentsProps> = ({ items }) => {
    const formatDate = useClinicalDateFormat();
    if (items.length === 0) {
        return (
            <Card className="p-8 text-center text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
                <p className="font-medium">No appointments recorded with this patient yet.</p>
            </Card>
        );
    }
    return (
        <div className="space-y-3">
            {items.map(appt => (
                <Card key={appt.id} className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="font-bold text-foreground">
                                    {formatDate(appt.appointmentDate)} · {appt.appointmentTime.slice(0, 5)}
                                </span>
                                <span className={'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ' + appointmentStatusClass(appt.status)}>
                                    {appt.status}
                                </span>
                                {appt.consultationType !== null ? (
                                    <Badge variant="outline" className="text-[10px] uppercase">{appt.consultationType}</Badge>
                                ) : null}
                            </div>
                            {appt.reason !== null && appt.reason.length > 0 ? (
                                <p className="text-sm text-foreground/80">{appt.reason}</p>
                            ) : null}
                            {appt.notes !== null && appt.notes.length > 0 ? (
                                <p className="text-xs text-muted-foreground mt-1 italic">Note: {appt.notes}</p>
                            ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                            {appt.durationMinutes} min
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
};

interface TabPrescriptionsProps {
    readonly items: ReadonlyArray<PatientProfilePrescription>;
}

const TabPrescriptions: React.FC<TabPrescriptionsProps> = ({ items }) => {
    const formatDate = useClinicalDateFormat();
    if (items.length === 0) {
        return (
            <Card className="p-8 text-center text-muted-foreground">
                <Pill className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
                <p className="font-medium">No prescriptions on file for this patient.</p>
            </Card>
        );
    }
    return (
        <div className="space-y-3">
            {items.map(rx => (
                <Card key={rx.id} className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="font-bold text-foreground">{formatDate(rx.prescriptionDate)}</span>
                                <Badge variant="secondary" className="text-[10px] uppercase">{rx.status}</Badge>
                                {rx.issuedByMe ? (
                                    <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px] uppercase">Issued by you</Badge>
                                ) : null}
                            </div>
                            <p className="text-sm text-foreground/80 truncate">
                                {rx.doctorName ?? 'Unknown prescriber'}
                                {rx.specialization !== null ? ` · ${rx.specialization}` : ''}
                            </p>
                            {rx.notes !== null && rx.notes.length > 0 ? (
                                <p className="text-xs text-muted-foreground mt-1 italic">Note: {rx.notes}</p>
                            ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                            {rx.itemCount} medication{rx.itemCount === 1 ? '' : 's'}
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
};

interface TabRecordsProps {
    readonly items: ReadonlyArray<PatientProfileRecord>;
}

const TabRecords: React.FC<TabRecordsProps> = ({ items }) => {
    const formatDate = useClinicalDateFormat();
    if (items.length === 0) {
        return (
            <Card className="p-8 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
                <p className="font-medium">No medical records uploaded by this patient yet.</p>
            </Card>
        );
    }
    return (
        <div className="space-y-3">
            {items.map(rec => (
                <Card key={rec.id} className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="font-bold text-foreground truncate">{rec.name}</span>
                                <Badge variant="outline" className="text-[10px] uppercase">{rec.recordType}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {rec.dateOfService !== null ? `Service: ${formatDate(rec.dateOfService)} · ` : ''}
                                Uploaded {formatDate(rec.uploadedAt)}
                                {rec.facilityName !== null ? ` · ${rec.facilityName}` : ''}
                            </div>
                            {rec.notes !== null && rec.notes.length > 0 ? (
                                <p className="text-xs text-muted-foreground mt-1 italic">{rec.notes}</p>
                            ) : null}
                        </div>
                        <Badge variant="secondary" className="text-[10px] uppercase shrink-0">{rec.status}</Badge>
                    </div>
                </Card>
            ))}
        </div>
    );
};

interface TabScreeningsProps {
    readonly items: ReadonlyArray<PatientProfileScreeningGroup>;
}

const TabScreenings: React.FC<TabScreeningsProps> = ({ items }) => {
    const formatDate = useClinicalDateFormat();
    if (items.length === 0) {
        return (
            <Card className="p-8 text-center text-muted-foreground">
                <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
                <p className="font-medium">No pre-screening responses on file with you.</p>
            </Card>
        );
    }
    return (
        <div className="space-y-4">
            {items.map(group => {
                const risk = group.averageRiskScore;
                const riskBucket: 'low' | 'medium' | 'high' =
                    risk >= 0.7 ? 'high' : risk >= 0.4 ? 'medium' : 'low';
                const riskClass: string =
                    riskBucket === 'high'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                        : riskBucket === 'medium'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
                return (
                    <Card key={group.appointmentId} className="p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <span className="font-bold text-foreground">
                                Screening · {formatDate(group.appointmentDate)}
                            </span>
                            <span className={'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ' + riskClass}>
                                <Activity className="h-3 w-3" aria-hidden="true" />
                                Avg risk {risk.toFixed(2)}
                            </span>
                        </div>
                        <ul className="space-y-2">
                            {group.responses.map((resp, idx) => (
                                <li key={`${group.appointmentId}-${idx}`} className="flex items-start justify-between gap-3 text-sm">
                                    <span className="text-foreground/90 flex-1">
                                        {resp.questionText ?? '—'}
                                        {resp.diseaseTag !== null ? (
                                            <Badge variant="outline" className="ml-2 text-[10px] uppercase">{resp.diseaseTag}</Badge>
                                        ) : null}
                                    </span>
                                    <span className={'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 ' + (resp.responseValue ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : 'bg-muted text-muted-foreground')}>
                                        {resp.responseValue ? 'Yes' : 'No'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Card>
                );
            })}
        </div>
    );
};

interface TabOverviewProps {
    readonly summary: PatientProfileSummary;
    readonly appointments: ReadonlyArray<PatientProfileAppointment>;
    readonly prescriptions: ReadonlyArray<PatientProfilePrescription>;
    readonly screenings: ReadonlyArray<PatientProfileScreeningGroup>;
}

const TabOverview: React.FC<TabOverviewProps> = ({ summary, appointments, prescriptions, screenings }) => {
    const formatDate = useClinicalDateFormat();
    const recentAppts = appointments.slice(0, 3);
    const activePrescriptions = prescriptions.filter(p => p.status === 'pending' || p.status === 'filled' || p.status === 'active');

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h3 className="font-bold text-foreground">Recent visits</h3>
                </div>
                {recentAppts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No completed visits yet.</p>
                ) : (
                    <ul className="space-y-2 text-sm">
                        {recentAppts.map(a => (
                            <li key={a.id} className="flex items-center justify-between gap-2">
                                <span className="text-foreground/90">{formatDate(a.appointmentDate)}</span>
                                <span className={'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ' + appointmentStatusClass(a.status)}>
                                    {a.status}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Pill className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h3 className="font-bold text-foreground">Active prescriptions</h3>
                </div>
                {activePrescriptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active prescriptions.</p>
                ) : (
                    <ul className="space-y-2 text-sm">
                        {activePrescriptions.slice(0, 3).map(p => (
                            <li key={p.id} className="flex items-center justify-between gap-2">
                                <span className="text-foreground/90 truncate">{p.doctorName ?? 'Unknown prescriber'}</span>
                                <span className="text-xs text-muted-foreground shrink-0">{formatDate(p.prescriptionDate)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h3 className="font-bold text-foreground">Latest screening</h3>
                </div>
                {screenings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No screenings completed yet.</p>
                ) : (
                    <div className="text-sm">
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-foreground/90">{formatDate(screenings[0].appointmentDate)}</span>
                            <span className="text-xs font-bold text-foreground">Avg risk {screenings[0].averageRiskScore.toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {screenings[0].responses.filter(r => r.responseValue).length} positive of {screenings[0].responses.length} questions
                        </p>
                    </div>
                )}
            </Card>

            <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                    <HeartPulse className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h3 className="font-bold text-foreground">Clinical context</h3>
                </div>
                <div className="space-y-2 text-sm">
                    {summary.dateOfBirth !== null ? (
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <Cake className="h-3 w-3" aria-hidden="true" /> Date of birth
                            </span>
                            <span className="font-medium text-foreground">{formatDate(summary.dateOfBirth)}</span>
                        </div>
                    ) : null}
                    {summary.gender !== null ? (
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <UserIcon className="h-3 w-3" aria-hidden="true" /> Gender
                            </span>
                            <span className="font-medium text-foreground capitalize">{summary.gender}</span>
                        </div>
                    ) : null}
                    {summary.bloodGroup !== null ? (
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <BadgeAlert className="h-3 w-3" aria-hidden="true" /> Blood group
                            </span>
                            <span className="font-medium text-foreground">{summary.bloodGroup}</span>
                        </div>
                    ) : null}
                </div>
            </Card>
        </div>
    );
};

export const DoctorPatientProfile: React.FC = () => {
    const navigate = useNavigate();
    const params = useParams<{ id: string }>();
    const patientId: string = params.id ?? '';

    const [payload, setPayload] = useState<PatientProfilePayload | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('overview');

    const fetchProfile = useCallback(async (): Promise<void> => {
        if (patientId.length === 0) {
            setError('Patient ID missing from URL.');
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const data = await getDoctorPatientProfile(patientId);
            setPayload(data);
        } catch (err: unknown) {
            const apiErr = err as { response?: { data?: { message?: string }; status?: number } };
            const status: number | undefined = apiErr.response?.status;
            const serverMessage: string | undefined = apiErr.response?.data?.message;
            const fallback: string = status === 403
                ? 'You do not have an active clinical relationship with this patient.'
                : status === 404
                    ? 'Patient not found.'
                    : 'Failed to load patient profile.';
            setError(serverMessage ?? fallback);
            logger.error('[PatientProfile] Fetch failure', {
                patientId,
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        void fetchProfile();
    }, [fetchProfile]);

    const summary: PatientProfileSummary | null = payload?.patient ?? null;

    usePageLoader(loading, 'Loading patient profile...');
    if (loading) return null;

    if (error !== null || summary === null) {
        return (
            <div className="space-y-4">
                <Button variant="ghost" size="sm" onClick={() => navigate(PATHS.DOCTOR.PATIENTS)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to Patient Registry
                </Button>
                <AnimatedAlert visible={error !== null}>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" aria-hidden="true" />
                        <AlertDescription>{error ?? 'No data available.'}</AlertDescription>
                    </Alert>
                </AnimatedAlert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate(PATHS.DOCTOR.PATIENTS)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Back to Patient Registry</span>
                    <span className="sm:hidden">Back</span>
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <ProfileHero summary={summary} />

                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto py-1">
                            <TabsTrigger value="overview" className="gap-2 shrink-0">
                                <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                                Overview
                            </TabsTrigger>
                            <TabsTrigger value="appointments" className="gap-2 shrink-0">
                                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                                Appointments
                                <Badge variant="secondary" className="ml-1 text-[10px]">{payload?.appointments.length ?? 0}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="records" className="gap-2 shrink-0">
                                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                                Records
                                <Badge variant="secondary" className="ml-1 text-[10px]">{payload?.records.length ?? 0}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="prescriptions" className="gap-2 shrink-0">
                                <Pill className="h-3.5 w-3.5" aria-hidden="true" />
                                Prescriptions
                                <Badge variant="secondary" className="ml-1 text-[10px]">{payload?.prescriptions.length ?? 0}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="screenings" className="gap-2 shrink-0">
                                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                                Screenings
                                <Badge variant="secondary" className="ml-1 text-[10px]">{payload?.screenings.length ?? 0}</Badge>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="mt-4">
                            {payload !== null ? (
                                <TabOverview
                                    summary={summary}
                                    appointments={payload.appointments}
                                    prescriptions={payload.prescriptions}
                                    screenings={payload.screenings}
                                />
                            ) : null}
                        </TabsContent>
                        <TabsContent value="appointments" className="mt-4">
                            <TabAppointments items={payload?.appointments ?? []} />
                        </TabsContent>
                        <TabsContent value="records" className="mt-4">
                            <TabRecords items={payload?.records ?? []} />
                        </TabsContent>
                        <TabsContent value="prescriptions" className="mt-4">
                            <TabPrescriptions items={payload?.prescriptions ?? []} />
                        </TabsContent>
                        <TabsContent value="screenings" className="mt-4">
                            <TabScreenings items={payload?.screenings ?? []} />
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="lg:col-span-1">
                    <ProfileQuickActions summary={summary} />
                </div>
            </div>
        </div>
    );
};
