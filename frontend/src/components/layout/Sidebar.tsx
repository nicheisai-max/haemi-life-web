import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { SidebarNav } from './SidebarNav';
import { StatusWidget } from './StatusWidget';

export const Sidebar: React.FC = () => {
    const { user } = useAuth();
    if (!user) return null;

    return (

        <aside className="hidden lg:flex flex-col w-[260px] border-r border-border/40 bg-background/95 dark:bg-[#0B1214] fixed left-0 top-[72px] h-[calc(100vh-72px)] overflow-hidden z-20">
            <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto scrollbar-none">
                <div className="px-3 mb-4">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                        {user.role} Navigation
                    </h2>
                </div>
                <SidebarNav />
            </div>

            <div className="p-4 border-t border-border/40 shrink-0 bg-background/95 dark:bg-[#0B1214]">
                <StatusWidget />
            </div>
        </aside>
    );

};
