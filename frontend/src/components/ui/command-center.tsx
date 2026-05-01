import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandSeparator
} from './command';
import {
    Search,
    Calendar,
    FileText,
    Settings,
    Activity,
    Clock,
    ArrowRight,
    ClipboardList,
    Package,
    ShieldCheck,
    LayoutDashboard,
    Stethoscope,
    Users,
    Lock,
    Heart,
    PillBottle,
    Video,
    BookOpen,
    HelpCircle,
    UserCog,
    LogIn
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { PATHS } from '../../routes/paths';
import { getRecentRoutes, recordRouteVisit } from '../../utils/recent-routes';

/**
 * 🩺 HAEMI COMMAND PALETTE (Cmd+K Search Hub)
 *
 * Linear / Notion / VS Code-grade keyboard-driven navigation. The entire
 * route surface is auto-indexed via `COMMAND_REGISTRY` (typed against
 * `PATHS` so a route rename surfaces here as a TypeScript error rather
 * than silent drift). Role-filtering keeps the palette context-aware —
 * a doctor doesn't see the patient appointment-booking action and vice
 * versa.
 *
 * Visual concerns are entirely delegated to the `haemi-cmdk-*` class
 * family in `index.css`. This file carries zero inline styles, zero
 * pixel values, zero hardcoded `slate-*` / `gray-*` color utilities —
 * every visual binds to a brand semantic token (`--sidebar-active`,
 * `--card`, `--muted`, `--muted-foreground`, `--border`,
 * `--card-radius`, motion tokens) so light + dark themes auto-resolve
 * without any `dark:` variants in this component.
 *
 * Recent visits are read from localStorage via `getRecentRoutes()` and
 * matched back against the registry so the displayed labels stay in
 * sync with route renames automatically.
 */

type CommandRole = 'patient' | 'doctor' | 'pharmacist' | 'admin';

interface CommandEntry {
    /** Stable identifier so React keys + recent-route reconciliation are deterministic. */
    readonly id: string;
    /** Human-readable label rendered in the palette. */
    readonly label: string;
    /** Short clarifier shown beneath the label (route context, brief description). */
    readonly description: string;
    /** Lucide icon component. */
    readonly icon: React.ElementType;
    /** Concrete route the entry navigates to. */
    readonly path: string;
    /** Roles permitted to see + activate this entry. Empty = available to all authenticated users. */
    readonly roles: readonly CommandRole[];
    /** Search keywords beyond the label (e.g. synonyms, abbreviations). cmdk uses these for matching. */
    readonly keywords?: readonly string[];
    /** Logical bucket for the categorized rendering. */
    readonly section: 'pages' | 'actions' | 'admin';
}

/**
 * The single source of truth for the palette catalog. Each entry maps to
 * a real `PATHS.*` member so a route rename in `paths.ts` surfaces here
 * as a TypeScript error — eliminating the silent-drift class of bug
 * where the sidebar gains a new page but the palette never finds out.
 */
const COMMAND_REGISTRY: readonly CommandEntry[] = [
    // ─── Universal pages (every authenticated user sees these) ─────────
    { id: 'dashboard', label: 'Dashboard', description: 'Your role-specific home hub', icon: LayoutDashboard, path: PATHS.DASHBOARD, roles: [], keywords: ['home', 'overview', 'main'], section: 'pages' },
    { id: 'profile', label: 'Profile', description: 'Personal details and avatar', icon: UserCog, path: PATHS.PROFILE, roles: [], keywords: ['account', 'me'], section: 'pages' },
    { id: 'settings', label: 'Settings', description: 'Preferences and configuration', icon: Settings, path: PATHS.SETTINGS, roles: [], keywords: ['preferences', 'config', 'options'], section: 'pages' },
    { id: 'help', label: 'Help & Support', description: 'Documentation and contact', icon: HelpCircle, path: PATHS.HELP, roles: [], keywords: ['support', 'docs', 'faq'], section: 'pages' },

    // ─── Patient ───────────────────────────────────────────────────────
    { id: 'patient-appointments', label: 'My Appointments', description: 'Upcoming and past consultations', icon: Calendar, path: PATHS.PATIENT.APPOINTMENTS, roles: ['patient'], keywords: ['booking', 'visits'], section: 'pages' },
    { id: 'patient-book', label: 'Book Appointment', description: 'Schedule a new consultation', icon: Calendar, path: PATHS.PATIENT.BOOK_APPOINTMENT, roles: ['patient'], keywords: ['new', 'schedule', 'create'], section: 'actions' },
    { id: 'patient-prescriptions', label: 'My Prescriptions', description: 'Active and historical medications', icon: PillBottle, path: PATHS.PATIENT.PRESCRIPTIONS, roles: ['patient'], keywords: ['rx', 'medication', 'meds'], section: 'pages' },
    { id: 'patient-records', label: 'Medical Records', description: 'Lab results and clinical history', icon: FileText, path: PATHS.PATIENT.MEDICAL_RECORDS, roles: ['patient'], keywords: ['ehr', 'history', 'labs'], section: 'pages' },
    { id: 'patient-find-doctors', label: 'Find Specialists', description: 'Browse certified clinicians', icon: Stethoscope, path: PATHS.PATIENT.FIND_DOCTORS, roles: ['patient'], keywords: ['doctors', 'physicians', 'directory'], section: 'pages' },
    { id: 'telemedicine', label: 'Telemedicine', description: 'Secure video consultations', icon: Video, path: PATHS.TELEMEDICINE, roles: ['patient'], keywords: ['video', 'call', 'remote'], section: 'pages' },

    // ─── Doctor ────────────────────────────────────────────────────────
    { id: 'doctor-schedule', label: 'My Schedule', description: 'Daily availability and appointments', icon: Clock, path: PATHS.DOCTOR.SCHEDULE, roles: ['doctor'], keywords: ['calendar', 'day', 'agenda'], section: 'pages' },
    { id: 'doctor-patients', label: 'Patient List', description: 'Active panel and case load', icon: Heart, path: PATHS.DOCTOR.PATIENTS, roles: ['doctor'], keywords: ['panel', 'caseload', 'roster'], section: 'pages' },
    { id: 'doctor-reports', label: 'Clinical Reports', description: 'Performance analytics and trends', icon: BookOpen, path: PATHS.DOCTOR.REPORTS, roles: ['doctor'], keywords: ['analytics', 'insights', 'metrics'], section: 'pages' },

    // ─── Pharmacist ───────────────────────────────────────────────────
    { id: 'pharmacist-queue', label: 'Prescription Queue', description: 'Pending dispense requests', icon: ClipboardList, path: PATHS.PHARMACIST.QUEUE, roles: ['pharmacist'], keywords: ['rx', 'pending', 'workflow'], section: 'pages' },
    { id: 'pharmacist-inventory', label: 'Inventory', description: 'Stock levels and reorder thresholds', icon: Package, path: PATHS.PHARMACIST.INVENTORY, roles: ['pharmacist'], keywords: ['stock', 'medications', 'supply'], section: 'pages' },
    { id: 'pharmacist-dispense', label: 'Dispense Workspace', description: 'Active dispensing surface', icon: PillBottle, path: PATHS.PHARMACIST.DISPENSE, roles: ['pharmacist'], keywords: ['dispense', 'fill', 'prepare'], section: 'pages' },

    // ─── Admin ────────────────────────────────────────────────────────
    { id: 'admin-dashboard', label: 'System Health', description: 'Operational overview', icon: Activity, path: PATHS.ADMIN.DASHBOARD, roles: ['admin'], keywords: ['ops', 'status', 'health'], section: 'pages' },
    { id: 'admin-users', label: 'User Management', description: 'Accounts, roles, status', icon: Users, path: PATHS.ADMIN.USERS, roles: ['admin'], keywords: ['accounts', 'permissions', 'people'], section: 'admin' },
    { id: 'admin-verify-doctors', label: 'Verify Doctors', description: 'Pending clinician approvals', icon: ShieldCheck, path: PATHS.ADMIN.VERIFY_DOCTORS, roles: ['admin'], keywords: ['approve', 'credentials', 'verification'], section: 'admin' },
    { id: 'admin-screening', label: 'Manage Screening', description: 'Pre-consult triage configuration', icon: ClipboardList, path: PATHS.ADMIN.SCREENING, roles: ['admin'], keywords: ['triage', 'questions', 'forms'], section: 'admin' },
    { id: 'admin-logs', label: 'Audit Logs', description: 'System activity forensics', icon: BookOpen, path: PATHS.ADMIN.SYSTEM_LOGS, roles: ['admin'], keywords: ['forensics', 'audit', 'events'], section: 'admin' },
    { id: 'admin-security', label: 'Security Observability', description: 'Real-time threat surface', icon: Lock, path: PATHS.ADMIN.SECURITY, roles: ['admin'], keywords: ['threats', 'monitoring', 'observability'], section: 'admin' },
    { id: 'admin-sessions', label: 'Live Sessions', description: 'Active institutional access tokens', icon: LogIn, path: PATHS.ADMIN.SESSIONS, roles: ['admin'], keywords: ['tokens', 'sessions', 'active'], section: 'admin' },
] as const;

const isCommandRole = (value: string | undefined): value is CommandRole =>
    value === 'patient' || value === 'doctor' || value === 'pharmacist' || value === 'admin';

export const CommandCenter: React.FC = () => {
    const [open, setOpen] = useState<boolean>(false);
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent): void => {
            // Strict capture: Cmd/Ctrl + K only. Avoid swallowing system
            // shortcuts that also use the meta key.
            if (event.key?.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                setOpen(prev => !prev);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Record every authenticated route visit into the localStorage ring
    // buffer. CommandCenter is mounted exclusively in the authenticated
    // app shell, so `location.pathname` here is always a post-login
    // route — no login/signup pollution. Recording lives here (rather
    // than inside `<App>`) because the palette itself owns the ring
    // buffer's lifecycle: read on open, write on navigate.
    useEffect(() => {
        recordRouteVisit(location.pathname);
    }, [location.pathname]);

    const runCommand = (path: string): void => {
        setOpen(false);
        navigate(path);
    };

    /** Active role-aware slice of the registry. Pre-extracting `userRole`
     *  into a stable local before the hook keeps the dependency array a
     *  flat scalar (`string | undefined`), which the React Compiler can
     *  preserve when auto-memoizing — optional chaining inside the
     *  dependency expression itself defeats the compiler's analysis. */
    const userRole = user?.role;
    const visibleEntries = useMemo((): readonly CommandEntry[] => {
        const role = isCommandRole(userRole) ? userRole : null;
        return COMMAND_REGISTRY.filter(entry => {
            if (entry.roles.length === 0) return true; // universal
            if (role === null) return false;
            return entry.roles.includes(role);
        });
    }, [userRole]);

    /** Hydrate recent visits and resolve them against the registry so the
     *  rendered label stays in sync with route renames automatically. */
    const recentEntries = useMemo<readonly CommandEntry[]>(() => {
        if (!open) return [];
        const recents = getRecentRoutes();
        const byPath = new Map<string, CommandEntry>();
        for (const entry of visibleEntries) {
            byPath.set(entry.path, entry);
        }
        const resolved: CommandEntry[] = [];
        for (const recent of recents) {
            // Skip the page the user is currently on — they don't need to
            // "navigate" to where they already are.
            if (recent.path === location.pathname) continue;
            const entry = byPath.get(recent.path);
            if (entry) resolved.push(entry);
        }
        return resolved.slice(0, 5);
    }, [open, visibleEntries, location.pathname]);

    const pageEntries = useMemo(
        () => visibleEntries.filter(e => e.section === 'pages'),
        [visibleEntries]
    );
    const actionEntries = useMemo(
        () => visibleEntries.filter(e => e.section === 'actions'),
        [visibleEntries]
    );
    const adminEntries = useMemo(
        () => visibleEntries.filter(e => e.section === 'admin'),
        [visibleEntries]
    );

    /** Concatenate label + description + keywords into the value cmdk
     *  scores against. Without this, cmdk only matches the visible label,
     *  so e.g. typing "rx" against "My Prescriptions" would miss. */
    const buildSearchValue = (entry: CommandEntry): string => {
        const keywordPart = entry.keywords?.join(' ') ?? '';
        return `${entry.label} ${entry.description} ${keywordPart}`.toLowerCase();
    };

    const renderItem = (entry: CommandEntry): React.ReactElement => {
        const Icon = entry.icon;
        return (
            <CommandItem
                key={entry.id}
                value={buildSearchValue(entry)}
                onSelect={() => runCommand(entry.path)}
                className="haemi-cmdk-item"
            >
                <span className="haemi-cmdk-item-icon">
                    <Icon className="haemi-cmdk-item-icon-svg" aria-hidden="true" />
                </span>
                <span className="haemi-cmdk-item-body">
                    <span className="haemi-cmdk-item-label">{entry.label}</span>
                    <span className="haemi-cmdk-item-meta">{entry.description}</span>
                </span>
                <ArrowRight className="haemi-cmdk-item-arrow" aria-hidden="true" />
            </CommandItem>
        );
    };

    return (
        <>
            {/* Mobile trigger — icon only, visible below md breakpoint. */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="haemi-cmdk-trigger-mobile flex md:hidden haemi-ignore-click-outside"
                aria-label="Open Search Hub"
            >
                <Search className="haemi-cmdk-trigger-icon" aria-hidden="true" />
            </button>

            {/* Desktop trigger — full capsule with shortcut hint. */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="haemi-cmdk-trigger-desktop hidden md:inline-flex haemi-ignore-click-outside"
                aria-label="Open Search Hub"
            >
                <Search className="haemi-cmdk-trigger-icon" aria-hidden="true" />
                <span className="haemi-cmdk-trigger-label">Search Hub...</span>
                <kbd className="haemi-cmdk-trigger-kbd" aria-hidden="true">
                    <span>⌘</span>K
                </kbd>
            </button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Search pages, actions, or recent..." />
                <CommandList className="scrollbar-hide">
                    <CommandEmpty className="haemi-cmdk-empty">
                        Nothing matches your search. Try a different keyword or page name.
                    </CommandEmpty>

                    {recentEntries.length > 0 ? (
                        <>
                            <CommandGroup heading="Recent">
                                {recentEntries.map(renderItem)}
                            </CommandGroup>
                            <CommandSeparator />
                        </>
                    ) : null}

                    {pageEntries.length > 0 ? (
                        <CommandGroup heading="Pages">
                            {pageEntries.map(renderItem)}
                        </CommandGroup>
                    ) : null}

                    {actionEntries.length > 0 ? (
                        <>
                            <CommandSeparator />
                            <CommandGroup heading="Actions">
                                {actionEntries.map(renderItem)}
                            </CommandGroup>
                        </>
                    ) : null}

                    {adminEntries.length > 0 ? (
                        <>
                            <CommandSeparator />
                            <CommandGroup heading="Administration">
                                {adminEntries.map(renderItem)}
                            </CommandGroup>
                        </>
                    ) : null}
                </CommandList>

                <div className="haemi-cmdk-footer">
                    <div className="haemi-cmdk-footer-left">
                        <span className="haemi-cmdk-footer-hint">
                            <kbd className="haemi-cmdk-footer-kbd">↵</kbd> Select
                        </span>
                        <span className="haemi-cmdk-footer-hint">
                            <kbd className="haemi-cmdk-footer-kbd">↑↓</kbd> Navigate
                        </span>
                        <span className="haemi-cmdk-footer-hint">
                            <kbd className="haemi-cmdk-footer-kbd">esc</kbd> Close
                        </span>
                    </div>
                    <div className="haemi-cmdk-footer-version">haemi command line v2.0</div>
                </div>
            </CommandDialog>
        </>
    );
};
