import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from './button';
import {
    MessageSquare, X, Minus,
    ChevronLeft,
    ShieldCheck, Search, CheckCheck,
    Paperclip, Send, Plus, UserPlus,
    MessageCircle, Reply,
    Maximize2, Loader2, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat, type Conversation, type Message } from '../../hooks/useChat';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import api from '../../services/api';
import type { DoctorProfile } from '../../services/doctor.service';
import doctor01 from '../../assets/images/doctors/doctor_01.jpg';
import doctor02 from '../../assets/images/doctors/doctor_02.png';
import doctor03 from '../../assets/images/doctors/doctor_03.png';
import { useLocation } from 'react-router-dom';
import { useClickOutside } from '../../hooks/useClickOutside';

// Override helper to get images
const getDoctorImage = (name: string) => {
    if (!name) return undefined;
    if (name.includes('Dr. Thabo') || name.includes('Kgosi')) return doctor01;
    if (name.includes('Dr. Lorato') || name.includes('Molefe')) return doctor02;
    if (name.includes('Dr. Neo') || name.includes('Mousi')) return doctor03;
    // Fallback deterministic mapping for demo
    if (name.length % 2 === 0) return doctor01;
    return doctor02;
};

// --- Premium Avatar Component ---
const Avatar: React.FC<{ name: string; initials?: string; image?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }> = ({ name, initials, image, size = 'md', className = "" }) => {
    const sizeClasses = {
        xs: 'h-6 w-6 text-[9px]',
        sm: 'h-8 w-8 text-[11px]',
        md: 'h-10 w-10 text-xs',
        lg: 'h-12 w-12 text-sm',
        xl: 'h-16 w-16 text-lg'
    };

    const getInitials = (n: string) => n ? n.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() : '?';

    // Deterministic gradient based on name length/char
    const gradients = [
        'bg-gradient-to-br from-blue-400 to-indigo-600',
        'bg-gradient-to-br from-emerald-400 to-teal-600',
        'bg-gradient-to-br from-orange-400 to-red-600',
        'bg-gradient-to-br from-pink-400 to-rose-600',
        'bg-gradient-to-br from-violet-400 to-purple-600',
    ];
    const gradientIndex = name ? name.length % gradients.length : 0;
    const bgClass = gradients[gradientIndex];

    const [imgError, setImgError] = useState(false);

    return (
        <div className={`relative shrink-0 ${className}`}>
            <div className={`${sizeClasses[size]} rounded-full overflow-hidden ${bgClass} flex items-center justify-center shadow-sm border border-white/20 text-white font-bold tracking-wider`}>
                {image && !imgError ? (
                    <img src={image} alt={name} className="h-full w-full object-cover" onError={() => setImgError(true)} />
                ) : (
                    initials || getInitials(name)
                )}
            </div>
        </div>
    );
};

// --- Reaction Icon Helper (Updated to Teams-style Emojis) ---
const ReactionIcon: React.FC<{ type: string; className?: string }> = ({ type, className = "text-lg" }) => {
    // Map both old IDs (fallback) and new IDs to Emojis
    switch (type) {
        case 'like':
        case 'thumbs_up': return <span className={className}>👍</span>;
        case 'love': return <span className={className}>❤️</span>;
        case 'laugh':
        case 'appreciation': return <span className={className}>😂</span>; // Map appreciation to laugh for now or 👏 if preferred
        case 'wow':
        case 'noted': return <span className={className}>😲</span>;
        case 'sad':
        case 'acknowledgement': return <span className={className}>😢</span>;
        case 'angry':
        case 'agreement': return <span className={className}>😡</span>;
        default: return <span className={className}>👍</span>;
    }
};

import { ChatContextMenu } from './ChatContextMenu'; // Iimport { TransitionItem } from '../layout/PageTransition';
import { AuthenticatedImage } from './AuthenticatedImage';

