import React, { type ReactNode } from 'react';
import { Navbar } from './Navbar';
import { NotificationSimulator } from '../utils/_NotificationSimulator.deprecated';


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

    // MASTER LAYOUT ARCHITECTURE
    // 1. Navbar: Fixed Top (72px)
    // 2. Sidebar: Fixed Left (260px)
    // 3. Main: Fluid with Max Width 1800px

    return (
        <div className="portal-layout-root min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300">
            {/* Top Navigation - Fixed */}
            <Navbar />

            <NotificationSimulator />

            {/* App Shell w/ Sidebar Offset */}
            <div className="flex flex-1 pt-[72px]">
                {/* Fixed Sidebar */}
                <Sidebar />

                {/* Main Content Area */}
                <main className="flex-1 w-full min-w-0 lg:pl-[260px] flex flex-col min-h-[calc(100vh-72px)] bg-muted/5 dark:bg-background">
                    <div className="flex-1 w-full max-w-[1800px] mx-auto px-6 pt-6 pb-6 md:px-8 md:pt-8 md:pb-8 transition-all duration-300">
                        {children}
                    </div>

                    {/* Footer behaves within the content flow or strictly at bottom? 
                        Keeping it consistent with flow for now, but usually footers in dashboards are at end of content.
                    */}
                    <div className="w-full max-w-[1800px] mx-auto px-6 pb-6 md:px-8 md:pb-8">
                        <Footer />
                    </div>
                </main>
            </div>

            {!isAdmin && <ChatHub />}
        </div>
    );
};
