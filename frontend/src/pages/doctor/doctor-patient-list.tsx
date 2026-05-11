import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Search,
    Calendar,
    ChevronRight,
    Loader2,
    AlertTriangle,
    Activity,
    Sparkles,
    CalendarClock,
    Cake,
    UserCheck,
    Users,
    UserPlus,
    SlidersHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AuthenticatedImage } from '@/components/ui/authenticated-image';
import { Tooltip } from '@/components/ui/tooltip';
import { getInitials } from '@/utils/avatar.resolver';
import {
    getDoctorPatients,
    type Patient,
    type PatientLifecycleStage,
    type PatientRegistryAdvancedFilters,
    type PatientRegistryCounts,
    type PatientRegistryFilter,
} from '@/services/doctor.service';
import { usePageLoader } from '@/hooks/use-page-loader';
import { logger } from '@/utils/logger';
import { PATHS } from '@/routes/paths';
import { AnimatedAlert } from '@/components/ui/animated-alert';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InvitePatientModal } from '@/components/doctor/invite-patient-modal';
import { AdvancedFilterDrawer } from '@/components/doctor/advanced-filter-drawer';
import { countActiveAdvancedFilters } from '@/components/doctor/advanced-filter-utils';

/**
 * Resolves the authenticated-tunnel src for a patient's profile image.
 * Mirrors the navbar's `getUserImage()` resolver — absolute http(s) URLs
 * pass through; otherwise the canonical `/api/files/profile/:id` blob
 * endpoint is constructed from the patient's UUID. Returns '' when the
 * patient has no image so callers can gate `AuthenticatedImage` rendering
 * to avoid its empty-src loading-skeleton trap.
 */
const resolvePatientImageSrc = (patient: Patient): string => {
    const stored: string | null | undefined = patient.profileImage;
    if (stored === null || stored === undefined || stored.length === 0) return '';
    if (stored.startsWith('http')) return stored;
    return `/api/files/profile/${patient.id}`;
};

/**
 * Filter chip catalog — UI STRUCTURE only. Counts come from the backend
 * (counts payload), so the chip badges reflect real database state, not
 * hardcoded numbers. Each chip's `key` matches the typed
 * `PatientRegistryFilter` union exactly — wire-boundary parity with the
 * server-side whitelist.
 */
interface FilterChipDefinition {
    readonly key: PatientRegistryFilter;
    readonly label: string;
    readonly icon: React.ElementType;
    readonly countKey: keyof PatientRegistryCounts;
}

const FILTER_CHIPS: ReadonlyArray<FilterChipDefinition> = [
    { key: 'active', label: 'Active', icon: UserCheck, countKey: 'active' },
    { key: 'lapsed', label: 'Lapsed', icon: CalendarClock, countKey: 'lapsed' },
    { key: 'due-for-follow-up', label: 'Due for follow-up', icon: Activity, countKey: 'dueForFollowUp' },
    { key: 'at-risk', label: 'At-risk', icon: AlertTriangle, countKey: 'atRisk' },
    { key: 'high-acuity', label: 'High acuity', icon: Sparkles, countKey: 'highAcuity' },
    { key: 'birthday-this-month', label: 'Birthday this month', icon: Cake, countKey: 'birthdayThisMonth' },
];

/** Search debounce — keeps the controller off the keystroke hot path. */
const SEARCH_DEBOUNCE_MS = 250;

/** Lifecycle stage → visual treatment. Brand-token based; no hex literals. */
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

interface EmptyStateContext {
    readonly hasAnyPatients: boolean;
    readonly hasActiveSearch: boolean;
    readonly hasActiveFilter: boolean;
    readonly activeFilterLabel: string | null;
}

const buildEmptyStateCopy = (ctx: EmptyStateContext): { title: string; body: string } => {
    if (!ctx.hasAnyPatients) {
        return {
            title: 'No patients yet',
            body: 'Patients you treat will appear here automatically after their first completed consultation.',
        };
    }
    if (ctx.hasActiveSearch && ctx.hasActiveFilter && ctx.activeFilterLabel !== null) {
        return {
            title: 'No matches',
            body: `No "${ctx.activeFilterLabel}" patients matching your search. Try clearing one of the filters above.`,
        };
    }
    if (ctx.hasActiveSearch) {
        return {
            title: 'No matches',
            body: 'No patients match your search. Try a different name, phone, email, or national ID.',
        };
    }
    if (ctx.hasActiveFilter && ctx.activeFilterLabel !== null) {
        return {
            title: `No "${ctx.activeFilterLabel}" patients`,
            body: 'Clear the filter chip above to see your full panel.',
        };
    }
    // Defensive default — should not reach here.
    return {
        title: 'No patients found',
        body: 'Try adjusting your search or filter.',
    };
};

