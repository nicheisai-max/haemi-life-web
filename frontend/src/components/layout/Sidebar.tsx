import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { SidebarNav } from './SidebarNav';

export const Sidebar: React.FC = () => {
    const { user } = useAuth();
    if (!user) return null;

    return (

        <aside className="hidden lg:flex flex-col w-[260px] border-r border-sidebar-border bg-sidebar fixed left-0 top-[72px] h-[calc(100vh-72px)] overflow-hidden z-20">
            <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto scrollbar-none">
                <div className="px-4 mb-4">
                    <h2 className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase">Main Menu</h2>
                </div>
                <SidebarNav />
            </div>
        </aside>
    );

};
