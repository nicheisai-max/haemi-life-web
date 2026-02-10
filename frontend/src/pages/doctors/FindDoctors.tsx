import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getDoctors, getSpecializations } from '../../services/doctor.service';
import type { DoctorProfile } from '../../services/doctor.service';
import './FindDoctors.css';

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

    const handleBookAppointment = (doctorId: string) => {
        navigate(`/book-appointment?doctorId=${doctorId}`);
    };

    if (loading) {
        return (
            <div className="find-doctors-container">
                <Card style={{ padding: '2rem', textAlign: 'center' }}>
                    <div className="loading-spinner">Finding doctors...</div>
                </Card>
            </div>
        );
    }

    return (
        <div className="find-doctors-container fade-in">
            <div className="page-header">
                <h1>Find Doctors</h1>
                <p>Search for verified healthcare professionals</p>
            </div>

            {error && (
                <Card className="alert alert-error">
                    <span className="material-icons-outlined">error</span>
                    {error}
                </Card>
            )}

            {/* Search and Filters */}
            <Card className="search-card">
                <div className="search-box">
                    <span className="material-icons-outlined search-icon">search</span>
                    <input
                        type="text"
                        placeholder="Search by name or specialization..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="filters">
                    <select
                        className="filter-select"
                        value={selectedSpecialization}
                        onChange={(e) => setSelectedSpecialization(e.target.value)}
                    >
                        <option value="all">All Specializations</option>
                        {specializations.map(spec => (
                            <option key={spec} value={spec}>{spec}</option>
                        ))}
                    </select>
                </div>
            </Card>

            {/* Results Count */}
            <div className="results-header">
                <p>{filteredDoctors.length} doctor{filteredDoctors.length !== 1 ? 's' : ''} found</p>
            </div>

            {/* Doctors Grid */}
            <div className="doctors-grid">
                {filteredDoctors.length === 0 ? (
                    <Card style={{ padding: '3rem', textAlign: 'center', gridColumn: '1 / -1' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '64px', opacity: 0.3 }}>search_off</span>
                        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                            No doctors match your search criteria
                        </p>
                    </Card>
                ) : (
                    filteredDoctors.map((doctor) => (
                        <Card key={doctor.id} className="doctor-card hover-lift">
                            <div className="doctor-header">
                                <div className="doctor-avatar">
                                    <span className="material-icons-outlined">person</span>
                                </div>
                                <div className="doctor-badge">
                                    <span className="material-icons-outlined">verified</span>
                                    Verified
                                </div>
                            </div>

                            <div className="doctor-info">
                                <h3>{doctor.name}</h3>
                                <p className="specialization">{doctor.specialization}</p>
                                {doctor.bio && (
                                    <p className="bio">{doctor.bio.slice(0, 100)}{doctor.bio.length > 100 ? '...' : ''}</p>
                                )}
                            </div>

                            <div className="doctor-details">
                                {doctor.license_number && (
                                    <div className="detail-item">
                                        <span className="material-icons-outlined">badge</span>
                                        <span>License {doctor.license_number}</span>
                                    </div>
                                )}
                                {doctor.years_of_experience && (
                                    <div className="detail-item">
                                        <span className="material-icons-outlined">work</span>
                                        <span>{doctor.years_of_experience} years exp.</span>
                                    </div>
                                )}
                            </div>

                            <div className="doctor-actions">
                                <Button
                                    variant="outline"
                                    fullWidth
                                    leftIcon={<span className="material-icons-outlined">info</span>}
                                >
                                    View Profile
                                </Button>
                                <Button
                                    variant="primary"
                                    fullWidth
                                    leftIcon={<span className="material-icons-outlined">event</span>}
                                    onClick={() => handleBookAppointment(doctor.id)}
                                >
                                    Book Appointment
                                </Button>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};
