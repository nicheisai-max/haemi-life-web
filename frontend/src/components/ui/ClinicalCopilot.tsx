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
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ x: 300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 300, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    className="fixed right-0 top-0 h-screen w-[380px] z-50 p-6 pt-24"
                >
                    <GlassCard className="h-full flex flex-col border-l border-white/20 shadow-[-20px_0_50px_rgba(0,0,0,0.2)] overflow-hidden" mesh meshVariant="accent">
                        {/* Header */}
                        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
                                    <BrainCircuit className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg leading-none">Clinical Copilot</h3>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-[10px] uppercase font-black tracking-widest text-white/40">AI Engine Live</span>
                                    </div>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            {/* AI Summary */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-amber-500 text-sm font-bold uppercase tracking-tighter">
                                    <Sparkles className="h-4 w-4" />
                                    Daily Intelligence
                                </div>
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-sm leading-relaxed text-white/80">
                                    Dr. Modise, you have <span className="text-amber-400 font-bold">3 high-risk</span> patients today.
                                    I recommend reviewing Kagiso Moalusi's recent lab results from Princess Marina before the 10:00 session.
                                </div>
                            </section>

                            {/* Warnings */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-rose-500 text-sm font-bold uppercase tracking-tighter">
                                    <AlertTriangle className="h-4 w-4" />
                                    Critical Alerts
                                </div>
                                <div className="space-y-3">
                                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 group cursor-pointer hover:bg-rose-500/20 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-500">
                                                <Zap className="h-4 w-4" />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="font-bold text-sm">Drug Interaction Risk</div>
                                                <p className="text-xs text-white/60">Patient Neo Dube: Amoxil vs. existing Warfarin therapy.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Recommendations */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-teal-500 text-sm font-bold uppercase tracking-tighter">
                                    <Lightbulb className="h-4 w-4" />
                                    Optimization
                                </div>
                                <div className="space-y-3 font-medium">
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer group">
                                        <span className="text-sm">Batch sign prescriptions</span>
                                        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer group">
                                        <span className="text-sm">Update clinical protocols</span>
                                        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-white/10 bg-white/5">
                            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold h-12 rounded-xl group">
                                Generate Summary Report
                                <Sparkles className="ml-2 h-4 w-4 group-hover:animate-spin" />
                            </Button>
                        </div>
                    </GlassCard>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
