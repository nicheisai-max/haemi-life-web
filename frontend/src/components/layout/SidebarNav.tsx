import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useNavigation } from '../../hooks/useNavigation';


export const SidebarNav: React.FC<{ onItemClick?: () => void }> = ({ onItemClick }) => {
    const items = useNavigation();

    return (
        <div className="space-y-1 relative">
            {items.map((item) => {
                const isDashboardRoot = item.path === '/dashboard' || item.path === '/admin';

                return (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={isDashboardRoot}
                        onClick={onItemClick}
                        className={({ isActive }) => cn(
                            "flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-200 group w-full relative mb-1",
                            isActive
                                ? "active-nav-item bg-primary/10 font-semibold"
                                : "text-muted-foreground font-medium hover:bg-slate-100/50 dark:hover:bg-white/5 hover:text-foreground"
                        )}
                    >
                        {({ isActive }) => (
                            <>
                                {/* Active Indicator Bar */}
                                <div className={cn(
                                    "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full active-nav-indicator transition-all duration-300 opacity-0",
                                    isActive && "opacity-100"
                                )} />

                                <item.icon
                                    className={cn(
                                        "h-5 w-5 transition-transform shrink-0",
                                        "group-hover:scale-110 duration-200"
                                    )}
                                    aria-hidden="true"
                                />
                                <span className="truncate">{item.label}</span>
                            </>
                        )}
                    </NavLink>
                );
            })}
        </div>
    );
};
