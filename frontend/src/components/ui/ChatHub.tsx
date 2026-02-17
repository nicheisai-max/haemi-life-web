import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from './button';
import { GlassCard } from './GlassCard';
import {
    MessageSquare, X, Minus,
    ChevronLeft,
    ShieldCheck, Search, CheckCheck,
    Paperclip, Send, FileText, Plus, UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat, type Conversation } from '../../hooks/useChat';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import api from '../../services/api';
import doctor01 from '../../assets/images/doctors/doctor_01.jpg';
import doctor02 from '../../assets/images/doctors/doctor_02.png';

// Override helper to get images
const getDoctorImage = (name: string) => {
    if (!name) return undefined;
    if (name.includes('Dr. Sarah')) return doctor01;
    if (name.includes('Dr. Michael')) return doctor02;
    // Fallback deterministic mapping for demo
    if (name.length % 2 === 0) return doctor01;
    return doctor02;
};

// --- Premium Avatar Component ---
const Avatar: React.FC<{ name: string; image?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }> = ({ name, image, size = 'md', className = "" }) => {
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

    return (
        <div className={`relative shrink-0 ${className}`}>
            <div className={`${sizeClasses[size]} rounded-full overflow-hidden ${bgClass} flex items-center justify-center shadow-sm border border-white/20 text-white font-bold tracking-wider`}>
                {image ? (
                    <img src={image} alt={name} className="h-full w-full object-cover" />
                ) : (
                    getInitials(name)
                )}
            </div>
        </div>
    );
};

