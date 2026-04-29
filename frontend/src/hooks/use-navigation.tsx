import {
    LayoutDashboard,
    Users,
    Calendar,
    FileText,
    Settings,
    ShieldCheck,
    ClipboardList,
    ClipboardCheck,
    Package,
    Activity,
    Search,
    Video,
    BarChart3
} from 'lucide-react';
import { useAuth } from './use-auth';
import { PATHS } from '../routes/paths';

export const useNavigation = () => {
    const { user } = useAuth();

    if (!user) return [];

    const menuItems = {
        patient: [
            { icon: LayoutDashboard, label: 'Dashboard', path: PATHS.PATIENT.DASHBOARD },
            { icon: Search, label: 'Find Specialists', path: PATHS.PATIENT.FIND_DOCTORS },
            { icon: Video, label: 'Telemedicine', path: PATHS.TELEMEDICINE },
            { icon: Calendar, label: 'Appointments', path: PATHS.PATIENT.APPOINTMENTS },
            { icon: FileText, label: 'Prescriptions', path: PATHS.PATIENT.PRESCRIPTIONS },
            { icon: ClipboardList, label: 'Medical Records', path: PATHS.PATIENT.MEDICAL_RECORDS },
            { icon: Settings, label: 'Settings', path: PATHS.SETTINGS },
        ],
        doctor: [
            { icon: LayoutDashboard, label: 'Dashboard', path: PATHS.DOCTOR.DASHBOARD },
            { icon: Calendar, label: 'Schedule', path: PATHS.DOCTOR.SCHEDULE },
            { icon: Users, label: 'Patients', path: PATHS.DOCTOR.PATIENTS },
            { icon: BarChart3, label: 'Clinical Reports', path: PATHS.DOCTOR.REPORTS },
            { icon: Settings, label: 'Settings', path: PATHS.SETTINGS },
        ],
        pharmacist: [
            { icon: LayoutDashboard, label: 'Dashboard', path: PATHS.PHARMACIST.DASHBOARD },
            { icon: ClipboardList, label: 'Prescription Queue', path: PATHS.PHARMACIST.QUEUE },
            { icon: Package, label: 'Inventory', path: PATHS.PHARMACIST.INVENTORY },
            { icon: Settings, label: 'Settings', path: PATHS.SETTINGS },
        ],
        admin: [
            { icon: LayoutDashboard, label: 'System Health', path: PATHS.ADMIN.DASHBOARD },
            { icon: Users, label: 'User Management', path: PATHS.ADMIN.USERS },
            { icon: ShieldCheck, label: 'Verify Doctors', path: PATHS.ADMIN.VERIFY_DOCTORS },
            { icon: ClipboardCheck, label: 'Manage Screening', path: PATHS.ADMIN.SCREENING },
            { icon: Activity, label: 'System Logs', path: PATHS.ADMIN.SYSTEM_LOGS },
            { icon: Settings, label: 'Settings', path: PATHS.SETTINGS },
        ],
    };

    return menuItems[user.role as keyof typeof menuItems] || [];
};
