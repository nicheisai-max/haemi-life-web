import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { SidebarNav } from './sidebar-nav';

export const Sidebar: React.FC = () => {
    const { user } = useAuth();
    if (!user) return null;

    return (

        <aside id="haemi-official-sidebar" className="hidden lg:flex flex-col w-[var(--layout-sidebar-width)] bg-sidebar text-sidebar-foreground fixed left-0 top-[var(--layout-header-height)] h-[calc(100vh-var(--layout-header-height))] overflow-hidden z-20 border-r border-border/10 transition-all duration-300">
            <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto scrollbar-none">
                <div className="px-4 mb-4">
                    <h2 className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">Main Menu</h2>
                </div>
                <SidebarNav />
            </div>
        </aside>
    );

};
