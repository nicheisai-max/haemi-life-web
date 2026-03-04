import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';

const PatientDashboard = React.lazy(() => import('../../pages/patient/patient-dashboard').then(m => ({ default: m.PatientDashboard })));
const DoctorDashboard = React.lazy(() => import('../../pages/doctor/doctor-dashboard').then(m => ({ default: m.DoctorDashboard })));
const AdminDashboard = React.lazy(() => import('../../pages/admin/admin-dashboard').then(m => ({ default: m.AdminDashboard })));
const PharmacistDashboard = React.lazy(() => import('../../pages/pharmacist/pharmacist-dashboard').then(m => ({ default: m.PharmacistDashboard })));

export const RoleRouter: React.FC = () => {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;

    // Webpack ONLY fetches the specific file chunk dictated by the user object on mount.
    switch (user.role) {
        case 'patient': return <PatientDashboard />;
        case 'doctor': return <DoctorDashboard />;
        case 'admin': return <AdminDashboard />;
        case 'pharmacist': return <PharmacistDashboard />;
        default: return <Navigate to="/login" replace />;
    }
};