// --- Main Chat Hub ---
export const ChatHub: React.FC = () => {
    const { user } = useAuth();
    const {
        conversations,
        activeConversation,
        messages,
        fetchConversations,
        selectConversation,
        sendMessage,
        uploadAttachment,
        startNewConversation
    } = useChat();

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [view, setView] = useState<'contacts' | 'conversation' | 'new-chat'>('contacts');
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [doctors, setDoctors] = useState<any[]>([]); // List of doctors for new chat
    const [doctorSearch, setDoctorSearch] = useState('');

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

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

    const toggleChat = () => setIsOpen(!isOpen);

    const handleSelectConversation = (conversation: Conversation) => {
        selectConversation(conversation);
        setView('conversation');
    };

    const handleStartNewChat = async (doctor: any) => {
        // optimistically check if conversation exists
        const existing = conversations.find(c =>
            c.participants && Array.isArray(c.participants) &&
            c.participants.some(p => p.id === doctor.user_id || p.id === doctor.id)
        );
        if (existing) {
            handleSelectConversation(existing);
        } else {
            await startNewConversation(doctor.user_id || doctor.id);
            setView('conversation'); // startNewConversation usually updates state/refetches
        }
    };

    const handleSendMessage = () => {
        if (!newMessage.trim() || !activeConversation) return;
        sendMessage(newMessage, activeConversation.id);
        setNewMessage('');
        // Keep focus
        setTimeout(() => inputRef.current?.focus(), 10);
    };

    const getOtherParticipant = (conversation: Conversation) => {
        const other = (conversation.participants && Array.isArray(conversation.participants))
            ? conversation.participants.find(p => p.id !== user?.id) || { name: 'Unknown', role: 'Unknown', id: 'unknown' }
            : { name: 'Unknown', role: 'Unknown', id: 'unknown' };
        return { ...other, image: getDoctorImage(other.name) };
    };

    const filteredConversations = useMemo(() => conversations.filter(c => {
        const other = getOtherParticipant(c);
        return other.name.toLowerCase().includes(searchTerm.toLowerCase());
    }), [conversations, searchTerm, user]);

    const filteredDoctors = useMemo(() => doctors.filter(d => {
        const name = d.user?.name || d.name || '';
        return name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
            d.specialization?.toLowerCase().includes(doctorSearch.toLowerCase());
    }), [doctors, doctorSearch]);

    const getFormattedTime = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return format(date, 'HH:mm');
    };

    // --- Render Minimized State ---
    if (!isOpen && !isMinimized) {
        return (
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                className="fixed bottom-6 right-6 z-[60]"
            >
                <Button
                    onClick={toggleChat}
                    className="h-14 w-14 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 shadow-lg shadow-teal-500/30 p-0 flex items-center justify-center group border-[3px] border-white dark:border-slate-800"
                    aria-label="Open chat"
                >
                    <MessageSquare className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />
                    {conversations.some(c => parseInt(c.unread_count) > 0) && (
                        <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full border-2 border-white dark:border-slate-800" />
                    )}
                </Button>
            </motion.div>
        );
    }

    if (isMinimized) {
        return (
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                className="fixed bottom-6 right-6 z-[60]"
            >
                <Button
                    onClick={() => setIsMinimized(false)}
                    className="h-14 w-14 rounded-full bg-white dark:bg-slate-800 shadow-lg p-0 flex items-center justify-center group border-[3px] border-slate-100 dark:border-slate-700 overflow-hidden"
                >
                    {activeConversation ? (
                        <Avatar name={getOtherParticipant(activeConversation).name} image={getOtherParticipant(activeConversation).image} size="md" className="h-full w-full rounded-none" />
                    ) : (
                        <MessageSquare className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                    )}
                    {conversations.some(c => parseInt(c.unread_count) > 0) && (
                        <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full border-2 border-white" />
                    )}
                </Button>
            </motion.div>
        );
    }

    // --- Render Main Window ---
    return (
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-4 pointer-events-none font-sans">
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
                    initial={{ y: 20, opacity: 0, scale: 0.95 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 20, opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="pointer-events-auto bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-[380px] sm:w-[420px] max-w-[calc(100vw-32px)] h-[650px] max-h-[80vh] flex flex-col overflow-hidden"
                >
                    {/* --- Helper: Header --- */}
                    <div className="shrink-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur z-20 border-b border-slate-100 dark:border-slate-800">
                        <div className="px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3 overflow-hidden">
                                {view !== 'contacts' && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 -ml-1 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        onClick={() => setView('contacts')}
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                )}

                                {view === 'conversation' && activeConversation ? (
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="relative shrink-0">
                                            <Avatar name={getOtherParticipant(activeConversation).name} image={getOtherParticipant(activeConversation).image} size="sm" />
                                            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-white dark:border-slate-950 rounded-full"></span>
                                        </div>
                                        <div className="flex flex-col truncate">
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                {getOtherParticipant(activeConversation).name}
                                            </h3>
                                            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium truncate">
                                                {getOtherParticipant(activeConversation).role}
                                            </span>
                                        </div>
                                    </div>
                                ) : view === 'new-chat' ? (
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">New Message</h3>
                                ) : (
                                    <div className="flex flex-col">
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Messages</h3>
                                        <span className="text-[11px] text-slate-500 font-medium">
                                            {conversations.length} conversations
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    onClick={() => setIsMinimized(true)}
                                >
                                    <Minus className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                    onClick={toggleChat}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Encryption Banner */}
                        <div className="py-1 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5">
                            <ShieldCheck className="h-2.5 w-2.5 text-slate-400" />
                            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">
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
                                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-900 hover:shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all text-left group"
                                                    >
                                                        <Avatar name={other.name} image={other.image} size="md" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-center mb-0.5">
                                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
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
                                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-900 hover:shadow-sm border border-transparent hover:border-slate-100 transition-all text-left"
                                                >
                                                    <Avatar name={doc.user?.name || doc.name} image={getDoctorImage(doc.user?.name || doc.name)} size="md" />
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
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
                                                className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} group`}
                                            >
                                                <div
                                                    className={`max-w-[85%] p-3 rounded-2xl shadow-sm text-sm relative ${msg.isMe
                                                        ? 'bg-teal-600 text-white rounded-tr-none'
                                                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none'
                                                        }`}
                                                >
                                                    {msg.attachment_url && (
                                                        <div className="mb-2 -mx-1 -mt-1">
                                                            {msg.attachment_type === 'image' ? (
                                                                <img
                                                                    src={`http://localhost:5000${msg.attachment_url}`}
                                                                    alt="Attachment"
                                                                    className="rounded-xl w-full max-h-48 object-cover border border-white/20"
                                                                    onClick={() => window.open(`http://localhost:5000${msg.attachment_url}`, '_blank')}
                                                                />
                                                            ) : (
                                                                <a
                                                                    href={`http://localhost:5000${msg.attachment_url}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className={`flex items-center gap-2 p-2 rounded-lg bg-black/10 transition-colors border border-black/5 ${msg.isMe ? 'text-white' : 'text-slate-700'}`}
                                                                >
                                                                    <FileText className="h-4 w-4" />
                                                                    <span className="text-xs truncate max-w-[150px]">{msg.content || "File"}</span>
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}

                                                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                                                        {msg.content}
                                                    </p>

                                                    <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${msg.isMe ? 'text-teal-100' : 'text-slate-400'}`}>
                                                        <span>{getFormattedTime(msg.created_at)}</span>
                                                        {msg.isMe && (
                                                            <CheckCheck className="h-3 w-3 opacity-90" />
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* Input Area - Sticky Bottom */}
                                    <div className="p-3 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 shrink-0 z-10 w-full relative">
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
                                                    className="w-full bg-transparent border-none focus:ring-0 outline-none p-0 text-slate-900 dark:text-white placeholder-slate-400 text-sm max-h-24 resize-none leading-relaxed"
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
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
