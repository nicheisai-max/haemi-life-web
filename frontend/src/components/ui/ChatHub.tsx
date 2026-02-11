import React, { useState } from 'react';
import { Button } from './button';
import { GlassCard } from './GlassCard';
import {
    MessageSquare, Send, X, Minus,
    User, MoreVertical, Paperclip, Smile,
    CheckCheck, ShieldCheck, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_CONTACTS = [
    { id: 1, name: 'Dr. Sarah Wilson', role: 'Specialist', status: 'online', avatar: '' },
    { id: 2, name: 'Pharmacist John', role: 'Gaborone North', status: 'offline', avatar: '' },
    { id: 3, name: 'Patient: Kabelo D.', role: 'Medical Aid: BPOMAS', status: 'online', avatar: '' },
];

const MOCK_MESSAGES = [
    { id: 1, senderId: 1, text: "Hello! checking on the lab results for Kabelo.", timestamp: "09:42", isMe: false },
    { id: 2, senderId: 0, text: "I've just reviewed them. Everything looks within normal range.", timestamp: "09:45", isMe: true },
    { id: 3, senderId: 1, text: "Perfect, thank you! I'll update his care plan.", timestamp: "09:46", isMe: false },
];

export const ChatHub: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [selectedContact, setSelectedContact] = useState(MOCK_CONTACTS[0]);
    const [newMessage, setNewMessage] = useState('');

    const toggleChat = () => setIsOpen(!isOpen);

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
                    className="h-16 w-16 rounded-full bg-primary shadow-2xl shadow-primary/40 p-0 flex items-center justify-center group border-4 border-white dark:border-slate-800"
                >
                    <MessageSquare className="h-7 w-7 text-primary-foreground group-hover:rotate-12 transition-transform" />
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-destructive rounded-full border-2 border-white dark:border-slate-800 text-[10px] font-black text-white flex items-center justify-center">
                        3
                    </span>
                </Button>
            </motion.div>
        );
    }

    return (
        <div className="fixed bottom-8 right-8 z-[60] flex flex-col items-end gap-4 pointer-events-none">
            <AnimatePresence>
                {!isMinimized && (
                    <motion.div
                        initial={{ y: 50, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 50, opacity: 0, scale: 0.9 }}
                        className="pointer-events-auto"
                    >
                        <GlassCard className="w-[450px] h-[600px] flex flex-col overflow-hidden border-2 border-slate-200 dark:border-slate-800 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)]" mesh meshVariant="primary">
                            {/* Chat Header */}
                            <div className="p-4 bg-slate-900/5 dark:bg-slate-50/5 border-b flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                            {selectedContact.name.split(' ').map((n: string) => n[0]).join('')}
                                        </div>
                                        <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-foreground leading-none">{selectedContact.name}</h3>
                                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">{selectedContact.role} • Active</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                        <Phone className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setIsMinimized(true)}>
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive" onClick={toggleChat}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Verification Banner */}
                            <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center gap-2">
                                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">End-to-End Encrypted Secure Tunnel</span>
                            </div>

                            {/* Chat Body */}
                            <div className="flex-1 flex overflow-hidden">
                                {/* Contacts Sidebar (Mini) */}
                                <div className="w-16 border-r bg-slate-900/5 dark:bg-slate-50/5 flex flex-col items-center py-4 gap-4">
                                    {MOCK_CONTACTS.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setSelectedContact(c)}
                                            className={`h-10 w-10 rounded-full transition-all ${selectedContact.id === c.id ? 'bg-primary ring-4 ring-primary/20 scale-110' : 'bg-slate-200 dark:bg-slate-800 hover:scale-105'}`}
                                        >
                                            <span className={`text-xs font-bold ${selectedContact.id === c.id ? 'text-white' : 'text-slate-500'}`}>
                                                {c.name.split(' ').map((n: string) => n[0]).join('')}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                {/* Messages Area */}
                                <div className="flex-1 flex flex-col bg-white/30 dark:bg-slate-950/30">
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {MOCK_MESSAGES.map((msg) => (
                                            <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.isMe ? 'bg-primary text-white rounded-tr-none shadow-lg' : 'bg-white dark:bg-slate-800 border rounded-tl-none shadow-sm'}`}>
                                                    <p className="leading-relaxed font-medium">{msg.text}</p>
                                                    <div className={`flex items-center gap-1 mt-1 ${msg.isMe ? 'text-white/60' : 'text-slate-400'}`}>
                                                        <span className="text-[10px] font-medium">{msg.timestamp}</span>
                                                        {msg.isMe && <CheckCheck className="h-3 w-3" />}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Chat Input */}
                                    <div className="p-4 border-t bg-white dark:bg-slate-900">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0">
                                                    <Paperclip className="h-4 w-4" />
                                                </Button>
                                                <div className="flex-1 relative">
                                                    <input
                                                        type="text"
                                                        value={newMessage}
                                                        onChange={(e) => setNewMessage(e.target.value)}
                                                        placeholder="Type your message..."
                                                        className="w-full h-10 pl-4 pr-10 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                                    />
                                                    <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-8 w-8 rounded-lg text-slate-400">
                                                        <Smile className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <Button
                                                    size="icon"
                                                    className={`h-10 w-10 rounded-xl transition-all shadow-lg ${newMessage ? 'bg-primary scale-105 shadow-primary/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
                                                    disabled={!newMessage}
                                                >
                                                    <Send className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>
                )}
            </AnimatePresence>

            {isMinimized && (
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="pointer-events-auto"
                >
                    <Button
                        onClick={() => setIsMinimized(false)}
                        className="h-16 w-16 rounded-full bg-slate-900 shadow-2xl p-0 flex items-center justify-center group border-4 border-white dark:border-slate-800"
                    >
                        <User className="h-7 w-7 text-white" />
                        <span className="absolute -top-1 -right-1 h-6 w-6 bg-primary rounded-full border-2 border-white dark:border-slate-800 text-[10px] font-black text-white flex items-center justify-center">
                            {selectedContact.name.split(' ').map((n: string) => n[0]).join('')}
                        </span>
                    </Button>
                </motion.div>
            )}
        </div>
    );
};