/** Parse advanced filter values out of a URLSearchParams instance.
 *  Lives outside the component so the initial-state hydration and the
 *  state-sync effect read the same canonical shape. Unknown / malformed
 *  values fall through as `undefined`. */
const parseAdvancedFiltersFromUrl = (params: URLSearchParams): PatientRegistryAdvancedFilters => {
    const next: PatientRegistryAdvancedFilters = {};
    const ageMinStr = params.get('ageMin');
    const ageMaxStr = params.get('ageMax');
    const minVisitsStr = params.get('minVisits');
    if (ageMinStr !== null && ageMinStr.length > 0 && Number.isFinite(Number(ageMinStr))) {
        next.ageMin = Number(ageMinStr);
    }
    if (ageMaxStr !== null && ageMaxStr.length > 0 && Number.isFinite(Number(ageMaxStr))) {
        next.ageMax = Number(ageMaxStr);
    }
    if (minVisitsStr !== null && minVisitsStr.length > 0 && Number.isFinite(Number(minVisitsStr))) {
        next.minVisits = Number(minVisitsStr);
    }
    const genderStr = params.get('gender');
    if (genderStr === 'male' || genderStr === 'female' || genderStr === 'other') {
        next.gender = genderStr;
    }
    const bloodGroupStr = params.get('bloodGroup');
    if (bloodGroupStr !== null && /^(A|B|AB|O)[+-]$/.test(bloodGroupStr)) {
        next.bloodGroup = bloodGroupStr as PatientRegistryAdvancedFilters['bloodGroup'];
    }
    const lastVisitFromStr = params.get('lastVisitFrom');
    const lastVisitToStr = params.get('lastVisitTo');
    if (lastVisitFromStr !== null && lastVisitFromStr.length > 0) next.lastVisitFrom = lastVisitFromStr;
    if (lastVisitToStr !== null && lastVisitToStr.length > 0) next.lastVisitTo = lastVisitToStr;
    const sortStr = params.get('sort');
    if (sortStr === 'name' || sortStr === 'last-visit' || sortStr === 'total-visits' || sortStr === 'age') {
        next.sort = sortStr;
    }
    const orderStr = params.get('order');
    if (orderStr === 'asc' || orderStr === 'desc') next.order = orderStr;
    return next;
};

