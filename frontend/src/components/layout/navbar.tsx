import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate, Link } from 'react-router-dom';
import { Logo } from '../ui/logo';
import { ThemeToggle } from '../ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '../ui/language-selector';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Settings, LogOut } from 'lucide-react';
import { CommandCenter } from '../ui/command-center';
import { NotificationMenu } from '../ui/notification-menu';
import { MobileSidebar } from './mobile-sidebar';
import { getInitials } from '@/utils/avatar.resolver';

// Import Real Assets
import doctorImg from '../../assets/images/doctors/doctor_01.jpg';
import patientImg from '../../assets/images/patients/patient_01.jpg';
import adminImg from '../../assets/images/admin/admin.png';
import pharmacistImg from '../../assets/images/pharmacies/pharmacy_01.jpg';

export const Navbar: React.FC = () => {
    const { user, logout, profileImageVersion } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        // Manual navigate removed: AuthContext atomic flush + ProtectedRoute 
        // will handle the state-driven redirection to /login.
    };



    // Determine User Image
    const getUserImage = () => {
        if (!user) return '';

        // Prioritize the standardized profileImage property
        if (user.profileImage) {
            // If it's a full URL, use it directly. Otherwise, resolve via API.
            if (user.profileImage.startsWith('http')) return user.profileImage;
            
            const baseUrl = (import.meta.env.VITE_API_URL || '');
            // Append profileImageVersion as cache-bust to ensure latest image
            return `${baseUrl}/api/files/profile/${user.id}?v=${profileImageVersion}`;
        }

        // Fallback to local imported assets for demo/new users without images
        switch (user.role) {
            case 'admin': return adminImg;
            case 'doctor': return doctorImg;
            case 'patient': return patientImg;
            case 'pharmacist': return pharmacistImg;
            default: return patientImg;
        }
    };


    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-[var(--layout-header-height)] bg-white/80 dark:bg-[#0B1214]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/5 transition-all duration-300">
            <div className="haemi-nav-container">
                {/* Left: Logo & Hamburger (Bit-for-Bit Sidebar Baseline at 16px) */}
                <div className="flex items-center h-full gap-4 haemi-nav-logo-offset-fix">
                    <div className="flex items-center justify-center">
                        <MobileSidebar />
                    </div>
                    <Link
                        to="/"
                        className="flex items-center transition-opacity hover:opacity-90"
                        aria-label="Haemi Life Home"
                    >
                        <Logo size="nav" />
                    </Link>
                </div>

                {/* Center: Global Command Center (Synchronized 40px Horizon) */}
                <div className="haemi-nav-search-shield haemi-nav-action-sync">
                    <CommandCenter />
                </div>

                {/* Right: Actions (Mirror-Image 40px Synchronicity) */}
                <div className="flex items-center gap-3 haemi-nav-action-sync">
                    <div className="hidden sm:block">
                        <LanguageSelector />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <NotificationMenu />

                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="navAction" 
                                    className="p-0 border-none shadow-none focus-visible:ring-0"
                                    aria-label="User account menu"
                                >
                                    <Avatar className="haemi-nav-action-circle shadow-sm">
                                        <AvatarImage 
                                            src={getUserImage()} 
                                            alt={user?.name || 'User'} 
                                            className="haemi-avatar-full-bleed" 
                                        />
                                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                            {user?.name ? getInitials(user.name) : 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64 rounded-3xl p-1.5 bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-xl border-slate-200 dark:border-white/5 shadow-2xl mt-2 transition-all">
                                <DropdownMenuLabel className="font-normal px-4 py-3.5">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-semibold leading-none text-slate-900 dark:text-white capitalize">{user?.name}</p>
                                        <p className="text-xs leading-none text-slate-500 dark:text-slate-400 truncate mt-1">{user?.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <div className="h-px bg-slate-100 dark:bg-white/5 mx-2 my-1" />
                                
                                <DropdownMenuItem 
                                    className="flex items-center gap-2 px-4 py-2.5 cursor-pointer rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group mb-1"
                                    onClick={() => navigate('/profile')}
                                >
                                    <UserIcon className="w-4 h-4 text-slate-500 group-hover:text-primary" />
                                    <span className="text-sm font-medium">Profile Settings</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem 
                                    className="flex items-center gap-2 px-4 py-2.5 cursor-pointer rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group mb-1"
                                    onClick={() => navigate('/settings')}
                                >
                                    <Settings className="w-4 h-4 text-slate-500 group-hover:text-primary" />
                                    <span className="text-sm font-medium">Dashboard Preferences</span>
                                </DropdownMenuItem>

                                <div className="h-px bg-slate-100 dark:bg-white/5 mx-2 my-1" />
                                
                                <DropdownMenuItem 
                                    className="flex items-center gap-2 px-4 py-2.5 cursor-pointer rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 transition-colors group"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span className="text-sm font-semibold">Sign Out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </header>
    );
};
