import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getDoctors, getSpecializations } from '../../services/doctor.service';
import type { DoctorProfile } from '../../services/doctor.service';
import { AlertCircle, Search, SearchX, User, BadgeCheck, BadgeInfo, Briefcase, ChevronDown, CheckCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MedicalLoader } from '../../components/ui/MedicalLoader';
import { TransitionItem } from '../../components/layout/PageTransition';
import { PATHS } from '../../routes/paths';
import { motion, AnimatePresence } from 'framer-motion';

export const FindDoctors: React.FC = () => {
    const navigate = useNavigate();
    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [filteredDoctors, setFilteredDoctors] = useState<DoctorProfile[]>([]);
    const [specializations, setSpecializations] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSpecialization, setSelectedSpecialization] = useState('all');

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        filterDoctors();
    }, [searchTerm, selectedSpecialization, doctors]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [doctorsData, specializationsData] = await Promise.all([
                getDoctors(),
                getSpecializations()
            ]);
            setDoctors(doctorsData);
            setFilteredDoctors(doctorsData);
            setSpecializations(specializationsData);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load specialists');
        } finally {
            setLoading(false);
        }
    };

    const filterDoctors = () => {
        let filtered = doctors;

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(doc =>
                doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                doc.specialization.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filter by specialization
        if (selectedSpecialization !== 'all') {
            filtered = filtered.filter(doc => doc.specialization === selectedSpecialization);
        }

        setFilteredDoctors(filtered);
    };

    const handleBookAppointment = (doctorId: string | number) => {
        navigate(`${PATHS.PATIENT.BOOK_APPOINTMENT}?doctorId=${doctorId}`);
    };

    if (loading) {
        return (
            <div className="max-w-[1920px] mx-auto p-8 flex justify-center items-center min-h-[400px]">
                <MedicalLoader message="Retrieving Specialist Directory..." />
            </div>
        );
    }

    return (
        <div className="max-w-[1920px] mx-auto p-6 md:p-8">
            <TransitionItem className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Find Specialists</h1>
                <p className="text-muted-foreground">Search for verified healthcare professionals and book appointments</p>
            </TransitionItem>

            {error && (
                <Alert variant="destructive" className="mb-6">
                    <div className="flex-shrink-0 flex items-center justify-center">
                        <AlertCircle className="h-4 w-4" />
                    </div>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <TransitionItem>
                {/* Search and Filters */}
                <Card className="mb-8 border-border/40 shadow-lg shadow-primary/5 bg-card/50 backdrop-blur-xl rounded-3xl overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    type="text"
                                    placeholder="Search by name or specialization..."
                                    className="pl-11 h-12 rounded-full border-slate-200 dark:border-slate-800 focus-visible:ring-primary/20 transition-all font-medium"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="w-full md:w-[280px]">
                                <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full h-12 rounded-full border-slate-200 dark:border-slate-800 px-5 justify-between font-normal hover:bg-transparent shadow-none"
                                        >
                                            {selectedSpecialization === 'all' ? 'All Specializations' : selectedSpecialization}
                                            <ChevronDown className="h-4 w-4 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        className="w-[280px] rounded-[32px] border-slate-200 dark:border-slate-800 p-0 overflow-hidden bg-card/95 backdrop-blur-3xl shadow-2xl"
                                    >
                                        <ScrollArea className="h-[280px] w-full">
                                            <div className="p-2.5 flex flex-col gap-1.5">
                                                <DropdownMenuItem
                                                    onSelect={() => setSelectedSpecialization('all')}
                                                    className={`px-4 py-3 rounded-2xl cursor-pointer font-medium flex items-center justify-between transition-colors ${selectedSpecialization === 'all'
                                                        ? 'bg-primary/10 text-primary'
                                                        : 'hover:bg-muted text-foreground'
                                                        }`}
                                                >
                                                    All Specializations
                                                    {selectedSpecialization === 'all' && (
                                                        <CheckCircle className="h-4 w-4 text-primary" />
                                                    )}
                                                </DropdownMenuItem>
                                                {specializations.map(spec => (
                                                    <DropdownMenuItem
                                                        key={spec}
                                                        onSelect={() => setSelectedSpecialization(spec)}
                                                        className={`px-4 py-3 rounded-2xl cursor-pointer font-medium flex items-center justify-between transition-colors ${selectedSpecialization === spec
                                                            ? 'bg-primary/10 text-primary'
                                                            : 'hover:bg-muted text-foreground'
                                                            }`}
                                                    >
                                                        {spec}
                                                        {selectedSpecialization === spec && (
                                                            <CheckCircle className="h-4 w-4 text-primary" />
                                                        )}
                                                    </DropdownMenuItem>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Results Count */}
                <div className="mb-6 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <p className="text-muted-foreground font-medium">
                        {filteredDoctors.length} specialist{filteredDoctors.length !== 1 ? 's' : ''} found
                    </p>
                </div>

                {/* Specialists Grid */}
                <motion.div
                    layout
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    <AnimatePresence mode="popLayout">
                        {filteredDoctors.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="col-span-full"
                            >
                                <Card className="p-12 text-center flex flex-col items-center justify-center bg-muted/30 border-dashed">
                                    <div className="bg-muted p-4 rounded-full mb-4">
                                        <SearchX className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-foreground">No specialists found</h3>
                                    <p className="text-muted-foreground mt-1 max-w-sm">
                                        We couldn't find any specialists matching your search criteria. Try adjusting your filters.
                                    </p>
                                </Card>
                            </motion.div>
                        ) : (
                            filteredDoctors.map((doctor, index) => (
                                <motion.div
                                    key={doctor.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: "-50px" }}
                                    transition={{ duration: 0.4, delay: index * 0.05 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    layout
                                >
                                    <Card className="group h-full hover:shadow-xl dark:hover:shadow-primary/5 transition-all duration-300 border-border/60 hover:border-primary/20 dark:hover:border-primary/50 bg-card dark:hover:bg-slate-800/50 overflow-hidden">
                                        <CardHeader className="flex flex-row justify-between items-start pb-2">
                                            <div className="w-16 h-16 rounded-full bg-primary/10 dark:bg-primary/5 flex items-center justify-center text-primary border-2 border-primary/30 dark:border-primary/40 shadow-lg dark:shadow-primary/20 ring-2 ring-primary/10 dark:ring-primary/15 transition-transform group-hover:scale-110 duration-300">
                                                <User className="h-8 w-8" />
                                            </div>
                                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 gap-1.5 px-2.5 py-1">
                                                <BadgeCheck className="h-3.5 w-3.5" />
                                                Verified
                                            </Badge>
                                        </CardHeader>

                                        <CardContent className="space-y-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{doctor.name}</h3>
                                                <p className="text-sm font-medium text-primary">{doctor.specialization}</p>
                                            </div>

                                            {doctor.bio && (
                                                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                                                    {doctor.bio}
                                                </p>
                                            )}

                                            <div className="pt-4 border-t border-border/50 grid gap-3">
                                                {doctor.license_number && (
                                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                        <BadgeInfo className="h-4 w-4 shrink-0" />
                                                        <span>License: <span className="font-medium text-foreground">{doctor.license_number}</span></span>
                                                    </div>
                                                )}
                                                {doctor.years_of_experience && (
                                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                        <Briefcase className="h-4 w-4 shrink-0" />
                                                        <span>Experience: <span className="font-medium text-foreground">{doctor.years_of_experience} years</span></span>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>

                                        <CardFooter className="flex flex-col gap-3 pt-4 border-t border-border/40">
                                            <div className="flex w-full gap-3">
                                                <Button
                                                    variant="outline"
                                                    className="flex-1 justify-center rounded-xl h-11 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-foreground font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                                                >
                                                    View Profile
                                                </Button>
                                                <Button
                                                    className="flex-1 justify-center rounded-xl h-11 bg-[#0E6B74] text-white hover:bg-[#083E44] dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 shadow-lg shadow-teal-900/20 hover:shadow-xl hover:shadow-teal-900/30 transition-all font-semibold border border-transparent hover:scale-[1.02] active:scale-[0.98]"
                                                    onClick={() => handleBookAppointment(doctor.id)}
                                                >
                                                    Book Now
                                                </Button>
                                            </div>
                                        </CardFooter>
                                    </Card>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </motion.div>
            </TransitionItem>
        </div>
    );
};
