import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Search,
    Calendar,
    MessageSquare,
    ChevronRight,
    Filter,
    Plus,
    Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/utils/avatar.resolver';
import { getDoctorPatients, Patient } from '@/services/doctor.service';
import { toast } from 'sonner';
import { MedicalLoader } from '@/components/ui/medical-loader';


export const DoctorPatientList: React.FC = () => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    React.useEffect(() => {
        const fetchPatients = async () => {
            try {
                const data = await getDoctorPatients();
                setPatients(data);
            } catch (error) {
                console.error('Error fetching patients:', error);
                toast.error('Failed to load patient registry');
            } finally {
                setLoading(false);
            }
        };
        fetchPatients();
    }, []);

    const filteredPatients = patients.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.email?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return <MedicalLoader message="Synchronizing with regional patient registry..." />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="page-heading">Patient Registry</h1>
                    <p className="page-subheading">Manage and monitor your assigned patients in Botswana.</p>
                </div>
                <Button className="shrink-0 flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:brightness-110 shadow-lg shadow-teal-900/20 border-0 transition-all duration-300">
                    <Plus className="h-4 w-4" /> Add New Patient
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, condition, or Omang..."
                        className="pl-10 h-11"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button variant="outline" className="h-11 gap-2">
                    <Filter className="h-4 w-4" /> Filters
                </Button>
            </div>

            <div className="grid gap-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-slate-50/50 dark:bg-slate-900/10 rounded-3xl border-2 border-dashed">
                        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                        <p className="font-medium">Syncing with patient registry...</p>
                    </div>
                ) : (
                    filteredPatients.map((patient) => (
                        <Card key={patient.id} className="p-4 hover:shadow-md transition-all group border-border/40 overflow-hidden relative">
                            <div className="flex items-center justify-between gap-4 relative z-10">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-12 w-12 rounded-2xl shrink-0 border-0">
                                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg rounded-2xl border-0">
                                            {getInitials(patient.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                                            {patient.name}
                                        </h3>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span>{patient.email || 'No email'}</span>
                                            <span>•</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">{patient.phoneNumber}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="hidden md:block text-right">
                                        <div className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Last Visit</div>
                                        <div className="text-sm font-bold flex items-center gap-2 justify-end">
                                            <Calendar className="h-3.5 w-3.5 text-primary" />
                                            {patient.lastVisit ? new Date(patient.lastVisit).toLocaleDateString('en-GB') : 'N/A'}
                                        </div>
                                    </div>
                                    <Badge
                                        variant="secondary"
                                        className="uppercase text-[10px] font-black tracking-widest px-2.5 py-1"
                                    >
                                        {patient.totalAppointments} Appts
                                    </Badge>
                                    <div className="flex items-center gap-2 border-l border-border/40 pl-4">
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-[var(--card-radius)] hover:bg-primary/10 hover:text-primary">
                                            <MessageSquare className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="outline" className="h-9 w-9 rounded-[var(--card-radius)] group-hover:bg-primary group-hover:text-white transition-all">
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors" />
                        </Card>
                    ))
                )}

                {!loading && filteredPatients.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed rounded-3xl bg-slate-50/50 dark:bg-slate-900/10">
                        <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Search className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-bold text-lg">No patients found</h3>
                        <p className="text-muted-foreground">Try adjusting your search or contact support if this is an error.</p>
                    </div>
                )}

            </div>
        </div>
    );
};
