import React from 'react';
import { useAuth } from '@/hooks/use-auth';

export const StatusWidget: React.FC = () => {
    const { user } = useAuth();
    if (!user) return null;

    return (
        <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Status</p>
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 capitalize">
                    Connected as {user.role}
                </span>
            </div>
        </div>
    );
};
