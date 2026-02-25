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
    parentWidth?: number;
    parentHeight?: number;
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
    onCopy,
    parentWidth = 400,
    parentHeight = 600
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 640);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Dimensions - Using sleek, responsive sizing
    const menuWidth = isMobile ? window.innerWidth : 300;
    const menuHeight = isMobile ? 320 : 340;
    let adjustedX = x;
    let adjustedY = y;

    if (!isMobile) {
        // Advanced edge detection relative to parent container
        if (x + menuWidth > parentWidth) adjustedX = x - menuWidth;
        if (y + menuHeight > parentHeight) adjustedY = y - menuHeight;

        // Final safety bounds within parent
        adjustedX = Math.max(8, Math.min(adjustedX, parentWidth - menuWidth - 8));
        adjustedY = Math.max(8, Math.min(adjustedY, parentHeight - menuHeight - 8));
    }

    const reactions = [
        { id: 'like', emoji: '👍' },
        { id: 'love', emoji: '❤️' },
        { id: 'laugh', emoji: '😂' },
        { id: 'wow', emoji: '😲' },
        { id: 'sad', emoji: '😢' },
        { id: 'angry', emoji: '😡' },
    ];

    return (
        <AnimatePresence>
            {/* Dark Backdrop for Mobile */}
            {isMobile && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/60 backdrop-blur-md z-[900]"
                />
            )}

            <motion.div
                ref={menuRef}
                initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.98, y: 10 }}
                animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.98 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                style={isMobile ? {} : {
                    top: adjustedY,
                    left: adjustedX,
                    width: 'clamp(260px, 85%, 300px)'
                }}
                className={`${isMobile ? 'fixed' : 'absolute'} z-[1000] ${isMobile
                    ? 'bottom-0 left-0 right-0 rounded-t-[28px] pb-10 pt-3 px-6'
                    : 'rounded-2xl p-1.5'
                    } bg-white dark:bg-[#111d21] shadow-[0_20px_60px_rgba(0,0,0,0.35)] border border-slate-200/40 dark:border-white/10 overflow-visible font-sans pointer-events-auto`}
            >
                {isMobile && (
                    <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700/50 rounded-full mx-auto mb-6" />
                )}

                {/* Microsoft Teams Style Reaction Bar - Simplified & Sleeker */}
                <div className={`flex items-center justify-between ${isMobile ? 'mb-8 px-1' : 'mb-2 p-1.5 bg-slate-50/60 dark:bg-white/5 rounded-xl'}`}>
                    {reactions.map((reaction) => (
                        <button
                            key={reaction.id}
                            onClick={() => { onReact(reaction.id); onClose(); }}
                            className="w-9 h-9 sm:w-8 sm:h-8 rounded-full transition-all duration-200 flex items-center justify-center transform hover:scale-[1.15] active:scale-95 group relative"
                        >
                            <span className={`${isMobile ? 'text-4xl' : 'text-2xl'} leading-none select-none filter group-hover:drop-shadow-sm`}>
                                {reaction.emoji}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Premium Action List - Compact & Sleek */}
                <div className="flex flex-col space-y-0.5">
                    <button
                        onClick={() => { onReply(); onClose(); }}
                        className="flex items-center gap-3.5 px-3.5 py-3 sm:py-2.5 text-[16px] sm:text-[13.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg transition-all w-full group outline-none"
                    >
                        <Reply className="w-5 h-5 sm:w-3.5 sm:h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                        Reply to message
                    </button>

                    <button
                        onClick={() => { onCopy(); onClose(); }}
                        className="flex items-center gap-3.5 px-3.5 py-3 sm:py-2.5 text-[16px] sm:text-[13.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg transition-all w-full group outline-none"
                    >
                        <Copy className="w-5 h-5 sm:w-3.5 sm:h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                        Copy text
                    </button>

                    <div className="my-1.5 mx-1.5 border-t border-slate-100 dark:border-white/5" />

                    <button
                        onClick={() => { onDeleteForMe(); onClose(); }}
                        className="flex items-center gap-3.5 px-3.5 py-3 sm:py-2.5 text-[16px] sm:text-[13.5px] font-medium text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-all w-full group outline-none"
                    >
                        <Trash2 className="w-5 h-5 sm:w-3.5 sm:h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                        Delete for me
                    </button>

                    {isMe && onDeleteForEveryone && (
                        <button
                            onClick={() => { onDeleteForEveryone(); onClose(); }}
                            className="flex items-center gap-3.5 px-3.5 py-3 sm:py-2.5 text-[16px] sm:text-[13.5px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg transition-all w-full outline-none"
                        >
                            <XCircle className="w-5 h-5 sm:w-3.5 sm:h-3.5" />
                            Delete for everyone
                        </button>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