export const DoctorPatientList: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [patients, setPatients] = useState<Patient[]>([]);
    const [counts, setCounts] = useState<PatientRegistryCounts>({
        all: 0,
        active: 0,
        lapsed: 0,
        dueForFollowUp: 0,
        atRisk: 0,
        highAcuity: 0,
        birthdayThisMonth: 0,
    });
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState<string>('');
    const [debouncedSearch, setDebouncedSearch] = useState<string>('');
    const [activeFilter, setActiveFilter] = useState<PatientRegistryFilter | null>(null);

    // Advanced filter state — hydrated once from the URL so a shared link
    // restores the same filtered registry. All mutations route through
    // `applyAdvancedFilters` below which also patches the URL.
    const [advancedFilters, setAdvancedFilters] = useState<PatientRegistryAdvancedFilters>(
        () => parseAdvancedFiltersFromUrl(searchParams)
    );

    const [inviteModalOpen, setInviteModalOpen] = useState<boolean>(false);
    const [filterDrawerOpen, setFilterDrawerOpen] = useState<boolean>(false);

    const activeAdvancedCount: number = useMemo(
        () => countActiveAdvancedFilters(advancedFilters),
        [advancedFilters]
    );

    /** Apply a new set of advanced filters AND patch the URL in a single
     *  pass, so a refresh restores the same view and a tab share carries
     *  the full filter state. */
    const applyAdvancedFilters = useCallback((next: PatientRegistryAdvancedFilters): void => {
        setAdvancedFilters(next);
        const params = new URLSearchParams(searchParams);
        // Strip every advanced-filter key first so removing a dimension
        // doesn't leave stale URL state behind.
        for (const key of ['ageMin', 'ageMax', 'gender', 'bloodGroup', 'minVisits', 'lastVisitFrom', 'lastVisitTo', 'sort', 'order']) {
            params.delete(key);
        }
        if (next.ageMin !== undefined) params.set('ageMin', String(next.ageMin));
        if (next.ageMax !== undefined) params.set('ageMax', String(next.ageMax));
        if (next.gender !== undefined) params.set('gender', next.gender);
        if (next.bloodGroup !== undefined) params.set('bloodGroup', next.bloodGroup);
        if (next.minVisits !== undefined) params.set('minVisits', String(next.minVisits));
        if (next.lastVisitFrom !== undefined && next.lastVisitFrom.length > 0) params.set('lastVisitFrom', next.lastVisitFrom);
        if (next.lastVisitTo !== undefined && next.lastVisitTo.length > 0) params.set('lastVisitTo', next.lastVisitTo);
        // Only persist sort/order when non-default — keeps the URL tidy.
        if (next.sort !== undefined && next.sort !== 'last-visit') params.set('sort', next.sort);
        if (next.order !== undefined && next.order !== 'desc') params.set('order', next.order);
        setSearchParams(params, { replace: true });
    }, [searchParams, setSearchParams]);

    const resetAdvancedFilters = useCallback((): void => {
        applyAdvancedFilters({});
    }, [applyAdvancedFilters]);

    // Debounce the search input so we don't fire a network request per
    // keystroke. The trailing-edge timer is the institutional pattern
    // every Google/Notion-grade search uses.
    useEffect(() => {
        const handle = window.setTimeout(() => {
            setDebouncedSearch(searchInput.trim());
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(handle);
    }, [searchInput]);

    // Single fetcher — re-fires whenever the (debounced) search query OR
    // the active filter chip changes. Counts in the response always
    // reflect the FULL doctor-scoped registry (independent of the active
    // filter) so the chip badges stay stable as the user toggles.
    const fetchRegistry = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            setError(null);
            const response = await getDoctorPatients({
                search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
                filter: activeFilter ?? undefined,
                ...advancedFilters,
            });
            setPatients(response.patients);
            setCounts(response.counts);
        } catch (err: unknown) {
            const message: string = err instanceof Error ? err.message : 'Failed to load patient registry';
            setError(message);
            logger.error('[PatientRegistry] Fetch failure', {
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, activeFilter, advancedFilters]);

    useEffect(() => {
        void fetchRegistry();
    }, [fetchRegistry]);

    const handleChipClick = useCallback((key: PatientRegistryFilter): void => {
        // Single-active filter pattern — clicking the active chip clears it.
        setActiveFilter(prev => (prev === key ? null : key));
    }, []);

    const handleRowClick = useCallback((patientId: string): void => {
        // PATHS.DOCTOR.PATIENT_PROFILE carries a `:id` placeholder; the
        // canonical URL builder simply substitutes. PR #2 of the rollout
        // adds the destination route + page.
        navigate(PATHS.DOCTOR.PATIENT_PROFILE.replace(':id', patientId));
    }, [navigate]);

    const activeFilterLabel: string | null = useMemo(() => {
        if (activeFilter === null) return null;
        const chip = FILTER_CHIPS.find(c => c.key === activeFilter);
        return chip?.label ?? null;
    }, [activeFilter]);

    const emptyCopy = useMemo(
        () =>
            buildEmptyStateCopy({
                hasAnyPatients: counts.all > 0,
                hasActiveSearch: debouncedSearch.length > 0,
                hasActiveFilter: activeFilter !== null,
                activeFilterLabel,
            }),
        [counts.all, debouncedSearch, activeFilter, activeFilterLabel]
    );

    usePageLoader(loading && patients.length === 0, 'Synchronizing with regional patient registry...');
    if (loading && patients.length === 0) return null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="page-heading">Patient Registry</h1>
                    <p className="page-subheading">
                        Patients you have treated appear here automatically after their first completed consultation.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFilterDrawerOpen(true)}
                        aria-label="Open advanced filters"
                    >
                        <SlidersHorizontal className="h-4 w-4 mr-2" aria-hidden="true" />
                        Filters
                        {activeAdvancedCount > 0 ? (
                            <Badge variant="secondary" className="ml-2">
                                {activeAdvancedCount}
                            </Badge>
                        ) : null}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => setInviteModalOpen(true)}
                        aria-label="Invite a new patient"
                    >
                        <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" />
                        Invite patient
                    </Button>
                </div>
            </div>

            <AnimatedAlert visible={error !== null}>
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </AnimatedAlert>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    placeholder="Search by name, email, phone, or national ID..."
                    className="pl-10 h-11"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    aria-label="Search patient registry"
                />
            </div>

            {/* Filter chip row — server-counted, single-active selection. */}
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Patient registry filters">
                {FILTER_CHIPS.map(({ key, label, icon: Icon, countKey }) => {
                    const count: number = counts[countKey];
                    const isActive: boolean = activeFilter === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => handleChipClick(key)}
                            aria-pressed={isActive}
                            className={
                                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all '
                                + (isActive
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : 'bg-card text-foreground border-border hover:bg-muted')
                            }
                        >
                            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{label}</span>
                            <span
                                className={
                                    'inline-flex items-center justify-center min-w-[1.25rem] px-1.5 rounded-full text-xs font-bold '
                                    + (isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground')
                                }
                            >
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="grid gap-4">
                {loading && patients.length > 0 ? (
                    <div className="flex items-center justify-center py-6 text-muted-foreground" role="status" aria-live="polite">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                        <span className="text-sm font-medium">Updating registry…</span>
                    </div>
                ) : null}

                {patients.length > 0 ? (
                    patients.map((patient) => {
                        const lifecycleMeta = patient.lifecycleStage !== undefined
                            ? lifecycleStageMeta[patient.lifecycleStage]
                            : null;
                        return (
                            <Card
                                key={patient.id}
                                className="p-4 hover:shadow-md transition-all group border-border/40 overflow-hidden relative cursor-pointer"
                                onClick={() => handleRowClick(patient.id)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleRowClick(patient.id);
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label={`Open ${patient.name}'s profile`}
                            >
                                <div className="flex items-center justify-between gap-4 relative z-10">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <Avatar className="h-12 w-12 rounded-2xl shrink-0 border-0 overflow-hidden">
                                            {patient.profileImage !== null && patient.profileImage !== undefined && patient.profileImage.length > 0 ? (
                                                <AuthenticatedImage
                                                    src={resolvePatientImageSrc(patient)}
                                                    alt={patient.name}
                                                    className="object-cover w-full h-full rounded-2xl"
                                                    errorFallback={
                                                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg rounded-2xl border-0">
                                                            {getInitials(patient.name)}
                                                        </AvatarFallback>
                                                    }
                                                />
                                            ) : (
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg rounded-2xl border-0">
                                                    {getInitials(patient.name)}
                                                </AvatarFallback>
                                            )}
                                        </Avatar>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                                                    {patient.name}
                                                </h3>
                                                {lifecycleMeta !== null ? (
                                                    <span
                                                        className={
                                                            'inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide '
                                                            + lifecycleMeta.className
                                                        }
                                                    >
                                                        {lifecycleMeta.label}
                                                    </span>
                                                ) : null}
                                                {patient.acuityLevel === 'high' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-900">
                                                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                                                        High acuity
                                                    </span>
                                                ) : null}
                                                {patient.isBirthdayThisMonth === true ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-900">
                                                        <Cake className="h-3 w-3" aria-hidden="true" />
                                                        Birthday this month
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                                                <span className="truncate">{patient.email || 'No email'}</span>
                                                <span aria-hidden="true">•</span>
                                                <span className="font-medium text-foreground/80">{patient.phoneNumber}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="hidden md:block text-right">
                                            <div className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-1">
                                                Last Visit
                                            </div>
                                            <div className="text-sm font-bold flex items-center gap-2 justify-end">
                                                <Calendar className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                                {patient.lastVisit
                                                    ? new Date(patient.lastVisit).toLocaleDateString('en-GB')
                                                    : 'N/A'}
                                            </div>
                                        </div>
                                        <Badge
                                            variant="secondary"
                                            className="uppercase text-[10px] font-black tracking-widest px-2.5 py-1 shrink-0"
                                        >
                                            {patient.totalAppointments} Appts
                                        </Badge>
                                        <Tooltip content="View full patient profile" side="left">
                                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--card-radius)] border border-border text-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all">
                                                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                            </span>
                                        </Tooltip>
                                    </div>
                                </div>
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors" aria-hidden="true" />
                            </Card>
                        );
                    })
                ) : (
                    !loading ? (
                        <div className="text-center py-20 border-2 border-dashed rounded-[var(--card-radius)] bg-muted/30">
                            <div className="h-16 w-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Users className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                            </div>
                            <h3 className="font-bold text-lg text-foreground">{emptyCopy.title}</h3>
                            <p className="text-muted-foreground mt-1 max-w-md mx-auto px-4">{emptyCopy.body}</p>
                        </div>
                    ) : null
                )}
            </div>

            <InvitePatientModal
                open={inviteModalOpen}
                onOpenChange={setInviteModalOpen}
            />

            <AdvancedFilterDrawer
                open={filterDrawerOpen}
                onOpenChange={setFilterDrawerOpen}
                initialFilters={advancedFilters}
                onApply={applyAdvancedFilters}
                onReset={resetAdvancedFilters}
            />
        </div>
    );
};
