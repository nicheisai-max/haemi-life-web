import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, AlertTriangle, Lightbulb, Zap, X, ChevronRight, BrainCircuit } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { Button } from './button';

interface ClinicalCopilotProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ClinicalCopilot: React.FC<ClinicalCopilotProps> = ({ isOpen, onClose }) => {
    return (
        <div className="fixed bottom-[96px] right-6 z-[60] flex flex-col items-end pointer-events-none">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ y: 20, opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 20, opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="pointer-events-auto w-[380px] sm:w-[420px] max-w-[calc(100vw-32px)] max-h-[70vh] flex flex-col overflow-hidden"
                    >
                        <GlassCard className="h-full flex flex-col border border-white/10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden" mesh meshVariant="accent">
                            {/* Header */}
                            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-md">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500 shadow-lg shadow-amber-500/10">
                                        <BrainCircuit className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm tracking-tight text-white leading-none">Clinical Copilot</h3>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[10px] uppercase font-black tracking-widest text-emerald-400/80">AI Engine Live</span>
                                        </div>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-6 chat-scrollbar bg-[#1a1c23]/40">
                                <style>
                                    {`
                                        .chat-scrollbar::-webkit-scrollbar { width: 4px; }
                                        .chat-scrollbar::-webkit-scrollbar-track { background: transparent; }
                                        .chat-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                                        .chat-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
                                    `}
                                </style>

                                {/* AI Summary */}
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                                        <Sparkles className="h-3 w-3" />
                                        Daily Intelligence
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-sm leading-relaxed text-white/90 shadow-inner backdrop-blur-sm">
                                        Dr. Modise, you have <span className="text-amber-400 font-bold underline decoration-amber-400/30 underline-offset-4">3 high-risk</span> patients today. I recommend reviewing <span className="text-white font-bold">Kagiso Moalusi's</span> recent lab results from Princess Marina before the 10:00 session.
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
                                            className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 group cursor-pointer hover:bg-rose-500/20 transition-all shadow-lg shadow-rose-500/5"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-500 group-hover:scale-110 transition-transform">
                                                    <Zap className="h-4 w-4" />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="font-bold text-sm text-rose-100 italic">Drug Interaction Risk</div>
                                                    <p className="text-xs text-white/60 leading-tight">Patient Neo Dube: Amoxil vs. existing Warfarin therapy.</p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </div>
                                </section>

                                {/* Recommendations */}
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2 text-teal-400 text-[10px] font-black uppercase tracking-widest">
                                        <Lightbulb className="h-3 w-3" />
                                        Task Optimization
                                    </div>
                                    <div className="space-y-2 font-medium">
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-teal-500/30 transition-all cursor-pointer group">
                                            <span className="text-sm text-white/80 group-hover:text-white">Batch sign prescriptions</span>
                                            <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
                                        </div>
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-teal-500/30 transition-all cursor-pointer group">
                                            <span className="text-sm text-white/80 group-hover:text-white">Update clinical protocols</span>
                                            <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Footer */}
                            <div className="p-5 border-t border-white/10 bg-white/5 backdrop-blur-md">
                                <Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold h-11 rounded-xl group shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                                    Generate Summary Report
                                    <Sparkles className="ml-2 h-4 w-4 group-hover:animate-spin" />
                                </Button>
                            </div>
                        </GlassCard>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
