import React, { useEffect, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Navbar } from './navbar';
import { NotificationSimulator } from '../utils/notification-simulator.deprecated';
import { OverlayProvider } from '@/context/overlay-context';
import { useOverlay } from '@/hooks/use-overlay';
import { logger } from '@/utils/logger';

interface DashboardLayoutProps {
    children: ReactNode;
}

const ChatHub = React.lazy(() => import('../ui/chat-hub').then(m => ({ default: m.ChatHub })));
const ClinicalCopilot = React.lazy(() => import('../ui/clinical-copilot').then(m => ({ default: m.ClinicalCopilot })));
import { Footer } from './footer';
import { Sidebar } from './sidebar';
import { useAuth } from '@/hooks/use-auth';

// 🩺 HAEMI STABILITY LAYER: Inner layout to access OverlayContext
const DashboardLayoutInner: React.FC<DashboardLayoutProps> = ({ children }) => {
    const { user } = useAuth();
    const { activeOverlay, setOverlay, closeOverlay } = useOverlay();
    const isAdmin = user?.role === 'admin';

    // COORDINATION: Global Orchestration for AI Copilot (Legacy Compatibility Bridge)
    // We keep these listeners temporarily to bridge legacy dispatchers to the new context.
    useEffect(() => {
        const handleOpen = () => {
            if (activeOverlay !== 'copilot') {
                logger.debug('[DashboardLayout] Reactive trigger: Opening Clinical Copilot (Legacy-Event Bridge)');
                setOverlay('copilot');
            }
        };
        const handleClose = () => closeOverlay();

        window.addEventListener('haemi-open-copilot', handleOpen);
        window.addEventListener('haemi-close-copilot', handleClose);

        return () => {
            window.removeEventListener('haemi-open-copilot', handleOpen);
            window.removeEventListener('haemi-close-copilot', handleClose);
        };
    }, [activeOverlay, setOverlay, closeOverlay]);


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
                            isOpen={activeOverlay === 'copilot'} 
                            onClose={closeOverlay} 
                        />
                    </Suspense>
                </>
            )}
        </div>
    );
};

export const DashboardLayout: React.FC<DashboardLayoutProps> = (props) => {
    return (
        <OverlayProvider>
            <DashboardLayoutInner {...props} />
        </OverlayProvider>
    );
};

