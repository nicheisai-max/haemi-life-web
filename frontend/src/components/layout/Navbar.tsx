import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '../ui/LanguageSelector';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Settings, LogOut } from 'lucide-react';
import { CommandCenter } from '../ui/CommandCenter';
import { NotificationMenu } from '../ui/NotificationMenu';
import { MobileSidebar } from './MobileSidebar';

// Import Real Assets
import doctorImg from '../../assets/images/doctors/doctor_01.jpg';
import patientImg from '../../assets/images/patients/patient_01.jpg';
import adminImg from '../../assets/images/admin/admin.png';
import pharmacistImg from '../../assets/images/pharmacies/pharmacy_01.jpg';

export const Navbar: React.FC = () => {
    const { user, logout, profileImageVersion } = useAuth();
    const navigate = useNavigate();
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleLogout = async () => {
        await logout();
        // Manual navigate removed: AuthContext atomic flush + ProtectedRoute 
        // will handle the state-driven redirection to /login.
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Determine User Image
    const getUserImage = () => {
        if (!user) return '';

        // Prioritize Secure API Endpoint (BYTEA or Legacy Redirection)
        const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000');
        const apiImage = `${baseUrl}/api/files/profile/${user.id}`;

        // However, we only return the API image if we aren't using a default asset.
        // For the investor demo, the default assets are imported as variables like 'patientImg'.
        // To maintain "Zero-Breakage", if the API returns 404, the browser will show a broken image.
        // So we should check if the user actually has any image associated.
        // But since we want to be "Industry Grade", we'll return the API URL and let the backend 
        // handle the fallback to the static /uploads/ path if it exists.

        // If user has NO image at all in the DB, use local imported assets.
        if (!user.profile_image && !user.profile_image_mime) {
            switch (user.role) {
                case 'admin': return adminImg;
                case 'doctor': return doctorImg;
                case 'patient': return patientImg;
                case 'pharmacist': return pharmacistImg;
                default: return patientImg;
            }
        }

        // Append profileImageVersion as cache-bust so Navbar always shows the latest image
        return `${apiImage}?v=${profileImageVersion}`;
    };


    return (
        <nav className="fixed top-0 left-0 right-0 z-50 w-full border-b border-border/40 bg-background/95 dark:bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 dark:border-white/5 h-[72px] flex items-center shadow-sm">
            <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">

                {/* Left: Logo */}
                {/* Left: Logo */}
                <div className="flex items-center gap-2 min-w-[260px] h-full pl-4 md:pl-0">
                    <MobileSidebar />
                    <Link
                        to="/"
                        className="flex items-center gap-2 transition-opacity hover:opacity-90 px-4"
                        aria-label="Haemi Life Home"
                    >
                        <Logo size="nav" />
                    </Link>
                </div>

                {/* Center: Global Command Center */}
                <div className="hidden md:flex flex-1 justify-center max-w-2xl mx-auto">
                    <CommandCenter />
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-[200px] justify-end">
                    {!isOnline && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-semibold border border-yellow-200 dark:border-yellow-900 animate-pulse" role="status">
                            <span className="sr-only">Offline Mode Active</span>
                            <span className="w-1.5 h-1.5 bg-yellow-600 dark:bg-yellow-400 rounded-full" aria-hidden="true"></span>
                            <span className="hidden sm:inline">OFFLINE</span>
                        </div>
                    )}
                    <div className="hidden sm:block">
                        <LanguageSelector />
                    </div>
                    <ThemeToggle />

                    {/* Notifications */}
                    <NotificationMenu />

                    {/* User Profile */}
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 overflow-hidden border-2 border-primary/20 hover:border-primary transition-all shadow-sm ml-1" aria-label="User account menu">
                                <Avatar className="h-full w-full">
                                    <AvatarImage src={getUserImage()} alt={user?.name || 'User'} className="object-cover" />
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                        {user?.initials || (user?.name ? getInitials(user.name) : 'U')}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 rounded-3xl p-1.5 bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-xl border-slate-200 dark:border-white/5 shadow-2xl mt-2 transition-all">
                            <DropdownMenuLabel className="font-normal px-4 py-3.5">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-semibold leading-none text-slate-900 dark:text-white tracking-wide">{user?.name}</p>
                                    <p className="text-[10px] leading-none text-slate-500 dark:text-gray-400 font-medium tracking-wider uppercase opacity-80 mt-1">{user?.role}</p>
                                </div>
                            </DropdownMenuLabel>

                            <div className="flex flex-col gap-0.5 px-0.5">
                                <DropdownMenuItem
                                    onClick={() => navigate('/profile')}
                                    className="group flex items-center px-3 py-2.5 rounded-2xl cursor-pointer focus:bg-slate-100 dark:focus:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-200"
                                >
                                    <div className="mr-3 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                                        <UserIcon className="h-4.5 w-4.5 text-slate-500 dark:text-gray-400 group-hover:text-primary transition-colors" />
                                    </div>
                                    <span className="text-sm text-slate-700 dark:text-gray-200 font-medium group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Profile</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                    onClick={() => navigate('/dashboard')}
                                    className="group flex items-center px-3 py-2.5 rounded-2xl cursor-pointer focus:bg-slate-100 dark:focus:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-200"
                                >
                                    <div className="mr-3 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                                        <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-slate-500 dark:text-gray-400 group-hover:text-primary transition-colors">
                                            <path d="M0 3.5C0 2.67157 0.671573 2 1.5 2H6.5C7.32843 2 8 2.67157 8 3.5V6.5C8 7.32843 7.32843 8 6.5 8H1.5C0.671573 8 0 7.32843 0 6.5V3.5ZM9 3.5C9 2.67157 9.67157 2 10.5 2H13.5C14.3284 2 15 2.67157 15 3.5V6.5C15 7.32843 14.3284 8 13.5 8H10.5C9.67157 8 9 7.32843 9 6.5V3.5ZM0 10.5C0 9.67157 0.671573 9 1.5 9H6.5C7.32843 9 8 9.67157 8 10.5V13.5C8 14.3284 7.32843 15 6.5 15H1.5C0.671573 15 0 14.3284 0 13.5V10.5ZM9 10.5C9 9.67157 9.67157 9 10.5 9H13.5C14.3284 9 15 9.67157 15 10.5V13.5C15 14.3284 14.4 15 13.5 15H10.5C9.67157 15 9 14.3284 9 13.5V10.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                        </svg>
                                    </div>
                                    <span className="text-sm text-slate-700 dark:text-gray-200 font-medium group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Dashboard</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                    onClick={() => navigate('/settings')}
                                    className="group flex items-center px-3 py-2.5 rounded-2xl cursor-pointer focus:bg-slate-100 dark:focus:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-200"
                                >
                                    <div className="mr-3 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                                        <Settings className="h-4.5 w-4.5 text-slate-500 dark:text-gray-400 group-hover:text-primary transition-colors" />
                                    </div>
                                    <span className="text-sm text-slate-700 dark:text-gray-200 font-medium group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Settings</span>
                                </DropdownMenuItem>
                            </div>

                            <div className="px-0.5 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-white/5">
                                <DropdownMenuItem
                                    onClick={handleLogout}
                                    className="group flex items-center px-3 py-2.5 rounded-2xl cursor-pointer focus:bg-red-50 dark:focus:bg-red-500/10 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
                                >
                                    <div className="mr-3 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                                        <LogOut className="h-4.5 w-4.5 text-red-500 dark:text-red-400 group-hover:text-red-600 dark:group-hover:text-red-300 transition-colors" />
                                    </div>
                                    <span className="text-sm text-red-500 dark:text-red-400 font-medium group-hover:text-red-600 dark:group-hover:text-red-300 transition-colors">Log out</span>
                                </DropdownMenuItem>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </nav>
    );
};
