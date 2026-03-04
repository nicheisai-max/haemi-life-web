import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const PatientDashboard = React.lazy(() => import('../../pages/patient/PatientDashboard').then(m => ({ default: m.PatientDashboard })));
const DoctorDashboard = React.lazy(() => import('../../pages/doctor/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })));
const AdminDashboard = React.lazy(() => import('../../pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const PharmacistDashboard = React.lazy(() => import('../../pages/pharmacist/PharmacistDashboard').then(m => ({ default: m.PharmacistDashboard })));

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
