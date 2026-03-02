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
import { type Notification } from '../../services/notification.service';
import { useNotifications } from '../../hooks/useNotifications';
import { decrypt } from '@/utils/security';
import React, { useState, useEffect } from 'react';

const DecryptedDescription: React.FC<{ text: string }> = ({ text }) => {
    const [decrypted, setDecrypted] = useState(text);

    useEffect(() => {
        if (text && text.startsWith('enc:')) {
            decrypt(text)
                .then(res => {
                    if (res.startsWith('enc:')) return decrypt(res);
                    return res;
                })
                .then(res => {
                    if (res !== decrypted) setDecrypted(res);
                })
                .catch(() => setDecrypted('Message encrypted. Check key.'));
        } else if (text !== decrypted) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDecrypted(text);
        }
    }, [text, decrypted]);

    // Handle string overflow with break-all to prevent panel break
    return <span className="break-all">{decrypted}</span>;
};

const getTimeAgo = (dateString: string) => {
    try {
        const date = new Date(dateString);
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

        let interval = Math.floor(seconds / 31536000);
        if (interval > 1) return interval + " years ago";
        interval = Math.floor(seconds / 2592000);
        if (interval > 1) return interval + " months ago";
        interval = Math.floor(seconds / 86400);
        if (interval > 1) return interval + " days ago";
        interval = Math.floor(seconds / 3600);
        if (interval > 1) return interval + " hours ago";
        interval = Math.floor(seconds / 60);
        if (interval > 1) return interval + " mins ago";
        return "Just now";
    } catch {
        return "Recently";
    }
};

export const NotificationMenu: React.FC = () => {
    // Single source of truth — all state and socket logic lives in NotificationContext
    const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();

    const hasUnread = unreadCount > 0;

    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'success': return <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />;
            case 'warning': return <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={3} />;
            case 'info': return <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" strokeWidth={3} fill="currentColor" />;
            default: return <Bell className="h-4 w-4 text-slate-600 dark:text-slate-400" />;
        }
    };

    const getBgColor = (type: Notification['type']) => {
        switch (type) {
            case 'success': return 'bg-emerald-100 dark:bg-emerald-900/30';
            case 'warning': return 'bg-amber-100 dark:bg-amber-900/30';
            case 'info': return 'bg-indigo-100 dark:bg-indigo-900/30';
            default: return 'bg-slate-100 dark:bg-slate-800/30';
        }
    };

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300 h-10 w-10">
                    <Bell className={`h-5 w-5 transition-all ${hasUnread ? 'text-primary' : ''}`} />
                    {unreadCount > 0 && (
                        <span className="absolute top-[11px] right-[11px] h-2 w-2 rounded-full bg-red-500 border-2 border-background" />
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[340px] p-0 overflow-hidden border-border/10 shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl">
                {/* Header */}
                <div className="px-5 py-4 border-b border-border/5 flex items-center justify-between bg-white/50 dark:bg-white/5">
                    <h4 className="font-bold text-base tracking-tight text-slate-900 dark:text-slate-100 italic-none">Notifications</h4>
                    {unreadCount > 0 && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary dark:bg-primary/20 rounded-full px-2 py-0 text-[10px] font-bold border-none">
                            {unreadCount} NEW
                        </Badge>
                    )}
                </div>

                {/* List */}
                <ScrollArea className="h-[320px]">
                    <div className="flex flex-col">
                        {loading && notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground p-8 text-center space-y-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                <p className="text-sm font-medium">Syncing...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground p-8 text-center">
                                <Bell className="h-8 w-8 mb-4 opacity-10" />
                                <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">All caught up!</p>
                                <p className="text-xs text-slate-500 leading-relaxed">Check back later for Botswana health updates.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {notifications.map((notif) => (
                                    <DropdownMenuItem
                                        key={notif.id}
                                        onClick={() => !notif.is_read && markAsRead(notif.id)}
                                        className={`px-5 py-4 cursor-pointer outline-none transition-all duration-150 flex items-start gap-4 border-b border-border/5 last:border-0
                                            ${!notif.is_read
                                                ? 'bg-primary/[0.03] hover:bg-primary/[0.08] dark:bg-primary/[0.02] dark:hover:bg-primary/[0.05]'
                                                : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'}
                                        `}
                                    >
                                        <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${getBgColor(notif.type)}`}>
                                            {getIcon(notif.type)}
                                        </div>
                                        <div className="flex-1 min-w-0 pr-1">
                                            <div className="flex items-start justify-between gap-3 mb-1.5">
                                                <h5 className={`text-[14px] leading-[1.4] tracking-tight ${notif.is_read ? 'text-slate-600 dark:text-slate-400 font-medium' : 'text-slate-900 dark:text-white font-bold'}`}>
                                                    {notif.title}
                                                </h5>
                                                {!notif.is_read && (
                                                    <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1 shadow-[0_0_8px_rgba(20,140,139,0.4)]" />
                                                )}
                                            </div>
                                            <div className="w-full">
                                                <p className={`text-[13px] leading-[1.6] whitespace-normal break-all overflow-visible block text-pretty ${notif.is_read ? 'text-slate-500/90' : 'text-slate-600 dark:text-slate-300 font-normal'}`}>
                                                    <DecryptedDescription text={notif.description} />
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">
                                                    {getTimeAgo(notif.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="p-2 border-t border-border/5">
                    <Button
                        variant="ghost"
                        onClick={markAllAsRead}
                        className="w-full text-xs h-9 text-primary hover:text-primary/90 hover:bg-primary/5 font-bold"
                    >
                        Mark all as read
                    </Button>
                </div>

                <style dangerouslySetInnerHTML={{
                    __html: `
                    [role="menuitem"] {
                        margin: 0 4px;
                        border-radius: 8px;
                    }
                `}} />
            </DropdownMenuContent>
        </DropdownMenu >
    );
};
