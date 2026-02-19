import React, { type ReactNode } from 'react';
import { Navbar } from './Navbar';
import { NotificationSimulator } from '../utils/NotificationSimulator';


interface DashboardLayoutProps {
    children: ReactNode;
}

import { ChatHub } from '../ui/ChatHub';
import { Footer } from './Footer';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../context/AuthContext';

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    return (
        <div className="min-h-screen bg-background flex flex-col transition-colors duration-300 overflow-x-hidden pt-[72px]">
            <Navbar />
            <NotificationSimulator />
            <div className="flex flex-1 w-full max-w-[1920px] mx-auto">
                <Sidebar />
                <main className="flex-1 w-full min-w-0 pb-12 lg:pl-[260px]">
                    <div className="w-full px-4 md:px-5 py-8">
                        {children}
                    </div>
                </main>
            </div>
            <div className="lg:pl-[260px]">
                <Footer />
            </div>
            {!isAdmin && <ChatHub />}
        </div>
    );
};
