import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from './button';
import { MessageCircle, Send, Paperclip, X, ChevronLeft, Search, Check, CheckCheck, ShieldCheck, MessageSquare, Plus, Minus, Maximize2, Download, Reply, Loader2, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat, type Conversation, type Message } from '../../hooks/use-chat';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import api from '../../services/api';
import type { DoctorProfile } from '../../services/doctor.service';
import doctor01 from '../../assets/images/doctors/doctor_01.jpg';
import doctor02 from '../../assets/images/doctors/doctor_02.png';
import doctor03 from '../../assets/images/doctors/doctor_03.png';
import { useLocation } from 'react-router-dom';
import { useClickOutside } from '../../hooks/use-click-outside';

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

import { ChatContextMenu } from './chat-context-menu';
import { AuthenticatedImage } from './authenticated-image';
import { DecryptedText } from './decrypted-text';

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
        startNewConversation,
        uploadAttachment,
        deleteMessage,
        reactToMessage,
        markAsRead,
    } = useChat();

    // IntersectionObserver for Read Receipts
    useEffect(() => {
        if (!activeConversation || messages.length === 0) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const msgId = entry.target.id.replace('msg-', '');
                    // Find the message
                    const msg = messages.find(m => m.id === msgId);
                    if (msg && !msg.isMe && msg.status !== 'read') {
                        markAsRead(activeConversation.id);
                    }
                }
            });
        }, { threshold: 0.5 });

        // Observe the latest message(s) from the other party
        const unreadMessages = messages.filter(m => !m.isMe && m.status !== 'read');
        unreadMessages.forEach(msg => {
            const el = document.getElementById(`msg-${msg.id}`);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [activeConversation, messages, markAsRead]);

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
            // Use the Content-Type from the server response so the browser
            // saves the file with the correct MIME type (e.g. application/pdf, not text/plain).
            const mimeType = response.headers['content-type'] || 'application/octet-stream';
            const blob = new Blob([response.data], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
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

    // Initial Load — fetch immediately when user/token is ready
    useEffect(() => {
        if (user?.id) {
            fetchConversations();
        }
    }, [user?.id, fetchConversations]);

    // Re-fetch when the window is explicitly opened to ensure sync
    useEffect(() => {
        if (isOpen) {
            fetchConversations();
        }
    }, [isOpen, fetchConversations]);

    // P1 Fix: Periodic polling to keep the unread badge fresh even if
    // sockets are dropped or browser tab was inactive.
    useEffect(() => {
        if (!user?.id) return;
        // DEMO SHIELD: Reduce background polling to near-zero to prioritize socket performance
        const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
        const DEMO_SHIELD = import.meta.env.VITE_DEMO_SHIELD === 'true' || IS_DEMO_MODE;
        const intervalTime = DEMO_SHIELD ? 600000 : 30000; // 10m vs 30s

        const interval = setInterval(() => {
            fetchConversations();
        }, intervalTime);
        return () => clearInterval(interval);
    }, [user?.id, fetchConversations]);

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

    // P1 Fix: Refresh conversations when active conversation changes to clear badge
    // MOVED TO TOP-LEVEL TO COMPLY WITH REACT RULES OF HOOKS
    useEffect(() => {
        if (activeConversation?.id) {
            fetchConversations();
        }
    }, [activeConversation?.id, fetchConversations]);

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

    const getOtherParticipant = useCallback((conversation: Conversation) => {
        const currentId = String(user?.id || '').toLowerCase();
        const participants = Array.isArray(conversation.participants) ? conversation.participants : [];

        // Explicitly find the person who is NOT the current user
        const other = participants.find(p => String(p.id).toLowerCase() !== currentId);

        if (!other) {
            // If API didn't return other participants, check the last message sender or use a generic fallback
            return {
                id: 'unknown',
                name: 'Haemi Member',
                role: 'User',
                initials: 'HM',
                image: ''
            };
        }

        const displayName = other.name && other.name !== 'Unknown' ? other.name : 'Health Professional';
        const participant = other as { id: string; name: string; role: string; profile_image?: string; initials?: string };
        const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000');
        const dbImage = participant.id !== 'unknown' ? `${baseUrl}/api/files/profile/${participant.id}` : '';

        return {
            ...other,
            name: displayName,
            image: dbImage,
            initials: participant.initials || displayName.substring(0, 1)
        };
    }, [user?.id]);

    const filteredConversations = useMemo(() => {
        return conversations.filter(c => {
            const other = getOtherParticipant(c);
            const matchesSearch = other.name.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesSearch;
        });
    }, [conversations, searchTerm, getOtherParticipant]);

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
                </Button>

                {(() => {
                    const totalUnread = conversations.reduce((acc, c) => acc + parseInt(c.unread_count || '0'), 0);
                    if (totalUnread > 0) {
                        return (
                            <span className="chat-unread-badge animate-badge-pop">
                                {totalUnread > 9 ? '9+' : totalUnread}
                            </span>
                        );
                    }
                    return null;
                })()}
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
                </Button>

                {(() => {
                    const totalUnread = conversations.reduce((acc, c) => acc + parseInt(c.unread_count || '0'), 0);
                    if (totalUnread > 0) {
                        return (
                            <span className="chat-unread-badge animate-badge-pop">
                                {totalUnread > 9 ? '9+' : totalUnread}
                            </span>
                        );
                    }
                    return null;
                })()}
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

                    .chat-unread-badge {
                        position: absolute;
                        top: 0px;
                        right: 0px;
                        height: 24px;
                        min-width: 24px;
                        padding: 0 6px;
                        background-color: #DC2626; /* Error/Alert Color from guide */
                        border-radius: 9999px;
                        border: 2px solid white;
                        color: white;
                        font-size: 10px;
                        font-weight: bold;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                        z-index: 10;
                    }

                    .dark .chat-unread-badge {
                        border-color: #1a1c23;
                    }

                    .conv-unread-pill {
                        height: 18px;
                        min-width: 18px;
                        padding: 0 6px;
                        border-radius: 9999px;
                        background-color: #1BA7A6; /* Primary-600 from guide */
                        color: white;
                        font-size: 9px;
                        font-weight: 700;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.1);
                    }

                    .animate-badge-pop {
                        animation: badge-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                    }

                    @keyframes badge-pop {
                        0% { transform: scale(0); opacity: 0; }
                        70% { transform: scale(1.1); opacity: 1; }
                        100% { transform: scale(1); }
                    }

                    .message-status-ticks {
                        display: flex;
                        align-items: center;
                        color: rgba(255, 255, 255, 0.85);
                    }

                    .message-status-ticks.read {
                        color: #A7E6DB; /* Primary-300 for soft but distinct read state on dark/teal bg */
                    }
                    
                    .dark .message-status-ticks.read {
                        color: #3FC2B5; /* Primary-500 for high-visibility read state in dark mode */
                    }
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
                                                className="w-full h-10 pl-10 pr-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm transition-all"
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
                                                                    <DecryptedText text={conv.last_message || ''} fallback="Start a conversation" />
                                                                </p>
                                                                {parseInt(conv.unread_count) > 0 && (
                                                                    <span className="conv-unread-pill animate-badge-pop">
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
                                                className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-teal-500 text-sm"
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
                                            filteredDoctors.map((doc: DoctorProfile) => (
                                                <button
                                                    key={doc.id}
                                                    onClick={() => handleStartNewChat(doc)}
                                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 dark:hover:bg-accent/20 hover:shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all text-left group"
                                                >
                                                    <Avatar name={doc.name} image={getDoctorImage(doc.name)} size="md" />
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                                                            {doc.name}
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
                                                                (() => {
                                                                    // Determine file type for visual styling
                                                                    const fileName = att.name || 'document';
                                                                    const ext = fileName.split('.').pop()?.toLowerCase() || '';
                                                                    const isPdf = ext === 'pdf';
                                                                    const isDoc = ext === 'doc' || ext === 'docx';

                                                                    // Icon area color: PDF=red, DOC/DOCX=blue, other=slate
                                                                    const iconBg = isPdf
                                                                        ? (msg.isMe ? 'bg-red-500/30' : 'bg-red-50 dark:bg-red-900/20')
                                                                        : isDoc
                                                                            ? (msg.isMe ? 'bg-blue-400/30' : 'bg-blue-50 dark:bg-blue-900/20')
                                                                            : (msg.isMe ? 'bg-black/20' : 'bg-slate-100 dark:bg-slate-700');
                                                                    const iconColor = isPdf
                                                                        ? 'text-red-400'
                                                                        : isDoc
                                                                            ? 'text-blue-400'
                                                                            : (msg.isMe ? 'text-white/80' : 'text-slate-500');
                                                                    const extLabel = ext.toUpperCase() || 'FILE';

                                                                    // Human-readable file size
                                                                    const formatSize = (bytes: number) => {
                                                                        if (!bytes || bytes === 0) return '';
                                                                        if (bytes < 1024) return `${bytes} B`;
                                                                        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                                                                        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                                                                    };

                                                                    return (
                                                                        <button
                                                                            onClick={() => handleDownload(msg.id, fileName)}
                                                                            disabled={downloadingId === msg.id}
                                                                            className={`w-full flex items-center gap-0 rounded-xl overflow-hidden border transition-all duration-200 hover:opacity-90 active:scale-[0.98] ${msg.isMe
                                                                                ? 'border-white/10 bg-black/10 hover:bg-black/20'
                                                                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750'
                                                                                } ${downloadingId === msg.id ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                                                        >
                                                                            {/* Left — File Type Icon Section (WhatsApp-style) */}
                                                                            <div className={`shrink-0 w-14 h-16 flex flex-col items-center justify-center ${iconBg} gap-0.5`}>
                                                                                {downloadingId === msg.id ? (
                                                                                    <Loader2 className={`h-6 w-6 animate-spin ${iconColor}`} />
                                                                                ) : (
                                                                                    <>
                                                                                        {/* Document shape SVG */}
                                                                                        <svg viewBox="0 0 24 28" className={`h-8 w-7 ${iconColor}`} fill="currentColor">
                                                                                            <path d="M14 0H2C0.9 0 0 0.9 0 2v24c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V8l-10-8z" opacity="0.9" />
                                                                                            <path d="M14 0v8h10L14 0z" opacity="0.5" />
                                                                                        </svg>
                                                                                        <span className={`text-[9px] font-extrabold tracking-wider ${iconColor} -mt-1`}>{extLabel}</span>
                                                                                    </>
                                                                                )}
                                                                            </div>

                                                                            {/* Right — File Info */}
                                                                            <div className={`flex-1 min-w-0 px-3 py-2.5 flex flex-col justify-center text-left ${msg.isMe ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                                                                                <p className="text-[12px] font-semibold truncate leading-tight">
                                                                                    {fileName}
                                                                                </p>
                                                                                <p className={`text-[10px] mt-0.5 font-medium ${msg.isMe ? 'text-white/60' : 'text-slate-400 dark:text-slate-500'}`}>
                                                                                    {downloadingId === msg.id
                                                                                        ? 'Downloading...'
                                                                                        : att.size ? formatSize(att.size) : extLabel + ' Document'}
                                                                                </p>
                                                                            </div>

                                                                            {/* Download arrow icon */}
                                                                            <div className={`shrink-0 pr-3 ${msg.isMe ? 'text-white/70' : 'text-teal-500'}`}>
                                                                                {downloadingId === msg.id
                                                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                                    : <Download className="h-4 w-4" />
                                                                                }
                                                                            </div>
                                                                        </button>
                                                                    );
                                                                })()
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
                                                            <div className={`message-status-ticks ${msg.status === 'read' ? 'read' : ''}`}>
                                                                {msg.status === 'sent' ? (
                                                                    <Check className="h-3.5 w-3.5 opacity-70" strokeWidth={3} />
                                                                ) : msg.status === 'delivered' ? (
                                                                    <CheckCheck className="h-3.5 w-3.5 opacity-70" strokeWidth={3} />
                                                                ) : (
                                                                    <CheckCheck className="h-3.5 w-3.5" strokeWidth={3} />
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* Input Area - Sticky Bottom with Reply Preview */}
                                    <div className="chat-footer p-3 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 shrink-0 z-10 w-full relative">
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
                                        <div className="chat-footer-row flex items-end gap-2">
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
                                                className="chat-attachment-button h-10 w-10 shrink-0 rounded-full text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors"
                                                onClick={() => document.getElementById('chat-attach-input')?.click()}
                                            >
                                                <Paperclip className="h-5 w-5 rotate-45" />
                                            </Button>

                                            <input
                                                ref={inputRef}
                                                className="chat-input flex-1 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 px-6 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 text-sm outline-none transition-all focus:border-teal-600 dark:focus:border-teal-500 focus:ring-1 focus:ring-teal-600/20"
                                                placeholder="Type a message..."
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                                            />

                                            <Button
                                                size="icon"
                                                onClick={handleSendMessage}
                                                disabled={!newMessage.trim()}
                                                className={`chat-send-button h-10 w-10 shrink-0 rounded-full shadow-md transition-all ${newMessage.trim()
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
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-12 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md"
                        onClick={() => setLightboxImage(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-slate-200/80 to-transparent dark:from-black/60">
                                <div className="flex flex-col">
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg leading-tight uppercase tracking-wide">
                                        {lightboxImage.alt}
                                    </h3>
                                    <span className="text-slate-600 dark:text-white/60 text-xs font-medium italic">
                                        Haemi Life Secure Medical Asset
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setLightboxImage(null)}
                                        className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-300/50 dark:bg-white/10 dark:hover:bg-white/20 transition-colors text-slate-800 dark:text-white border border-slate-300 dark:border-white/20 shadow-sm"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="relative group w-full h-full flex items-center justify-center p-4">
                                <AuthenticatedImage
                                    src={lightboxImage.src}
                                    alt={lightboxImage.alt}
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl shadow-teal-500/10 border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-transparent"
                                />
                            </div>

                            <div className="absolute bottom-8 flex gap-3">
                                <Button
                                    onClick={() => handleDownload(lightboxImage.src.split('/').pop() || '', lightboxImage.alt)}
                                    className="bg-[#148C8B] hover:bg-[#0E6B74] dark:bg-teal-600 dark:hover:bg-teal-700 text-white font-bold px-6 h-11 rounded-xl shadow-lg shadow-teal-900/20 dark:shadow-teal-900/40 border-0 flex items-center gap-2"
                                >
                                    {downloadingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    Save to Device
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setLightboxImage(null)}
                                    className="bg-white/80 dark:bg-white/5 border-slate-200 dark:border-white/20 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 font-bold px-6 h-11 rounded-xl shadow-sm"
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
