import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate, Link } from 'react-router-dom';
import { Logo } from '../ui/logo';
import { ThemeToggle } from '../ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '../ui/language-selector';
import { useOverlay } from '@/hooks/use-overlay';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
    User as UserIcon, 
    Settings, 
    LogOut
} from 'lucide-react';
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
    const { activeOverlay, setOverlay, closeOverlay } = useOverlay();
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

    const handleOpenChange = (open: boolean) => {
        if (open) {
            setOverlay('user-menu');
        } else if (activeOverlay === 'user-menu') {
            closeOverlay();
        }
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-[var(--layout-header-height)] bg-white/80 dark:bg-background/80 backdrop-blur-md border-b border-border transition-[background-color,color,backdrop-filter,opacity] duration-300">
            <div className="haemi-nav-container">
                {/* Left: Logo & Hamburger (Bit-for-Bit Sidebar Baseline at 16px) */}
                <div className="flex items-center h-full gap-1 md:gap-4 haemi-nav-logo-offset-fix">
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
                <div className="haemi-nav-search-container haemi-nav-action-sync">
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

                        <DropdownMenu 
                            modal={false} 
                            open={activeOverlay === 'user-menu'} 
                            onOpenChange={handleOpenChange}
                        >
                            <DropdownMenuTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="navAction" 
                                    className="haemi-nav-action-circle p-0 border-none shadow-none focus-visible:ring-0"
                                    aria-label="User account menu"
                                >
                                    <Avatar className="shadow-sm">
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
                            <DropdownMenuContent 
                                align="end" 
                                onCloseAutoFocus={(e: Event) => e.preventDefault()}
                                className="w-64 haemi-nav-dropdown-content rounded-[var(--card-radius)] p-1.5 bg-card/95 backdrop-blur-xl border-border shadow-2xl transition-all"
                            >
                                <DropdownMenuLabel className="haemi-nav-dropdown-header font-normal border-b border-border/50 mb-1">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-semibold leading-none text-slate-900 dark:text-white capitalize">{user?.name}</p>
                                        <p className="text-xs leading-none text-slate-500 dark:text-slate-400 truncate mt-1">{user?.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                
                                <div className="py-1">
                                    <DropdownMenuItem 
                                        className="flex items-center gap-2 px-4 py-2.5 cursor-pointer rounded-[var(--card-radius)] hover:bg-primary/5 text-slate-700 dark:text-slate-300 transition-colors group mb-0.5"
                                        onClick={() => navigate('/profile')}
                                    >
                                        <UserIcon className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                                        <span className="text-sm font-medium">Your Profile</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem 
                                        className="flex items-center gap-2 px-4 py-2.5 cursor-pointer rounded-[var(--card-radius)] hover:bg-primary/5 text-slate-700 dark:text-slate-300 transition-colors group mb-0.5"
                                        onClick={() => navigate('/settings')}
                                    >
                                        <Settings className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                                        <span className="text-sm font-medium">Settings</span>
                                    </DropdownMenuItem>
                                </div>

                                <div className="h-px bg-muted/60 mx-1 my-1" />
                                
                                <DropdownMenuItem 
                                    className="flex items-center gap-2 px-4 py-2.5 cursor-pointer rounded-[var(--card-radius)] hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 transition-colors group"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
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

