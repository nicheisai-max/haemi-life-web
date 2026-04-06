import { Bell, Check, Info, Zap, CheckCheck } from 'lucide-react';
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
import { useNotifications } from '../../hooks/use-notifications';
import { decrypt } from '@/utils/security';
import React, { useState, useEffect, useRef } from 'react';

/* ──────────────────────────────────────────────
   Decrypted Description
────────────────────────────────────────────── */
const DecryptedDescription: React.FC<{ text: string }> = ({ text }) => {
    const [decrypted, setDecrypted] = useState(text);
    const [prevText, setPrevText] = useState(text);

    if (text !== prevText) {
        setPrevText(text);
        setDecrypted(text);
    }

    useEffect(() => {
        if (text && text.startsWith('enc:')) {
            decrypt(text)
                .then(res => res.startsWith('enc:') ? decrypt(res) : res)
                .then(res => setDecrypted(res))
                .catch(() => setDecrypted('Message encrypted.'));
        }
    }, [text]);

    return <span className="break-all">{decrypted}</span>;
};

/* ──────────────────────────────────────────────
   Time Ago
────────────────────────────────────────────── */
const getTimeAgo = (dateString: string) => {
    try {
        const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
        if (seconds < 60) return 'Just now';
        const mins = Math.floor(seconds / 60);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        return new Date(dateString).toLocaleDateString();
    } catch {
        return 'Recently';
    }
};

/* ──────────────────────────────────────────────
   Icon & Color helpers
────────────────────────────────────────────── */
const getIcon = (notif: Notification) => {
    switch (notif.type) {
        case 'success': return <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />;
        case 'warning': return <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={3} />;
        case 'info': return <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" strokeWidth={3} fill="currentColor" />;
        default: return <Bell className="h-4 w-4 text-slate-600 dark:text-slate-400" />;
    }
};

const getBgColor = (notif: Notification) => {
    switch (notif.type) {
        case 'success': return 'bg-emerald-100 dark:bg-emerald-900/30';
        case 'warning': return 'bg-amber-100 dark:bg-amber-900/30';
        case 'info': return 'bg-indigo-100 dark:bg-indigo-900/30';
        default: return 'bg-slate-100 dark:bg-slate-800/30';
    }
};

/* ──────────────────────────────────────────────
   Notification Item with Smart Ack
   Click → 1s delay → slide-out → mark as read
────────────────────────────────────────────── */
interface NotificationItemProps {
    notif: Notification;
    onRead: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notif, onRead }) => {
    const [isSliding, setIsSliding] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleClick = () => {
        if (notif.isRead || isSliding) return;

        setIsSliding(true);
        timerRef.current = setTimeout(() => {
            onRead(notif.id);
        }, 800); // 800ms for animation, then mark as read
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return (
        <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            onClick={handleClick}
            className={`
                px-5 py-4 cursor-pointer outline-none flex items-start gap-4 
                border-b border-border/5 last:border-0
                transition-all duration-200 ease-in-out transform
                ${isSliding ? 'opacity-0 -translate-x-4 scale-95' : 'opacity-100 translate-x-0 scale-100'}
                ${!notif.isRead
                    ? 'bg-primary/[0.03] hover:bg-primary/[0.08] dark:bg-primary/[0.02] dark:hover:bg-primary/[0.05]'
                    : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'}
            `}
        >
            <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${getBgColor(notif)}`}>
                {getIcon(notif)}
            </div>
            <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h5 className={`text-[14px] leading-[1.4] tracking-tight ${notif.isRead
                        ? 'text-slate-600 dark:text-slate-400 font-medium'
                        : 'text-slate-900 dark:text-white font-bold'
                    }`}>
                        {notif.title}
                    </h5>
                    {!notif.isRead && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1 shadow-[0_0_8px_rgba(20,140,139,0.4)] animate-pulse" />
                    )}
                </div>
                <p className={`text-[13px] leading-[1.6] whitespace-normal break-all block text-pretty ${
                    notif.isRead ? 'text-slate-500/90' : 'text-slate-600 dark:text-slate-300'
                }`}>
                    <DecryptedDescription text={notif.description} />
                </p>
                <span className="mt-2 block text-[10px] text-slate-400 font-semibold tracking-wide uppercase">
                    {getTimeAgo(notif.createdAt)}
                </span>
            </div>
        </DropdownMenuItem>
    );
};

/* ──────────────────────────────────────────────
   All Caught Up Empty State
────────────────────────────────────────────── */
const AllCaughtUp: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-[280px] p-8 text-center select-none">
        <div className="relative mb-5">
            <div className="h-16 w-16 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                <CheckCheck className="h-7 w-7 text-primary" strokeWidth={2.5} />
            </div>
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center text-[8px] text-white font-bold">✓</span>
        </div>
        <p className="text-[15px] font-bold text-slate-900 dark:text-white mb-1.5">You're all caught up!</p>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-[200px]">
            No new notifications. Check back for Haemi health updates.
        </p>
    </div>
);

/* ──────────────────────────────────────────────
   Main Notification Menu
────────────────────────────────────────────── */
export const NotificationMenu: React.FC = () => {
    const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleClose = () => setIsOpen(false);
        window.addEventListener('haemi-close-notifications', handleClose);
        return () => window.removeEventListener('haemi-close-notifications', handleClose);
    }, []);

    useEffect(() => {
        if (isOpen) {
            window.dispatchEvent(new CustomEvent('haemi-close-chathub'));
            window.dispatchEvent(new CustomEvent('haemi-close-copilot'));
        }
    }, [isOpen]);

    const hasUnread = unreadCount > 0;

    return (
        <DropdownMenu modal={false} open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="navAction"
                    className="haemi-nav-action-circle haemi-ignore-click-outside relative text-muted-foreground hover:text-primary transition-all duration-300"
                >
                    <Bell className={`h-5 w-5 transition-all duration-300 ${hasUnread ? 'text-primary' : ''}`} />
                    {unreadCount > 0 && (
                        <span className="absolute top-[11px] right-[11px] h-2 w-2 rounded-full bg-red-500 border-2 border-background animate-pulse" />
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                className="w-[340px] p-0 overflow-hidden border-border/10 shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl"
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-border/5 flex items-center justify-between bg-white/50 dark:bg-white/5">
                    <h4 className="font-bold text-base tracking-tight text-slate-900 dark:text-slate-100">
                        Notifications
                    </h4>
                    {unreadCount > 0 && (
                        <Badge
                            variant="secondary"
                            className="bg-primary/10 text-primary dark:bg-primary/20 rounded-full px-2 py-0 text-[10px] font-bold border-none"
                        >
                            {unreadCount} NEW
                        </Badge>
                    )}
                </div>

                {/* List */}
                <ScrollArea className="h-[320px]">
                    <div className="flex flex-col">
                        {loading && notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground p-8 text-center space-y-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                                <p className="text-sm font-medium">Syncing...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <AllCaughtUp />
                        ) : (
                            <div className="flex flex-col">
                                {notifications.map((notif) => (
                                    <NotificationItem
                                        key={notif.id}
                                        notif={notif}
                                        onRead={markAsRead}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Footer */}
                {notifications.length > 0 && (
                    <div className="p-2 border-t border-border/5">
                        <Button
                            variant="ghost"
                            onClick={markAllAsRead}
                            disabled={!hasUnread}
                            className="w-full text-xs h-9 text-primary hover:text-primary/90 hover:bg-primary/5 font-bold disabled:opacity-40"
                        >
                            Mark all as read
                        </Button>
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
