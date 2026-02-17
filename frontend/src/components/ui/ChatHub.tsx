import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from './button';
import { GlassCard } from './GlassCard';
import {
    MessageSquare, Send, X, Minus,
    Paperclip, Smile, ChevronLeft,
    CheckCheck, ShieldCheck, Phone, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Import actual profile images
import doctorImg from '../../assets/images/doctors/doctor_01.jpg';
import patientImg from '../../assets/images/patients/patient_01.jpg';
import pharmacyImg from '../../assets/images/pharmacies/pharmacy_01.jpg';

const MOCK_CONTACTS = [
    { id: 1, name: 'Dr. Sarah Wilson', role: 'Specialist', status: 'online', avatar: doctorImg, lastMsg: "Hello! checking on the lab results for Kabelo.", time: "09:42" },
    { id: 2, name: 'Pharm. John M.', role: 'Gaborone North', status: 'offline', avatar: pharmacyImg, lastMsg: "The prescription is ready for pickup.", time: "Yesterday" },
    { id: 3, name: 'Kabelo D.', role: 'Patient', status: 'online', avatar: patientImg, lastMsg: "Thank you doctor, I'll update you.", time: "Monday" },
];

const MOCK_MESSAGES = [
    { id: 1, senderId: 1, text: "Hello! checking on the lab results for Kabelo.", timestamp: "09:42", isMe: false },
    { id: 2, senderId: 0, text: "I've just reviewed them. Everything looks within normal range.", timestamp: "09:45", isMe: true },
    { id: 3, senderId: 1, text: "Perfect, thank you! I'll update his care plan.", timestamp: "09:46", isMe: false },
    { id: 4, senderId: 1, text: "Please share the patient's latest vitals.", timestamp: "10:45", isMe: false },
    { id: 5, senderId: 0, text: "Here are the latest readings: BP 120/80, HR 72.", timestamp: "10:47", isMe: true },
];

const Avatar: React.FC<{ src?: string; name: string; size?: 'xs' | 'sm' | 'md' | 'lg'; status?: string; className?: string }> = ({ src, name, size = 'md', status, className = "" }) => {
    const sizeClasses = {
        xs: 'h-6 w-6 text-[8px]',
        sm: 'h-8 w-8 text-[10px]',
        md: 'h-10 w-10 text-xs',
        lg: 'h-12 w-12 text-sm'
    };

    return (
        <div className={`relative shrink-0 ${className}`}>
            <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-primary/10 flex items-center justify-center border border-black/5 dark:border-white/10`}>
                {src ? (
                    <img src={src} alt={name} className="h-full w-full object-cover" />
                ) : (
                    <span className="font-bold text-primary">
                        {name.split(' ').map(n => n[0]).join('')}
                    </span>
                )}
            </div>
            {status === 'online' && (
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-950" />
            )}
        </div>
    );
};

export const ChatHub: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [view, setView] = useState<'contacts' | 'conversation'>('contacts');
    const [selectedContact, setSelectedContact] = useState(MOCK_CONTACTS[0]);
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const scrollRef = useRef<HTMLDivElement>(null);

    const toggleChat = () => setIsOpen(!isOpen);

    const handleSelectContact = (contact: typeof MOCK_CONTACTS[0]) => {
        setSelectedContact(contact);
        setView('conversation');
    };

    const filteredContacts = useMemo(() => {
        return MOCK_CONTACTS.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.role.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm]);

    useEffect(() => {
        if (view === 'conversation' && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [view, MOCK_MESSAGES.length]);

    if (!isOpen) {
        return (
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.1 }}
                className="fixed bottom-8 right-8 z-[60]"
            >
                <Button
                    onClick={toggleChat}
                    className="h-14 w-14 rounded-full bg-primary shadow-2xl shadow-primary/40 p-0 flex items-center justify-center group border-4 border-white dark:border-slate-800"
                >
                    <MessageSquare className="h-6 w-6 text-primary-foreground group-hover:rotate-12 transition-transform" />
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-destructive rounded-full border-2 border-white dark:border-slate-800 text-[10px] font-black text-white flex items-center justify-center">
                        3
                    </span>
                </Button>
            </motion.div>
        );
    }

    return (
        <div className="fixed bottom-8 right-8 z-[60] flex flex-col items-end gap-4 pointer-events-none max-w-[calc(100vw-40px)]">
            <style>
                {`
                    .chat-scrollbar::-webkit-scrollbar {
                        width: 4px;
                    }
                    .chat-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .chat-scrollbar::-webkit-scrollbar-thumb {
                        background: #3FC2B5;
                        border-radius: 10px;
                    }
                    .chat-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: #1BA7A6;
                    }
                `}
            </style>

            <AnimatePresence mode="wait">
                {!isMinimized && (
                    <motion.div
                        key="chat-window"
                        initial={{ y: 50, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 50, opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="pointer-events-auto"
                    >
                        <GlassCard
                            className="w-[360px] max-w-full h-[600px] max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.2)] dark:shadow-[0_32px_64px_rgba(0,0,0,0.5)] rounded-[24px] bg-white dark:bg-slate-950"
                            mesh={false}
                        >
                            {/* Header Section - Shrink-0 */}
                            <div className="shrink-0 flex flex-col">
                                <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900/60 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {view === 'conversation' && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-primary/10 text-slate-600 dark:text-white/70"
                                                onClick={() => setView('contacts')}
                                            >
                                                <ChevronLeft className="h-5 w-5" />
                                            </Button>
                                        )}
                                        {view === 'conversation' ? (
                                            <div className="flex items-center gap-3">
                                                <Avatar src={selectedContact.avatar} name={selectedContact.name} size="sm" status={selectedContact.status} />
                                                <div>
                                                    <h3 className="text-[13px] font-bold text-slate-900 dark:text-white tracking-tight leading-tight">{selectedContact.name}</h3>
                                                    <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest leading-none mt-0.5">Active now</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <h3 className="text-[16px] font-black text-slate-900 dark:text-white tracking-tight">Messages</h3>
                                                <p className="text-[10px] text-slate-500 dark:text-white/40 font-bold uppercase tracking-widest leading-none">3 Unread</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-black/5 dark:hover:bg-primary/10 text-slate-400 dark:text-white/70" onClick={() => setIsMinimized(true)}>
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-destructive/10 dark:hover:bg-destructive/20 hover:text-destructive text-slate-400 dark:text-white/70" onClick={toggleChat}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="h-8 px-4 bg-emerald-50 dark:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-500/10 flex items-center justify-center gap-2">
                                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.15em]">Secure End-to-End Encryption</span>
                                </div>
                            </div>

                            {/* Body Section - Flex-1 */}
                            <div className="flex-1 min-h-0 relative bg-white dark:bg-slate-950">
                                <AnimatePresence mode="wait">
                                    {view === 'contacts' ? (
                                        <motion.div
                                            key="contacts"
                                            initial={{ x: -20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            exit={{ x: -20, opacity: 0 }}
                                            className="h-full flex flex-col p-4"
                                        >
                                            <div className="relative mb-4 shrink-0">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-white/20" />
                                                <input
                                                    type="text"
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    placeholder="Search healthcare team..."
                                                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400 dark:placeholder:text-white/20"
                                                />
                                            </div>
                                            <div className="flex-1 overflow-y-auto chat-scrollbar space-y-1">
                                                {filteredContacts.map(contact => (
                                                    <button
                                                        key={contact.id}
                                                        onClick={() => handleSelectContact(contact)}
                                                        className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-primary/5 transition-all text-left group border border-transparent hover:border-slate-200 dark:hover:border-primary/10"
                                                    >
                                                        <Avatar src={contact.avatar} name={contact.name} size="md" status={contact.status} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between mb-0.5">
                                                                <h4 className="text-[13px] font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate">{contact.name}</h4>
                                                                <span className="text-[10px] text-slate-400 dark:text-white/30 font-bold">{contact.time}</span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-500 dark:text-white/50 truncate font-medium group-hover:text-slate-900 dark:group-hover:text-white/80 transition-colors">{contact.lastMsg}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="conversation"
                                            initial={{ x: 20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            exit={{ x: 20, opacity: 0 }}
                                            className="h-full flex flex-col"
                                        >
                                            {/* Messages Area - Flex-1 */}
                                            <div
                                                ref={scrollRef}
                                                className="flex-1 overflow-y-auto p-5 space-y-6 chat-scrollbar bg-slate-50/30 dark:bg-slate-950"
                                            >
                                                {MOCK_MESSAGES.map((msg, index) => (
                                                    <div key={msg.id} className="space-y-2">
                                                        <div className={`flex items-end gap-2 ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                                                            {!msg.isMe && (
                                                                <Avatar src={selectedContact.avatar} name={selectedContact.name} size="sm" className="mb-1" />
                                                            )}
                                                            <div className={`max-w-[78%] px-4 py-3 rounded-[20px] text-[13px] leading-snug shadow-sm dark:shadow-xl ${msg.isMe ? 'bg-[#148C8B] text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none border border-slate-200 dark:border-white/5'
                                                                }`}>
                                                                <p className="font-medium tracking-tight whitespace-pre-wrap">{msg.text}</p>
                                                                <div className={`text-[9px] mt-1 font-bold ${msg.isMe ? 'text-white/60 text-right' : 'text-slate-400 dark:text-white/30'}`}>
                                                                    {msg.timestamp}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Input Bar Section - Strictly Static/Pinned at Bottom */}
                                            <div className="shrink-0 p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-white/10">
                                                <div className="flex items-center gap-2 max-w-full">
                                                    {/* WhatsApp Layout: Paperclip | Input(Smile) | Send */}
                                                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5">
                                                        <Paperclip className="h-5 w-5" />
                                                    </Button>

                                                    <div className="flex-1 relative flex items-center min-w-0">
                                                        <input
                                                            type="text"
                                                            value={newMessage}
                                                            onChange={(e) => setNewMessage(e.target.value)}
                                                            onKeyPress={(e) => e.key === 'Enter' && newMessage && setNewMessage('')}
                                                            placeholder="Type a message..."
                                                            className="w-full h-11 pl-4 pr-10 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400 dark:placeholder:text-white/20"
                                                        />
                                                        <Button variant="ghost" size="icon" className="absolute right-1 h-8 w-8 rounded-full text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white">
                                                            <Smile className="h-5 w-5" />
                                                        </Button>
                                                    </div>

                                                    <Button
                                                        size="icon"
                                                        onClick={() => newMessage && setNewMessage('')}
                                                        className={`h-11 w-11 shrink-0 rounded-2xl transition-all shadow-xl ${newMessage ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-white/20'
                                                            }`}
                                                        disabled={!newMessage}
                                                    >
                                                        <Send className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </GlassCard>
                    </motion.div>
                )}
            </AnimatePresence>

            {isMinimized && (
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.05 }}
                    className="pointer-events-auto"
                >
                    <Button
                        onClick={() => setIsMinimized(false)}
                        className="h-14 w-14 rounded-full bg-white dark:bg-slate-950 shadow-2xl p-0 flex items-center justify-center group border-4 border-slate-200 dark:border-white/10 overflow-hidden"
                    >
                        <Avatar src={selectedContact.avatar} name={selectedContact.name} size="lg" className="opacity-80 group-hover:opacity-100 transition-opacity" />
                    </Button>
                </motion.div>
            )}
        </div>
    );
};
