import React, { useEffect, useRef } from 'react';
import { Trash2, XCircle, Copy, Reply } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatContextMenuProps {
    x: number;
    y: number;
    isMe: boolean;
    onClose: () => void;
    onDeleteForMe: () => void;
    onDeleteForEveryone?: () => void;
    onReact: (reactionType: string) => void;
    onReply: () => void;
    onCopy: () => void;
}

export const ChatContextMenu: React.FC<ChatContextMenuProps> = ({
    x,
    y,
    isMe,
    onClose,
    onDeleteForMe,
    onDeleteForEveryone,
    onReact,
    onReply,
    onCopy
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Adjust position to keep within viewport
    // Menu width w-56 (14rem = 224px)
    // Menu height approx 300px
    const menuWidth = 240;
    const menuHeight = 320;

    let adjustedX = x;
    let adjustedY = y;

    // Check right edge
    if (x + menuWidth > window.innerWidth) {
        adjustedX = x - menuWidth;
    }

    // Check bottom edge
    if (y + menuHeight > window.innerHeight) {
        adjustedY = y - menuHeight;
    }

    // Check left edge (if shifted left goes off screen)
    if (adjustedX < 10) adjustedX = 10;

    // Check top edge
    if (adjustedY < 10) adjustedY = 10;

    return (
        <AnimatePresence>
            <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{ top: adjustedY, left: adjustedX }}
                className="fixed z-[100] w-56 flex flex-col bg-white dark:bg-[#1e293b] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden font-sans"
            >
                {/* Reaction Bar */}
                <div className="p-3 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50 grid grid-cols-6 gap-2 place-items-center">
                    {[
                        { id: 'thumbs_up', icon: <ThumbUpIcon />, label: 'Like' },
                        { id: 'love', icon: <HeartIcon />, label: 'Love' },
                        { id: 'appreciation', icon: <AppreciationIcon />, label: 'Pray' },
                        { id: 'acknowledgement', icon: <SmileIcon />, label: 'Smile' },
                        { id: 'noted', icon: <SurpriseIcon />, label: 'Wow' },
                        { id: 'agreement', icon: <HandshakeIcon />, label: 'Deal' },
                    ].map((reaction) => (
                        <button
                            key={reaction.id}
                            onClick={() => { onReact(reaction.id); onClose(); }}
                            className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-all hover:scale-110 active:scale-95 group relative"
                            title={reaction.label}
                        >
                            <div className="w-6 h-6 text-slate-500 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                {reaction.icon}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Actions */}
                <div className="p-2 flex flex-col gap-1">
                    <button
                        onClick={() => { onReply(); onClose(); }}
                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left w-full group"
                    >
                        <Reply className="w-4 h-4 text-slate-400 group-hover:text-teal-500 transition-colors" />
                        Reply
                    </button>
                    <button
                        onClick={() => { onCopy(); onClose(); }}
                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left w-full group"
                    >
                        <Copy className="w-4 h-4 text-slate-400 group-hover:text-teal-500 transition-colors" />
                        Copy
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-slate-700/50" />

                    <button
                        onClick={() => { onDeleteForMe(); onClose(); }}
                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left w-full group"
                    >
                        <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-rose-500 transition-colors" />
                        Delete for me
                    </button>

                    {isMe && onDeleteForEveryone && (
                        <button
                            onClick={() => { onDeleteForEveryone(); onClose(); }}
                            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors text-left w-full"
                        >
                            <XCircle className="w-4 h-4 text-rose-500" />
                            Delete for everyone
                        </button>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

// --- Custom Emojis (SVG) - Consistent Professional Family ---
// StrokeWidth: 2, same visual weight, healthcare tone

const ThumbUpIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
);

const HeartIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);

const AppreciationIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5" />
        <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v11" />
        <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
);

const SmileIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
);

const SurpriseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="16" r="2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
);

const HandshakeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m11 17 2 2 6-6" />
        <path d="m18 14 1.5 1.5" />
        <path d="m15 11 1.5 1.5" />
        <path d="M5 10a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3.14l1.2-1.2a2 2 0 0 1 1.44-.57L14 15.2M14 15.2c1-.1 1.8-.8 2-1.8.3-1.4-.7-2.6-2-2.6M14 15.2l1.3-3.7" />
        <path d="M8 15V8a2 2 0 0 1 2-2h1c.6 0 1.2.2 1.6.6l1.4 1.4" />
    </svg>
);
