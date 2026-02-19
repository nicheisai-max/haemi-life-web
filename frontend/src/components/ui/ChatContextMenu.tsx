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
    // Adjust position to keep within viewport
    // Menu width matching w-[280px] below
    const menuWidth = 280;
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

                className="fixed z-[100] w-[280px] flex flex-col bg-white dark:bg-[#1e293b] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden font-sans pointer-events-auto"
            >
                {/* Reaction Bar - Microsoft Teams Style */}
                <div className="p-2 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-start gap-2">
                    {[
                        { id: 'like', emoji: '👍', label: 'Like' },
                        { id: 'love', emoji: '❤️', label: 'Love' },
                        { id: 'laugh', emoji: '😂', label: 'Laugh' },
                        { id: 'wow', emoji: '😲', label: 'Wow' },
                        { id: 'sad', emoji: '😢', label: 'Sad' },
                        { id: 'angry', emoji: '😡', label: 'Angry' },
                    ].map((reaction) => (
                        <button
                            key={reaction.id}
                            onClick={() => { onReact(reaction.id); onClose(); }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all hover:scale-125 active:scale-95 group relative flex items-center justify-center transform origin-bottom"
                            title={reaction.label}
                        >
                            <span className="text-lg leading-none filter drop-shadow-sm group-hover:drop-shadow-md transition-all select-none">
                                {reaction.emoji}
                            </span>
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

