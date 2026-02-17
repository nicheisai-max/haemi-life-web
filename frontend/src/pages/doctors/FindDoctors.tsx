import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getDoctors, getSpecializations } from '../../services/doctor.service';
import type { DoctorProfile } from '../../services/doctor.service';
import { AlertCircle, Search, SearchX, User, BadgeCheck, BadgeInfo, Briefcase, Info, Calendar } from 'lucide-react';
import { Loader } from '@/components/ui/Loader';

import { PageTransition, TransitionItem } from '../../components/layout/PageTransition';

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
            setError(err.response?.data?.message || 'Failed to load doctors');
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
        navigate('/appointments/book', { state: { doctorId: doctorId.toString() } });
    };

    if (loading) {
        return (
            <div className="max-w-[1920px] mx-auto p-8 flex justify-center items-center min-h-[400px]">
                <Loader size="lg" />
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="max-w-[1920px] mx-auto p-6 md:p-8">
                <TransitionItem className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Find Doctors</h1>
                    <p className="text-muted-foreground">Search for verified healthcare professionals and book appointments</p>
                </TransitionItem>

                {error && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <TransitionItem>
                    {/* Search and Filters */}
                    <Card className="mb-8">
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Search by name or specialization..."
                                        className="pl-10"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                <div className="w-full md:w-[250px]">
                                    <Select
                                        value={selectedSpecialization}
                                        onValueChange={setSelectedSpecialization}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Specializations" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Specializations</SelectItem>
                                            {specializations.map(spec => (
                                                <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Results Count */}
                    <div className="mb-6">
                        <p className="text-muted-foreground font-medium">{filteredDoctors.length} doctor{filteredDoctors.length !== 1 ? 's' : ''} found</p>
                    </div>

                    {/* Doctors Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredDoctors.length === 0 ? (
                            <Card className="col-span-full p-12 text-center flex flex-col items-center justify-center bg-muted/30 border-dashed">
                                <div className="bg-muted p-4 rounded-full mb-4">
                                    <SearchX className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground">No doctors found</h3>
                                <p className="text-muted-foreground mt-1 max-w-sm">
                                    We couldn't find any doctors matching your search criteria. Try adjusting your filters.
                                </p>
                            </Card>
                        ) : (
                            filteredDoctors.map((doctor) => (
                                <Card key={doctor.id} className="group hover:shadow-lg transition-all duration-300 border-border/60 hover:border-primary/20">
                                    <CardHeader className="flex flex-row justify-between items-start pb-2">
                                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary ring-4 ring-background shadow-sm">
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

                                    <CardFooter className="flex flex-col gap-3 pt-2">
                                        <Button
                                            variant="outline"
                                            className="w-full justify-center group-hover:bg-primary/5 group-hover:text-primary group-hover:border-primary/20"
                                        >
                                            <Info className="h-4 w-4 mr-2" />
                                            View Profile
                                        </Button>
                                        <Button
                                            className="w-full justify-center shadow-sm group-hover:shadow-md transition-all"
                                            onClick={() => handleBookAppointment(doctor.id)}
                                        >
                                            <Calendar className="h-4 w-4 mr-2" />
                                            Book Appointment
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))
                        )}
                    </div>
                </TransitionItem>
            </div>
        </PageTransition>
    );
};
