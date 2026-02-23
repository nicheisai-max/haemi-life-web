import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    TrendingUp,
    User,
    Calendar,
    FileText,
    Settings,
    Activity,
    Clock,
    ArrowRight,
    Sparkles,
    MapPin,
    Pill,
    ClipboardList,
    Package,
    ShieldCheck,
    X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from './badge';
import { PATHS } from '../../routes/paths';

export const CommandCenter: React.FC = () => {
    const [open, setOpen] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const runCommand = (command: () => void) => {
        setOpen(false);
        command();
    };

    const trendingBotswana = [
        { label: "Flu trends in Gaborone", icon: TrendingUp, color: "text-blue-500" },
        { label: "Dr. Modise Availability", icon: Calendar, color: "text-emerald-500" },
        { label: "Medication stock Maun", icon: Pill, color: "text-amber-500" },
    ];

    const quickActions = [
        // Patient
        { label: "Book Appointment", icon: Calendar, path: PATHS.PATIENT.BOOK_APPOINTMENT, role: ["patient"] },
        { label: "My Appointments", icon: Calendar, path: PATHS.PATIENT.APPOINTMENTS, role: ["patient"] },
        { label: "My Prescriptions", icon: FileText, path: PATHS.PATIENT.PRESCRIPTIONS, role: ["patient"] },

        // Doctor
        { label: "My Schedule", icon: Clock, path: PATHS.DOCTOR.SCHEDULE, role: ["doctor"] },
        { label: "Patient List", icon: User, path: PATHS.DOCTOR.PATIENTS, role: ["doctor"] },

        // Pharmacist
        { label: "Prescription Queue", icon: ClipboardList, path: PATHS.PHARMACIST.QUEUE, role: ["pharmacist"] },
        { label: "Inventory", icon: Package, path: PATHS.PHARMACIST.INVENTORY, role: ["pharmacist"] },

        // Admin
        { label: "System Health", icon: Activity, path: PATHS.ADMIN.DASHBOARD, role: ["admin"] },
        { label: "User Management", icon: Settings, path: PATHS.ADMIN.USERS, role: ["admin"] },
        { label: "Verify Doctors", icon: ShieldCheck, path: PATHS.ADMIN.VERIFY_DOCTORS, role: ["admin"] },
        { label: "System Logs", icon: ClipboardList, path: PATHS.ADMIN.SYSTEM_LOGS, role: ["admin"] },
    ].filter(action => action.role.includes(user?.role || ''));

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="hidden md:flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all border border-transparent hover:border-primary/20 group w-64 lg:w-80 shadow-inner"
            >
                <Search className="h-4 w-4 text-slate-500 group-hover:text-primary transition-colors" />
                <span className="text-sm font-bold text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Search Hub...</span>
                <kbd className="ml-auto pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border bg-white dark:bg-slate-900 px-1.5 font-mono text-[10px] font-medium text-slate-400 group-hover:text-primary transition-colors opacity-100">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Type a command or search Botswana health trends..." />
                <CommandList className="scrollbar-hide">
                    <CommandEmpty>No results found.</CommandEmpty>

                    <CommandGroup heading="Trending in Botswana 🇧🇼">
                        {trendingBotswana.map((item, i) => (
                            <CommandItem
                                key={i}
                                onSelect={() => console.log(item.label)}
                                className="flex items-center gap-3 py-4 cursor-default group aria-selected:bg-accent/50 aria-selected:text-accent-foreground transition-all duration-200 rounded-xl mx-1"
                            >
                                <div className={`p-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 group-aria-selected:bg-white dark:group-aria-selected:bg-slate-900 transition-colors shadow-sm`}>
                                    <item.icon className={`h-5 w-5 ${item.color}`} />
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-slate-700 dark:text-slate-100 flex items-center gap-2 group-aria-selected:text-primary transition-colors">
                                        {item.label}
                                        <Sparkles className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 group-aria-selected:opacity-100 transition-all" />
                                    </div>
                                    <div className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-tight">Real-time demographic data</div>
                                </div>
                                <Badge variant="secondary" className="bg-slate-100/50 dark:bg-slate-800/50 dark:text-slate-400 text-[10px] font-black uppercase group-aria-selected:bg-primary group-aria-selected:text-white transition-colors">Trending</Badge>
                            </CommandItem>
                        ))}
                    </CommandGroup>

                    <CommandSeparator />

                    <CommandGroup heading="Quick Intelligence">
                        {quickActions.map((action, i) => (
                            <CommandItem
                                key={i}
                                onSelect={() => runCommand(() => navigate(action.path))}
                                className="flex items-center gap-3 py-4 cursor-pointer group aria-selected:bg-primary/10 transition-all rounded-xl mx-1"
                            >
                                <div className="p-2 rounded-xl bg-primary/10 text-primary group-aria-selected:bg-primary group-aria-selected:text-white transition-all shadow-sm">
                                    <action.icon className="h-5 w-5" />
                                </div>
                                <div className="font-bold text-slate-700 dark:text-slate-100 group-aria-selected:text-primary transition-colors">{action.label}</div>
                                <ArrowRight className="ml-auto h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 group-aria-selected:opacity-100 group-hover:translate-x-1 transition-all" />
                            </CommandItem>
                        ))}
                    </CommandGroup>

                    <CommandSeparator />

                    <CommandGroup heading="Global Registry">
                        <CommandItem className="flex items-center gap-3 py-4 opacity-60 cursor-default">
                            <MapPin className="h-5 w-5 text-slate-400" />
                            <span className="font-bold">Princess Marina Hospital, Gaborone</span>
                        </CommandItem>
                        <CommandItem className="flex items-center gap-3 py-4 opacity-60 cursor-default">
                            <MapPin className="h-5 w-5 text-slate-400" />
                            <span className="font-bold">Bokamoso Private Hospital, Mmopane</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
                <div className="p-4 border-t bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1"><kbd className="bg-white dark:bg-slate-800 p-1 rounded border">↵</kbd> Select</span>
                        <span className="flex items-center gap-1"><kbd className="bg-white dark:bg-slate-800 p-1 rounded border">↑↓</kbd> Navigate</span>
                    </div>
                    <div className="text-primary italic font-black lowercase tracking-normal">haemi command line v1.0.4</div>
                </div>
            </CommandDialog>
        </>
    );
};
