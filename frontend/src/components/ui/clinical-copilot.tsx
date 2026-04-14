import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, AlertTriangle, Lightbulb, Zap, X, ChevronRight, BrainCircuit, Send, User } from 'lucide-react';
import { Button } from './button';
import { useLocation } from 'react-router-dom';
import { useClickOutside } from '../../hooks/use-click-outside';
import api from '../../services/api';
import { logger } from '@/utils/logger';

/**
 * 🩺 HAEMI LIFE | INSTITUTIONAL AI COPILOT (FRONTEND)
 * Standard: Google/Meta Grade TypeScript Execution (Strict Contract Sync)
 * Model: gemini-2.5-pro (Architect-Mandated JSON Contract)
 */

interface ClinicalCopilotProps<T extends Element = Element> {
    isOpen: boolean;
    onClose: () => void;
    triggerRef?: React.RefObject<T | null>;
}

interface Message {
    id: string;
    role: 'user' | 'model';
    content: string;
    timestamp: Date;
}

// 🧬 INSTITUTIONAL MEMOIZATION: ATOMIC SUB-COMPONENTS
// Prevent redundant re-renders of static clinical data
const StaticSections = React.memo(() => (
    <div className="space-y-6">
        {/* Daily Intelligence Summary */}
        <section className="space-y-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 text-[10px] font-black uppercase tracking-widest">
                <Sparkles className="h-3 w-3" />
                Daily Intelligence
            </div>
            <div className="p-4 rounded-[var(--card-radius)] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm leading-relaxed text-slate-700 dark:text-white/90 shadow-sm font-medium">
                Dr. Modise, you have <span className="text-amber-600 dark:text-amber-400 font-bold underline decoration-amber-500/30 underline-offset-4">3 high-risk</span> patients today. Review <span className="text-slate-900 dark:text-white font-bold">Kagiso Moalusi's</span> labs before 10:00.
            </div>
        </section>

        {/* Logic: Critical Alerts Overlay */}
        <section className="space-y-3">
            <div className="flex items-center gap-2 text-rose-500 text-[10px] font-black uppercase tracking-widest">
                <AlertTriangle className="h-3 w-3" />
                Critical Alerts
            </div>
            <div className="p-4 rounded-[var(--card-radius)] bg-rose-50 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20 group cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-500/25 transition-all shadow-sm">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-[var(--card-radius)] bg-rose-100 dark:bg-rose-500/20 text-rose-600">
                        <Zap className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                        <div className="font-bold text-sm text-rose-700 dark:text-rose-100 italic">Drug Interaction Risk</div>
                        <p className="text-xs text-slate-600 dark:text-white/60">Patient Neo Dube: Amoxil vs. Warfarin therapy.</p>
                    </div>
                </div>
            </div>
        </section>

        {/* Task Optimization Section */}
        <section className="space-y-3">
            <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 text-[10px] font-black uppercase tracking-widest">
                <Lightbulb className="h-3 w-3" />
                Task Optimization
            </div>
            <div className="space-y-2">
                {['Batch sign prescriptions', 'Update clinical protocols'].map((task) => (
                    <div key={task} className="flex items-center justify-between p-3 rounded-[var(--card-radius)] bg-white dark:bg-[#14262A] hover:bg-slate-50 dark:hover:bg-teal-900/10 border border-slate-200 dark:border-teal-500/20 transition-all cursor-pointer group shadow-sm">
                        <span className="text-sm text-slate-700 dark:text-white/80 group-hover:text-teal-600 transition-colors font-medium">{task}</span>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:translate-x-1 transition-all" />
                    </div>
                ))}
            </div>
        </section>
    </div>
));

// Memoized Message List: Protects the history stack from re-rendering during typing
const MessageList = React.memo(({ messages, isLoading, messagesEndRef }: { 
    messages: Message[], 
    isLoading: boolean,
    messagesEndRef: React.RefObject<HTMLDivElement | null>
}) => (
    <div className="pt-4 space-y-[1rem]">
        <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
                <motion.div 
                    key={msg.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-[0.75rem] ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                    {msg.role === 'model' && (
                        <div className="h-[2rem] w-[2rem] rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 border border-teal-200 dark:border-teal-900/50 shadow-sm">
                            <BrainCircuit className="h-[1rem] w-[1rem]" />
                        </div>
                    )}
                    <div className={`p-[0.75rem] rounded-[var(--card-radius)] max-w-[85%] text-[0.875rem] leading-relaxed shadow-sm font-medium ${msg.role === 'user'
                        ? 'bg-teal-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-[#14262A] text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-teal-900/50'
                        }`}>
                        {msg.content}
                    </div>
                    {msg.role === 'user' && (
                        <div className="h-[2rem] w-[2rem] rounded-full bg-slate-200 dark:bg-[#14262A] text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0 border border-slate-300 dark:border-teal-900/50 shadow-sm">
                            <User className="h-[1rem] w-[1rem]" />
                        </div>
                    )}
                </motion.div>
            ))}

            {isLoading && (
                <motion.div 
                    key="thinking"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex gap-[0.75rem]"
                >
                    <div className="h-[2rem] w-[2rem] rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-600 flex items-center justify-center shrink-0">
                        <BrainCircuit className="h-4 w-4 animate-pulse" />
                    </div>
                    <div className="p-3 rounded-[var(--card-radius)] bg-teal-50 dark:bg-teal-900/30 flex items-center gap-2 shadow-sm border border-teal-100 dark:border-teal-900/40">
                        <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
    </div>
));

