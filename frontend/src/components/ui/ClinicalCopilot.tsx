import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, AlertTriangle, Lightbulb, Zap, X, ChevronRight, BrainCircuit, Send, User } from 'lucide-react';
import { Button } from './button';
import { useLocation } from 'react-router-dom';
import { useClickOutside } from '../../hooks/useClickOutside';
import api from '../../services/api';



interface ClinicalCopilotProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export const ClinicalCopilot: React.FC<ClinicalCopilotProps> = ({ isOpen, onClose }) => {

    // Close on click outside using robust capture-phase hook
    const containerRef = useClickOutside<HTMLDivElement>(onClose);

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const location = useLocation();

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    // Auto-close on route change
    useEffect(() => {
        if (isOpen) onClose();
    }, [location.pathname]);

    // Close on click outside using robust capture-phase hook


    // Coordination: Listen for event to close copilot (e.g. from ChatHub)
    useEffect(() => {
        const handleCloseCopilot = () => {
            if (isOpen) onClose();
        };
        window.addEventListener('haemi-close-copilot', handleCloseCopilot);
        return () => window.removeEventListener('haemi-close-copilot', handleCloseCopilot);
    }, [isOpen, onClose]);

    return (
        <div className="fixed bottom-[96px] right-6 z-[60] flex flex-col items-end pointer-events-none font-sans">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={containerRef}
                        drag
                        dragMomentum={false}
                        initial={{ y: 20, opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 20, opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="pointer-events-auto bg-white dark:bg-[#1a1c23] rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/10 w-[380px] sm:w-[420px] max-w-[calc(100vw-32px)] h-[650px] max-h-[80vh] flex flex-col overflow-hidden ring-1 ring-black/5"
                    >
                        {/* Header - Deep Teal to match ChatHub */}
                        <div className="shrink-0 bg-[#026355] dark:bg-[#1a1c23]/95 backdrop-blur z-20">
                            <div className="px-5 py-4 flex items-center justify-between border-b border-white/10 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-white/10 text-white shadow-sm">
                                        <BrainCircuit className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm tracking-tight text-white leading-none">Clinical Copilot</h3>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            <span className="text-[10px] uppercase font-black tracking-widest text-emerald-100/80">AI Engine Live</span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="h-8 w-8 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-6 chat-scrollbar bg-slate-50 dark:bg-[#1a1c23]">

                            {/* AI Summary */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 text-[10px] font-black uppercase tracking-widest">
                                    <Sparkles className="h-3 w-3" />
                                    Daily Intelligence
                                </div>
                                <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm leading-relaxed text-slate-700 dark:text-white/90 shadow-sm">
                                    Dr. Modise, you have <span className="text-amber-600 dark:text-amber-400 font-bold underline decoration-amber-500/30 underline-offset-4">3 high-risk</span> patients today. I recommend reviewing <span className="text-slate-900 dark:text-white font-bold">Kagiso Moalusi's</span> recent lab results from Princess Marina before the 10:00 session.
                                </div>
                            </section>

                            {/* Warnings */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 text-rose-500 text-[10px] font-black uppercase tracking-widest">
                                    <AlertTriangle className="h-3 w-3" />
                                    Critical Alerts
                                </div>
                                <div className="space-y-3">
                                    <motion.div
                                        whileHover={{ x: 4 }}
                                        className="p-4 rounded-2xl bg-rose-50 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20 group cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all shadow-sm"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-500 group-hover:scale-110 transition-transform">
                                                <Zap className="h-4 w-4" />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="font-bold text-sm text-rose-700 dark:text-rose-100 italic">Drug Interaction Risk</div>
                                                <p className="text-xs text-slate-600 dark:text-white/60 leading-tight">Patient Neo Dube: Amoxil vs. existing Warfarin therapy.</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            </section>

                            {/* Recommendations */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 text-[10px] font-black uppercase tracking-widest">
                                    <Lightbulb className="h-3 w-3" />
                                    Task Optimization
                                </div>
                                <div className="space-y-2 font-medium">
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 hover:border-teal-500/30 transition-all cursor-pointer group shadow-sm">
                                        <span className="text-sm text-slate-700 dark:text-white/80 group-hover:text-teal-600 dark:group-hover:text-white transition-colors">Batch sign prescriptions</span>
                                        <ChevronRight className="h-4 w-4 text-slate-300 dark:text-white/20 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 hover:border-teal-500/30 transition-all cursor-pointer group shadow-sm">
                                        <span className="text-sm text-slate-700 dark:text-white/80 group-hover:text-teal-600 dark:group-hover:text-white transition-colors">Update clinical protocols</span>
                                        <ChevronRight className="h-4 w-4 text-slate-300 dark:text-white/20 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                            </section>


                            {/* Dynamic Chat Messages */}
                            <div className="pb-5 space-y-4">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        {msg.role === 'assistant' && (
                                            <div className="h-8 w-8 rounded-full bg-teal-100 dark:bg-teal-600/20 text-teal-600 dark:text-teal-500 flex items-center justify-center shrink-0 border border-teal-200 dark:border-teal-500/30">
                                                <BrainCircuit className="h-4 w-4" />
                                            </div>
                                        )}
                                        <div className={`p-3 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                            ? 'bg-teal-600 text-white rounded-tr-none'
                                            : 'bg-white dark:bg-white/10 text-slate-800 dark:text-white/90 rounded-tl-none border border-slate-200 dark:border-white/10'
                                            }`}>
                                            {msg.content}
                                        </div>
                                        {msg.role === 'user' && (
                                            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-gray-300 flex items-center justify-center shrink-0">
                                                <User className="h-4 w-4" />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {isLoading && (
                                    <div className="flex gap-3">
                                        <div className="h-8 w-8 rounded-full bg-teal-100 dark:bg-teal-600/20 text-teal-600 dark:text-teal-500 flex items-center justify-center shrink-0 border border-teal-200 dark:border-teal-500/30">
                                            <BrainCircuit className="h-4 w-4 animate-pulse" />
                                        </div>
                                        <div className="p-3 rounded-2xl bg-white dark:bg-white/10 text-slate-800 dark:text-white/90 rounded-tl-none border border-slate-200 dark:border-white/10 flex items-center gap-2 shadow-sm">
                                            <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-white/40 rounded-full animate-bounce [animation-delay:0ms]" />
                                            <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-white/40 rounded-full animate-bounce [animation-delay:150ms]" />
                                            <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-white/40 rounded-full animate-bounce [animation-delay:300ms]" />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Footer */}
                        {/* Chat Input Footer */}
                        <div className="p-3 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 shrink-0 z-10 w-full relative">
                            <form
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (!inputValue.trim() || isLoading) return;

                                    const userMsg: Message = {
                                        id: Date.now().toString(),
                                        role: 'user',
                                        content: inputValue,
                                        timestamp: new Date()
                                    };

                                    setMessages(prev => [...prev, userMsg]);
                                    setInputValue('');
                                    setIsLoading(true);

                                    try {
                                        const response = await api.post('/clinical-copilot/chat', {
                                            query: userMsg.content
                                        });

                                        const data = response.data;

                                        if (data.response) {
                                            const aiMsg: Message = {
                                                id: (Date.now() + 1).toString(),
                                                role: 'assistant',
                                                content: data.response,
                                                timestamp: new Date()
                                            };
                                            setMessages(prev => [...prev, aiMsg]);
                                        } else {
                                            // Handle error
                                            console.error('AI Error: No response data');
                                        }
                                    } catch (err) {
                                        console.error('Network Error:', err);
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }}
                                className="relative flex items-end gap-2"
                            >
                                <div className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center min-h-[44px] px-4 py-2 transition-all focus-within:ring-1 focus-within:ring-teal-500/50">
                                    <input
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder="Ask about patient history, interactions..."
                                        className="w-full bg-transparent border-none focus:ring-0 outline-none p-0 pl-2 text-slate-900 dark:text-white placeholder-slate-400 text-sm max-h-24 resize-none leading-relaxed"
                                        disabled={isLoading}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={isLoading || !inputValue.trim()}
                                    className={`h-10 w-10 shrink-0 rounded-full shadow-md transition-all ${inputValue.trim()
                                        ? 'bg-teal-600 hover:bg-teal-700 text-white scale-100'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-300 scale-95'
                                        }`}
                                >
                                    <Send className="h-5 w-5 ml-0.5" />
                                </Button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};