// --- Main Chat Hub ---
export const ChatHub: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation(); // Hook for route changes
    // Close on click outside using robust capture-phase hook
    const containerRef = useClickOutside<HTMLDivElement>(() => setIsOpen(false));

    const {
        conversations,
        activeConversation,
        messages,
        fetchConversations,
        selectConversation,
        sendMessage,
        uploadAttachment,
        startNewConversation,
        deleteMessage, // Destructure new functions
        reactToMessage
    } = useChat();

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [view, setView] = useState<'contacts' | 'conversation' | 'new-chat'>('contacts');
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [doctors, setDoctors] = useState<DoctorProfile[]>([]); // List of doctors for new chat
    const [doctorSearch, setDoctorSearch] = useState('');
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{
        isOpen: boolean;
        x: number;
        y: number;
        messageId: string;
        isMe: boolean;
        parentWidth: number;
        parentHeight: number;
    }>({
        isOpen: false,
        x: 0,
        y: 0,
        messageId: '',
        isMe: false,
        parentWidth: 0,
        parentHeight: 0
    });

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const chatWindowRef = useRef<HTMLDivElement>(null);

    const handleDownload = async (messageId: string, fileName: string) => {
        try {
            setDownloadingId(messageId);
            const response = await api.get(`/files/message/${messageId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName || 'attachment');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
        } finally {
            setDownloadingId(null);
        }
    };

    // Handlers for Context Menu
    const handleDeleteMessage = (messageId: string, forEveryone: boolean) => {
        deleteMessage(messageId, forEveryone);
        setContextMenu(prev => ({ ...prev, isOpen: false }));
    };

    const handleReaction = (messageId: string, reactionType: string) => {
        reactToMessage(messageId, reactionType);
        setContextMenu(prev => ({ ...prev, isOpen: false }));
    };

    // Initial Load
    useEffect(() => {
        if (isOpen) {
            fetchConversations();
        }
    }, [isOpen, fetchConversations]);

    // Load Doctors when entering 'new-chat' view
    useEffect(() => {
        if (view === 'new-chat') {
            const loadDoctors = async () => {
                try {
                    const res = await api.get('/doctor'); // Corrected endpoint
                    // Handle both direct array and nested .data response
                    const doctorData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                    setDoctors(doctorData);
                } catch (error) {
                    console.error("Failed to load doctors", error);
                    setDoctors([]); // Set empty array on error
                }
            };
            loadDoctors();
        }
    }, [view]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, view, isOpen]);

    // Auto-close on route change
    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname]);

    const toggleChat = () => {
        if (!isOpen) {
            // Close clinical copilot if it's open
            window.dispatchEvent(new CustomEvent('haemi-close-copilot'));
        }
        setIsOpen(!isOpen);
    };

    // Coordination: Listen for event to close chathub (e.g. from ClinicalCopilot)
    useEffect(() => {
        const handleCloseChatHub = () => {
            setIsOpen(false);
        };
        window.addEventListener('haemi-close-chathub', handleCloseChatHub);
        return () => window.removeEventListener('haemi-close-chathub', handleCloseChatHub);
    }, []);

    const handleSelectConversation = (conversation: Conversation) => {
        selectConversation(conversation);
        setView('conversation');
    };

    const handleStartNewChat = async (doctor: DoctorProfile) => {
        // optimistically check if conversation exists
        const existing = conversations.find((c: Conversation) =>
            c.participants && Array.isArray(c.participants) &&
            c.participants.some(p => p.id === doctor.id)
        );
        if (existing) {
            handleSelectConversation(existing);
        } else {
            await startNewConversation(doctor.id);
            setView('conversation'); // startNewConversation usually updates state/refetches
        }
    };

    const handleSendMessage = () => {
        if (!newMessage.trim() || !activeConversation) return;
        sendMessage(newMessage, activeConversation.id, undefined, undefined, replyingTo?.id);
        setNewMessage('');
        setReplyingTo(null);
        // Keep focus
        setTimeout(() => inputRef.current?.focus(), 10);
    };

    const getOtherParticipant = (conversation: Conversation) => {
        const other = (conversation.participants && Array.isArray(conversation.participants))
            ? conversation.participants.find(p => p.id !== user?.id) || { name: 'Unknown', role: 'Unknown', id: 'unknown' }
            : { name: 'Unknown', role: 'Unknown', id: 'unknown' };

        // Cast to any to safely access profile_image from dynamic participant data
        const participant = other as any;
        const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000');
        const dbImage = `${baseUrl}/api/files/profile/${participant.id}`;
        return { ...other, image: dbImage, initials: participant.initials };
    };

    const filteredConversations = useMemo(() => conversations.filter(c => {
        const other = getOtherParticipant(c);
        const matchesSearch = other.name.toLowerCase().includes(searchTerm.toLowerCase());

        // Polishing rule: Hide chats that are encrypted placeholders or generic "Start a conversation"
        // provided they are not the "fresh" ones intended to be seen.
        // We only show chats that have real human content or are the explicitly allowed "Hi Doctor!"
        const isFresh = c.last_message === 'Hi Doctor!' || (c.unread_count && parseInt(c.unread_count) > 0);
        const isEncrypted = c.last_message?.startsWith('enc:') || c.last_message?.startsWith('enc-');
        const isGeneric = c.last_message === 'Start a conversation' || !c.last_message;

        return matchesSearch && (isFresh || (!isEncrypted && !isGeneric));
    }), [conversations, searchTerm, user]);

    const filteredDoctors = useMemo(() => doctors.filter(d => {
        const name = d.name || '';
        return name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
            d.specialization?.toLowerCase().includes(doctorSearch.toLowerCase());
    }), [doctors, doctorSearch]);

    const getFormattedTime = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return format(date, 'HH:mm');
    };



    // Close on click outside using robust capture-phase hook



    // --- Render Minimized State ---
    if (!isOpen && !isMinimized) {
        return (
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="fixed bottom-6 right-6 z-[60]"
            >
                {/* Pulse Effect */}
                <span className="absolute inline-flex h-full w-full rounded-full animate-ping bg-teal-400 opacity-20 duration-1000"></span>

                <Button
                    onClick={toggleChat}
                    className="relative h-16 w-16 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 shadow-2xl shadow-teal-500/40 p-0 flex items-center justify-center group border border-white/20 dark:border-white/10 overflow-hidden"
                    aria-label="Open chat"
                >
                    {/* Inner Glow */}
                    <div className="absolute inset-0 bg-white/20 blur-xl group-hover:bg-white/30 transition-all duration-500" />

                    <MessageCircle className="relative h-8 w-8 text-white drop-shadow-md group-hover:scale-110 transition-transform duration-300" strokeWidth={2.5} />

                    {conversations.some(c => parseInt(c.unread_count) > 0) && (
                        <span className="absolute top-3 right-3 h-3.5 w-3.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800 shadow-sm z-10" />
                    )}
                </Button>
            </motion.div>
        );
    }

    if (isMinimized) {
        return (
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="fixed bottom-6 right-6 z-[60]"
            >
                <Button
                    onClick={() => setIsMinimized(false)}
                    className="h-16 w-16 rounded-full bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/50 p-0 flex items-center justify-center group border border-slate-200 dark:border-slate-700 overflow-hidden"
                >
                    {activeConversation ? (
                        <Avatar name={getOtherParticipant(activeConversation).name} initials={getOtherParticipant(activeConversation).initials} image={getOtherParticipant(activeConversation).image} size="md" className="h-full w-full rounded-none opacity-90 group-hover:opacity-100 transition-opacity" />
                    ) : (
                        <MessageCircle className="h-8 w-8 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform duration-300" strokeWidth={2.5} />
                    )}
                    {conversations.some(c => parseInt(c.unread_count) > 0) && (
                        <span className="absolute top-3 right-3 h-3.5 w-3.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800 z-10" />
                    )}
                </Button>
            </motion.div>
        );
    }

    // --- Render Main Window ---
    return (
        <div ref={containerRef} className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-4 pointer-events-none font-sans">
            <style>
                {`
                    .chat-scrollbar::-webkit-scrollbar { width: 4px; }
                    .chat-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .chat-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                    .dark .chat-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
                `}
            </style>
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key="chat-window"
                    drag
                    dragMomentum={false}
                    initial={{ y: 20, opacity: 0, scale: 0.95 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 20, opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="pointer-events-auto bg-white dark:bg-[#1a1c23] rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/10 w-[380px] sm:w-[420px] max-w-[calc(100vw-32px)] h-[650px] max-h-[80vh] flex flex-col overflow-hidden ring-1 ring-black/5 relative"
                    ref={chatWindowRef}
                >
                    {/* --- Helper: Header --- */}
                    <div className="shrink-0 bg-[#026355] dark:bg-[#1a1c23]/95 backdrop-blur z-20">
                        <div className="px-5 py-4 flex items-center justify-between border-b border-white/10 dark:border-white/5">
                            <div className="flex items-center gap-3">
                                {view !== 'contacts' && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-full text-white/80 hover:bg-white/10 dark:hover:bg-slate-800 transition-colors shrink-0"
                                        onClick={() => setView('contacts')}
                                    >
                                        <ChevronLeft className="h-5 w-5 text-white" />
                                    </Button>
                                )}

                                {view === 'conversation' && activeConversation ? (
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="relative shrink-0">
                                            <Avatar name={getOtherParticipant(activeConversation).name} initials={getOtherParticipant(activeConversation).initials} image={getOtherParticipant(activeConversation).image} size="sm" />
                                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-[#1a1c23] rounded-full"></span>
                                        </div>
                                        <div className="flex flex-col truncate">
                                            <h3 className="text-sm font-bold text-white truncate leading-tight">
                                                {getOtherParticipant(activeConversation).name}
                                            </h3>
                                            <span className="text-[11px] text-teal-100 dark:text-teal-400 font-medium truncate leading-tight capitalize">
                                                {getOtherParticipant(activeConversation).role}
                                            </span>
                                        </div>
                                    </div>
                                ) : view === 'new-chat' ? (
                                    <h3 className="text-lg font-bold text-white tracking-tight">New Message</h3>
                                ) : (
                                    <div className="flex flex-col">
                                        <h3 className="text-lg font-bold text-white tracking-tight leading-none">Messages</h3>
                                        <span className="text-[11px] text-teal-100/80 dark:text-slate-400 font-medium mt-1">
                                            {filteredConversations.length} {filteredConversations.length === 1 ? 'conversation' : 'conversations'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-white/60 hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
                                    onClick={() => setIsMinimized(true)}
                                >
                                    <Minus className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-white/60 hover:text-white hover:bg-white/10 dark:hover:bg-rose-500/10 transition-colors"
                                    onClick={toggleChat}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Encryption Banner */}
                        <div className="py-2 bg-slate-100/80 dark:bg-black/40 border-b border-slate-200/50 dark:border-white/5 flex items-center justify-center gap-2 backdrop-blur-md">
                            <ShieldCheck className="h-3 w-3 text-slate-900/60 dark:text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-900 dark:text-slate-300 uppercase tracking-widest text-center">
                                End-to-end Encrypted
                            </span>
                        </div>
                    </div>

                    {/* --- Content Area --- */}
                    <div className="flex-1 overflow-hidden relative bg-slate-50 dark:bg-slate-950">
                        <AnimatePresence mode="wait" initial={false}>

                            {/* VIEW: CONTACTS LIST */}
                            {view === 'contacts' && (
                                <motion.div
                                    key="contacts"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.15 }}
                                    className="h-full flex flex-col"
                                >
                                    <div className="p-3">
                                        <div className="relative group">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                                            <input
                                                type="text"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Search messages..."
                                                className="w-full h-10 pl-9 pr-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto chat-scrollbar px-2 space-y-1">
                                        {filteredConversations.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-48 text-center px-6 opacity-60 mt-10">
                                                <div className="h-12 w-12 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-3">
                                                    <MessageSquare className="h-6 w-6 text-slate-400" />
                                                </div>
                                                <p className="text-sm font-medium text-slate-900 dark:text-white">No messages yet</p>
                                                <p className="text-xs text-slate-500 mt-1">Start a consultation or chat with a doctor.</p>
                                            </div>
                                        ) : (
                                            filteredConversations.map(conv => {
                                                const other = getOtherParticipant(conv);
                                                return (
                                                    <button
                                                        key={conv.id}
                                                        onClick={() => handleSelectConversation(conv)}
                                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 dark:hover:bg-accent/20 hover:shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all text-left group"
                                                    >
                                                        <Avatar name={other.name} initials={other.initials} image={other.image} size="md" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-center mb-0.5">
                                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">
                                                                    {other.name}
                                                                </h4>
                                                                <span className="text-[10px] font-medium text-slate-400 shrink-0">
                                                                    {getFormattedTime(conv.last_message_at)}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center gap-2">
                                                                <p className="text-xs text-slate-500 truncate dark:text-slate-400">
                                                                    {conv.last_message || 'Start a conversation'}
                                                                </p>
                                                                {parseInt(conv.unread_count) > 0 && (
                                                                    <span className="h-4 min-w-[16px] px-1 rounded-full bg-teal-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                                                                        {conv.unread_count}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* FAB: New Chat */}
                                    <div className="absolute bottom-4 right-4">
                                        <Button
                                            onClick={() => setView('new-chat')}
                                            className="h-12 w-12 rounded-full bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/30 flex items-center justify-center text-white p-0"
                                        >
                                            <Plus className="h-6 w-6" />
                                        </Button>
                                    </div>
                                </motion.div>
                            )}

                            {/* VIEW: NEW CHAT (Doctor Directory) */}
                            {view === 'new-chat' && (
                                <motion.div
                                    key="new-chat"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.15 }}
                                    className="h-full flex flex-col bg-slate-50 dark:bg-slate-950"
                                >
                                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 z-10">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                type="text"
                                                autoFocus
                                                value={doctorSearch}
                                                onChange={(e) => setDoctorSearch(e.target.value)}
                                                placeholder="Search doctors by name or specialty..."
                                                className="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-teal-500 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto chat-scrollbar p-2">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-2">Available Specialists</div>
                                        {filteredDoctors.length === 0 ? (
                                            <div className="p-6 text-center text-slate-500 text-sm">
                                                No doctors found.
                                            </div>
                                        ) : (
                                            filteredDoctors.map((doc: any) => (
                                                <button
                                                    key={doc.id}
                                                    onClick={() => handleStartNewChat(doc)}
                                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 dark:hover:bg-accent/20 hover:shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all text-left group"
                                                >
                                                    <Avatar name={doc.user?.name || doc.name} initials={doc.user?.initials || doc.initials} image={getDoctorImage(doc.user?.name || doc.name)} size="md" />
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                                                            {doc.user?.name || doc.name}
                                                        </h4>
                                                        <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">
                                                            {doc.specialization || 'General Practitioner'}
                                                        </p>
                                                    </div>
                                                    <UserPlus className="h-4 w-4 text-slate-300 hover:text-teal-500" />
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            )}


                            {/* VIEW: CONVERSATION */}
                            {view === 'conversation' && (
                                <motion.div
                                    key="conversation"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.15 }}
                                    className="h-full flex flex-col relative"
                                >
                                    {/* Messages list */}
                                    <div
                                        ref={scrollRef}
                                        className="flex-1 overflow-y-auto p-4 space-y-4 chat-scrollbar z-0"
                                    >
                                        <div className="h-2" />
                                        {messages.map((msg, idx) => (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                key={msg.id || idx}
                                                id={`msg-${msg.id}`}
                                                className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} group`}
                                            >
                                                <div
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        if (chatWindowRef.current) {
                                                            const rect = chatWindowRef.current.getBoundingClientRect();
                                                            setContextMenu({
                                                                isOpen: true,
                                                                x: e.clientX - rect.left,
                                                                y: e.clientY - rect.top,
                                                                messageId: msg.id,
                                                                isMe: msg.isMe || false,
                                                                parentWidth: rect.width,
                                                                parentHeight: rect.height
                                                            });
                                                        }
                                                    }}
                                                    className={`max-w-[85%] p-3 rounded-2xl shadow-sm text-sm relative cursor-context-menu group ${msg.isMe
                                                        ? 'bg-teal-600 text-white rounded-tr-none'
                                                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none'
                                                        }`}
                                                >
                                                    {/* Reply Preview in Bubble (Enhanced WhatsApp Style) */}
                                                    {msg.reply_to && (
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const element = document.getElementById(`msg-${msg.reply_to_id}`);
                                                                if (element) {
                                                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                    element.classList.add('ring-2', 'ring-teal-500', 'ring-offset-2');
                                                                    setTimeout(() => element.classList.remove('ring-2', 'ring-teal-500', 'ring-offset-2'), 2000);
                                                                }
                                                            }}
                                                            className={`mb-2 p-2 rounded-xl border-l-[3px] text-[11px] cursor-pointer transition-all hover:bg-black/5 dark:hover:bg-white/5 ${msg.isMe
                                                                ? 'bg-black/10 border-white/40 text-teal-50'
                                                                : 'bg-slate-50 dark:bg-slate-900/50 border-teal-500 text-slate-600 dark:text-slate-400'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between mb-0.5">
                                                                <p className={`font-bold ${msg.isMe ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`}>
                                                                    {msg.reply_to.sender_name}
                                                                </p>
                                                                <Reply className="h-2.5 w-2.5 opacity-60" />
                                                            </div>
                                                            <p className="line-clamp-2 opacity-80 italic">
                                                                {msg.reply_to.content}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {msg.attachments && msg.attachments.length > 0 && msg.attachments.map((att, i) => (
                                                        <div key={i} className="mb-2 -mx-1 -mt-1">
                                                            {att.type?.startsWith('image') || (att.url && (att.url.match(/\.(jpeg|jpg|png|gif|webp)$/i) || att.url.includes('message/'))) ? (
                                                                <div
                                                                    className="cursor-pointer group/img relative overflow-hidden rounded-xl"
                                                                    onClick={() => setLightboxImage({ src: `/files/message/${msg.id}`, alt: att.name || 'Attachment' })}
                                                                >
                                                                    <AuthenticatedImage
                                                                        src={`/files/message/${msg.id}`}
                                                                        alt="Attachment"
                                                                        className="w-full max-h-48 object-cover border border-white/20 transition-all duration-300 group-hover:scale-105"
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                        <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 drop-shadow-md" />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleDownload(msg.id, att.name || 'document')}
                                                                    disabled={downloadingId === msg.id}
                                                                    className={`w-full flex items-center gap-2 p-3 rounded-xl bg-black/10 transition-colors border border-black/5 hover:bg-black/20 ${msg.isMe ? 'text-white' : 'text-slate-700 dark:text-slate-200'} ${downloadingId === msg.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                >
                                                                    <div className="h-8 w-8 rounded-lg bg-black/10 flex items-center justify-center shrink-0">
                                                                        {downloadingId === msg.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                                                    </div>
                                                                    <div className="min-w-0 pr-2 text-left">
                                                                        <p className="text-[11px] font-bold truncate opacity-90 uppercase">{att.name || 'DOCUMENT'}</p>
                                                                        <span className="text-[10px] break-all opacity-70">
                                                                            {downloadingId === msg.id ? 'Securing Download...' : 'Click to Download Securely'}
                                                                        </span>
                                                                    </div>
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}

                                                    <p className="whitespace-pre-wrap break-words leading-relaxed font-medium">
                                                        {msg.content}
                                                    </p>

                                                    {/* Reactions Display (Teams-style Pill) */}
                                                    {msg.reactions && msg.reactions.length > 0 && (
                                                        <div
                                                            className={`absolute -bottom-3 ${msg.isMe ? '-right-1' : '-left-1'} flex items-center bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-full px-1.5 py-0.5 shadow-md border border-slate-200/50 dark:border-slate-700/50 z-[20] transition-all hover:scale-105 cursor-pointer group/reaction`}
                                                        >
                                                            <div className="flex -space-x-1">
                                                                {/* Stacking unique reactions */}
                                                                {Array.from(new Set((msg.reactions || []).map(r => r.type))).slice(0, 4).map((type, i) => (
                                                                    <div
                                                                        key={type}
                                                                        className="relative z-10"
                                                                        style={{ zIndex: 10 - i }}
                                                                    >
                                                                        <ReactionIcon type={type} className="text-sm leading-none filter drop-shadow-sm" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {(msg.reactions || []).length > 1 && (
                                                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 ml-1">
                                                                    {(msg.reactions || []).length}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className={`flex items-center justify-end gap-1.5 mt-2 text-[10px] ${msg.isMe ? 'text-white/95' : 'text-slate-400'}`}>
                                                        <span className="font-semibold">{getFormattedTime(msg.created_at)}</span>
                                                        {msg.isMe && (
                                                            <CheckCheck className="h-4 w-4 text-white drop-shadow-md brightness-110 animate-in fade-in zoom-in duration-300" strokeWidth={2.8} />
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* Input Area - Sticky Bottom with Reply Preview */}
                                    <div className="p-3 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 shrink-0 z-10 w-full relative">
                                        <AnimatePresence>
                                            {replyingTo && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                                    className="mb-3 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl border-l-4 border-teal-500 overflow-hidden shadow-sm"
                                                >
                                                    <div className="p-3 flex items-start gap-3 relative">
                                                        <div className="flex-1 min-w-0 pr-6">
                                                            <p className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                                                <Reply className="h-3 w-3" />
                                                                Replying to {replyingTo.sender_name}
                                                            </p>
                                                            <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                                                                {replyingTo.content}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => setReplyingTo(null)}
                                                            className="absolute top-2 right-2 h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                                                        >
                                                            <X className="h-3.5 w-3.5 text-slate-500" />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        <div className="flex items-end gap-2">
                                            <input
                                                type="file"
                                                id="chat-attach-input"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file && activeConversation) {
                                                        const uploadRes = await uploadAttachment(file);
                                                        if (uploadRes) sendMessage(file.name, activeConversation.id, uploadRes.url, uploadRes.type);
                                                    }
                                                }}
                                            />
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-10 w-10 shrink-0 rounded-full text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors"
                                                onClick={() => document.getElementById('chat-attach-input')?.click()}
                                            >
                                                <Paperclip className="h-5 w-5 rotate-45" />
                                            </Button>

                                            <div className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center min-h-[44px] px-4 py-2 transition-all">
                                                <input
                                                    ref={inputRef}
                                                    className="w-full bg-transparent border-none focus:ring-0 outline-none pl-4 text-slate-900 dark:text-white placeholder-slate-400 text-sm max-h-24 resize-none leading-relaxed"
                                                    placeholder="Type a message..."
                                                    value={newMessage}
                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                                                />
                                            </div>

                                            <Button
                                                size="icon"
                                                onClick={handleSendMessage}
                                                disabled={!newMessage.trim()}
                                                className={`h-10 w-10 shrink-0 rounded-full shadow-md transition-all ${newMessage.trim()
                                                    ? 'bg-teal-600 hover:bg-teal-700 text-white scale-100'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-300 scale-95'
                                                    }`}
                                            >
                                                <Send className="h-5 w-5 ml-0.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Context Menu - Moved inside to adhere to parent widget bounds */}
                    {contextMenu.isOpen && (
                        <ChatContextMenu
                            x={contextMenu.x}
                            y={contextMenu.y}
                            isMe={contextMenu.isMe}
                            parentWidth={contextMenu.parentWidth}
                            parentHeight={contextMenu.parentHeight}
                            onClose={() => setContextMenu({ ...contextMenu, isOpen: false })}
                            onDeleteForMe={() => handleDeleteMessage(contextMenu.messageId, false)}
                            onDeleteForEveryone={() => handleDeleteMessage(contextMenu.messageId, true)}
                            onReact={(reactionType) => handleReaction(contextMenu.messageId, reactionType)}
                            onReply={() => {
                                const msg = (messages || []).find(m => m.id === contextMenu.messageId);
                                if (msg) {
                                    setReplyingTo(msg);
                                    setTimeout(() => inputRef.current?.focus(), 10);
                                }
                            }}
                            onCopy={() => {
                                const msg = (messages || []).find(m => m.id === contextMenu.messageId);
                                if (msg) copyToClipboard(msg.content);
                            }}
                        />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Image Lightbox (WhatsApp Grade) */}
            <AnimatePresence>
                {lightboxImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-12 bg-slate-950/95 backdrop-blur-sm"
                        onClick={() => setLightboxImage(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/60 to-transparent">
                                <div className="flex flex-col">
                                    <h3 className="text-white font-bold text-lg leading-tight uppercase tracking-wide">
                                        {lightboxImage.alt}
                                    </h3>
                                    <span className="text-white/60 text-xs font-medium italic">
                                        Haemi Life Secure Medical Asset
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setLightboxImage(null)}
                                        className="h-10 w-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white border border-white/20"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="relative group w-full h-full flex items-center justify-center p-4">
                                <AuthenticatedImage
                                    src={lightboxImage.src}
                                    alt={lightboxImage.alt}
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl shadow-teal-500/10 border border-white/10"
                                />
                            </div>

                            <div className="absolute bottom-8 flex gap-3">
                                <Button
                                    onClick={() => handleDownload(lightboxImage.src.split('/').pop() || '', lightboxImage.alt)}
                                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-6 h-11 rounded-xl shadow-lg shadow-teal-900/40 border-0 flex items-center gap-2"
                                >
                                    {downloadingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    Save to Device
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setLightboxImage(null)}
                                    className="bg-white/5 border-white/20 text-white hover:bg-white/10 font-bold px-6 h-11 rounded-xl"
                                >
                                    Close
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
