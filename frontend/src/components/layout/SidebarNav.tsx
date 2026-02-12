import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useNavigation } from '../../hooks/useNavigation';


export const SidebarNav: React.FC<{ onItemClick?: () => void }> = ({ onItemClick }) => {
    const items = useNavigation();

    return (
        <div className="space-y-1">
            {items.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onItemClick}
                    className={({ isActive }) => cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all group w-full",
                        isActive
                            ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                            : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                    )}
                >
                    <item.icon className={cn(
                        "h-5 w-5 transition-colors shrink-0",
                        "group-hover:scale-110 duration-200"
                    )} />
                    <span className="truncate">{item.label}</span>
                </NavLink>
            ))}
        </div>
    );
};