export const ClinicalCopilot = React.memo(<T extends Element,>({ isOpen, onClose, triggerRef }: ClinicalCopilotProps<T>) => {
    const ignoredRefs = useMemo(() => (triggerRef ? [triggerRef] : []), [triggerRef]);
    
    // 🧬 INTERACTION STABILIZATION: Ensuring ClickOutside doesn't conflict with Drag
    const containerRef = useClickOutside<HTMLDivElement>(
        () => { if (isOpen) onClose(); },
        ignoredRefs,
        isOpen
    );

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const location = useLocation();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => { scrollToBottom(); }, [messages, isOpen, isLoading]);

    const mountPathRef = useRef(location.pathname);
    useEffect(() => {
        if (location.pathname !== mountPathRef.current && isOpen) {
            onClose();
        }
    }, [location.pathname, isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            logger.debug('[ClinicalCopilot] Overlay active: copilot');
        }
    }, [isOpen]);

    const handleSendMessage = async (e: React.FormEvent) => {
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
            const synchronizedHistory = [
                ...messages.filter(m => m && m.content && typeof m.content === 'string' && !m.content.includes('⚠️')), 
                userMsg
            ].map(m => ({
                role: m.role,
                parts: [{ text: m.content }]
            }));

            const response = await api.post('/clinical-copilot/chat', {
                message: userMsg.content,
                history: synchronizedHistory.slice(0, -1)
            });

            if (response.data?.success && response.data?.reply) {
                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'model',
                    content: response.data.reply,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, aiMsg]);
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('[CLINICAL_COPILOT_ERROR]:', errorMessage);
            const errMsg: Message = {
                id: 'error-' + Date.now(),
                role: 'model',
                content: '⚠️ [Inference Interrupted] System stabilizing. Please retry your clinical query.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-[96px] right-6 z-[60] pointer-events-none font-sans">
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
                        className="pointer-events-auto bg-white dark:bg-[#0B1214] rounded-[var(--card-radius)] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/10 w-[380px] sm:w-[420px] max-w-[calc(100vw-32px)] h-[650px] max-h-[80vh] flex flex-col overflow-hidden ring-1 ring-black/5 cursor-grab active:cursor-grabbing"
                    >
                        {/* Institutional Header (Drag Handle area) */}
                        <div className="shrink-0 bg-[#026355] dark:bg-[#0F1C1F]/95 backdrop-blur z-20">
                            <div className="px-5 py-4 flex items-center justify-between border-b border-white/10 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-[var(--card-radius)] bg-white/10 text-white shadow-sm">
                                        <BrainCircuit className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm tracking-tight text-white leading-none">Clinical Copilot</h3>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            <span className="text-[10px] uppercase font-black tracking-widest text-emerald-100/80">Gemini 2.5 Pro Active</span>
                                        </div>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-5 chat-scrollbar bg-slate-50 dark:bg-[#0B1214]">
                            <StaticSections />
                            <MessageList 
                                messages={messages} 
                                isLoading={isLoading} 
                                messagesEndRef={messagesEndRef} 
                            />
                        </div>

                        {/* Input Footer */}
                        <div className="p-4 bg-white dark:bg-[#0F1C1F] border-t border-slate-100 dark:border-white/10">
                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Consult clinical copilot..."
                                    className="flex-1 px-4 h-10 bg-slate-50 dark:bg-[#14262A] border border-slate-200 dark:border-teal-900/50 rounded-[var(--card-radius)] focus:ring-1 focus:ring-teal-500 outline-none text-sm transition-all shadow-sm font-medium text-slate-900 dark:text-white"
                                    disabled={isLoading}
                                />
                                <Button type="submit" size="icon" disabled={!inputValue.trim() || isLoading} className={`h-10 w-10 rounded-[var(--card-radius)] transition-all shadow-sm ${inputValue.trim() ? 'bg-teal-600 hover:bg-teal-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});
