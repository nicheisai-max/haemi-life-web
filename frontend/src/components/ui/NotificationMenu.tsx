import React, { useState, useEffect } from 'react';
import { Bell, Check, Info, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Notification {
    id: string;
    title: string;
    description: string;
    type: 'success' | 'warning' | 'info';
    timeAgo: string;
    read: boolean;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
    {
        id: '1',
        title: 'Grant Pre-Approved',
        description: 'Your application for the Youth Tech Fund has been pre-approved by NYDA.',
        type: 'success',
        timeAgo: '2 mins ago',
        read: false,
    },
    {
        id: '2',
        title: 'Document Expiry Warning',
        description: 'Your Tax Clearance Certificate expires in 5 days. Please renew it in the Vault.',
        type: 'warning',
        timeAgo: '1 hour ago',
        read: false,
    },
    {
        id: '3',
        title: 'New Funding Match',
        description: '95% match found: "Green Energy Start-up Grant" (R1.2M). View details.',
        type: 'info',
        timeAgo: '4 hours ago',
        read: false,
    }
];

export const NotificationMenu: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
    const [hasUnread, setHasUnread] = useState(true);

    // Smart Pulse: Add a new notification every 90 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            const newNotif: Notification = {
                id: Date.now().toString(),
                title: 'New Funding Match',
                description: 'New opportunity available matching your profile.',
                type: 'info',
                timeAgo: 'Just now',
                read: false,
            };
            setNotifications(prev => [newNotif, ...prev]);
            setHasUnread(true);
        }, 90000);

        return () => clearInterval(interval);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setHasUnread(false);
    };

    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'success': return <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />;
            case 'warning': return <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={3} />; // Using Info as workaround for '!' circle
            case 'info': return <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" strokeWidth={3} fill="currentColor" />;
        }
    };

    const getBgColor = (type: Notification['type']) => {
        switch (type) {
            case 'success': return 'bg-emerald-100 dark:bg-emerald-900/30';
            case 'warning': return 'bg-amber-100 dark:bg-amber-900/30';
            case 'info': return 'bg-indigo-100 dark:bg-indigo-900/30';
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors h-10 w-10">
                    <Bell className={`h-5 w-5 transition-transform ${hasUnread ? 'animate-pulse-slow' : ''}`} />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-background ring-1 ring-background" />
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[380px] p-0 overflow-hidden border-border/10 shadow-xl bg-white dark:bg-[#0f172a] rounded-xl">
                {/* Header */}
                <div className="p-4 border-b border-border/10 flex items-center justify-between">
                    <h4 className="font-bold text-base text-slate-900 dark:text-white">Notifications</h4>
                    {unreadCount > 0 && (
                        <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 hover:bg-indigo-200 rounded-full px-3 py-0.5 text-xs font-bold">
                            {unreadCount} NEW
                        </Badge>
                    )}
                </div>

                {/* List */}
                <ScrollArea className="h-[380px]">
                    <div className="flex flex-col">
                        {notifications.map((notif) => (
                            <DropdownMenuItem key={notif.id} className="p-4 cursor-pointer border-b border-border/5 focus:bg-slate-50 dark:focus:bg-slate-800/50 items-start gap-4">
                                <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${getBgColor(notif.type)}`}>
                                    {getIcon(notif.type)}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex flex-col">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-1">
                                            {notif.title}
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
                                            {notif.description}
                                        </p>
                                        <span className="text-xs text-slate-400 mt-1.5 font-medium">
                                            {notif.timeAgo}
                                        </span>
                                    </div>
                                </div>
                            </DropdownMenuItem>
                        ))}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 text-center border-t border-border/10">
                    <Button
                        variant="ghost"
                        onClick={markAllRead}
                        className="w-full text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-bold"
                    >
                        Mark all as read
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
