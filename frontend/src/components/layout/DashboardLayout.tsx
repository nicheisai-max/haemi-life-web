import React, { type ReactNode } from 'react';
import { Navbar } from './Navbar';
import { NotificationSimulator } from '../utils/NotificationSimulator';


interface DashboardLayoutProps {
    children: ReactNode;
}

import { ChatHub } from '../ui/ChatHub';
import { Footer } from './Footer';
import { Sidebar } from './Sidebar';

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-background flex flex-col transition-colors duration-300 overflow-x-hidden pt-[72px]">
            <Navbar />
            <NotificationSimulator />
            <div className="flex flex-1 w-full max-w-[1920px] mx-auto overflow-hidden">
                <Sidebar />
                <main className="flex-1 w-full min-w-0 pb-12 lg:pl-[260px]">
                    <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-8">
                        {children}
                    </div>
                </main>
            </div>
            <div className="lg:pl-[260px]">
                <Footer />
            </div>
            <ChatHub />
        </div>
    );
};
