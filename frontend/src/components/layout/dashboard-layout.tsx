import React, { type ReactNode, useState, useEffect, Suspense } from 'react';
import { Navbar } from './navbar';
import { NotificationSimulator } from '../utils/notification-simulator.deprecated';


interface DashboardLayoutProps {
    children: ReactNode;
}

const ChatHub = React.lazy(() => import('../ui/chat-hub').then(m => ({ default: m.ChatHub })));
const ClinicalCopilot = React.lazy(() => import('../ui/clinical-copilot').then(m => ({ default: m.ClinicalCopilot })));
import { Footer } from './footer';
import { Sidebar } from './sidebar';
import { useAuth } from '@/hooks/use-auth';

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [isCopilotOpen, setIsCopilotOpen] = useState(false);

    // COORDINATION: Global Orchestration for AI Copilot
    useEffect(() => {
        const handleOpen = () => {
            if (!isCopilotOpen) {
                // Mutual Exclusion: Close others when opening copilot
                window.dispatchEvent(new CustomEvent('haemi-close-chathub'));
                window.dispatchEvent(new CustomEvent('haemi-close-notifications'));
                setIsCopilotOpen(true);
            }
        };
        const handleClose = () => setIsCopilotOpen(false);

        window.addEventListener('haemi-open-copilot', handleOpen);
        window.addEventListener('haemi-close-copilot', handleClose);

        return () => {
            window.removeEventListener('haemi-open-copilot', handleOpen);
            window.removeEventListener('haemi-close-copilot', handleClose);
        };
    }, [isCopilotOpen]);

    // MASTER LAYOUT ARCHITECTURE
    // 1. Navbar: Fixed Top (72px)
    // 2. Sidebar: Fixed Left (260px)
    // 3. Main: Fluid with Max Width 1800px

    return (
        <div className="portal-layout-root min-h-screen bg-background text-foreground flex flex-col">
            {/* Top Navigation - Fixed */}
            <Navbar />

            <NotificationSimulator />

            {/* App Shell w/ Sidebar Offset */}
            <div className="flex flex-1 pt-[var(--layout-header-height)]">
                {/* Fixed Sidebar */}
                <Sidebar />

                {/* Main Content Area */}
                <main className="flex-1 w-full min-w-0 lg:pl-[var(--layout-sidebar-width)] flex flex-col min-h-[calc(100vh-var(--layout-header-height))] bg-muted/5 dark:bg-background overflow-x-hidden relative">
                    {/* Content Wrapper: Standardized Mirror-Symmetry Logic */}
                    <div className="flex-1 w-full max-w-[var(--layout-max-width)] px-4 sm:px-6 lg:px-10 pt-6 md:pt-8 transition-all duration-300">
                        {children}
                    </div>

                    {/* Institutional Footer System: mt-auto ensures bottom stickiness */}
                    <Footer />
                </main>
            </div>

            {!isAdmin && (
                <>
                    <Suspense fallback={null}>
                        <ChatHub />
                    </Suspense>
                    <Suspense fallback={null}>
                        <ClinicalCopilot 
                            isOpen={isCopilotOpen} 
                            onClose={() => setIsCopilotOpen(false)} 
                        />
                    </Suspense>
                </>
            )}
        </div>
    );
};
