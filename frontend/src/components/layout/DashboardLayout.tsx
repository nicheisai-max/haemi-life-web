import React, { type ReactNode } from 'react';
import { Navbar } from './Navbar';
import { NotificationSimulator } from '../utils/NotificationSimulator';


interface DashboardLayoutProps {
    children: ReactNode;
}

import { Breadcrumbs } from '../ui/Breadcrumbs';

import { ChatHub } from '../ui/ChatHub';

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
            <Navbar />
            <NotificationSimulator />
            <main className="flex-1 w-full max-w-7xl mx-auto pb-12 px-4 md:px-8">
                <Breadcrumbs />
                {children}
            </main>
            <ChatHub />
        </div>
    );
};
