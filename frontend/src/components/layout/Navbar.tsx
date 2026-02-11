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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bell, User as UserIcon, Settings, LogOut } from 'lucide-react';
import { CommandCenter } from '../ui/CommandCenter';

export const Navbar: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    // Mock notifications for now
    const [notifications] = useState([
        { text: 'Appointment confirmed with Dr. Modise', unread: true },
        { text: 'Prescription ready for pickup', unread: false },
        { text: 'Welcome to Haemi Life!', unread: false }
    ]);

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

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <nav className="sticky top-0 z-50 w-full border-b bg-background/95 dark:bg-[#0B1214]/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm h-[70px] flex items-center px-4">
            <div className="container flex h-14 items-center justify-between max-w-7xl mx-auto">
                <div className="flex items-center gap-8">
                    <Link
                        to="/"
                        className="flex items-center gap-2"
                        aria-label="Haemi Life Home"
                    >
                        <Logo size="md" />
                    </Link>

                    {/* Global Command Center */}
                    <CommandCenter />
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    {!isOnline && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-semibold border border-yellow-200 dark:border-yellow-900 animate-pulse" role="status">
                            <span className="sr-only">Offline Mode Active</span>
                            <span className="w-1.5 h-1.5 bg-yellow-600 dark:bg-yellow-400 rounded-full" aria-hidden="true"></span>
                            <span>OFFLINE</span>
                        </div>
                    )}
                    <LanguageSelector />
                    <ThemeToggle />

                    {/* Notifications */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="relative rounded-full text-muted-foreground hover:text-primary" aria-label={`You have ${notifications.length} notifications`}>
                                <Bell className="h-5 w-5" />
                                {notifications.length > 0 && (
                                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center border-2 border-background">
                                        {notifications.length}
                                    </span>
                                )}
                                <span className="sr-only">Notifications</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[calc(100vw-32px)] sm:w-80">
                            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {notifications.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    No new notifications
                                </div>
                            ) : (
                                notifications.map((notif, idx) => (
                                    <DropdownMenuItem key={idx} className={`cursor-pointer ${notif.unread ? 'bg-muted/50 font-medium' : ''}`}>
                                        {notif.text}
                                    </DropdownMenuItem>
                                ))
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* User Profile */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 overflow-hidden border border-border" aria-label="User account menu">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src="" alt={user?.name || 'User'} />
                                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                                        {user?.name ? getInitials(user.name) : 'U'}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                                    <p className="text-xs leading-none text-muted-foreground capitalize">{user?.role}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/${user?.role}/dashboard`)}>
                                <UserIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                                <span>Dashboard</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate('/settings')}>
                                <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                                <span>Settings</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                                <span>Log out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </nav>
    );
};
