import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ScreeningQuestion,
    ScreeningOutcome
} from '../../types/screening.types';
import {
    CheckCircle,
    Stethoscope,
    AlertTriangle,
    Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface SymptomScreeningCardProps {
    questions: ScreeningQuestion[];
    responses: Record<string, boolean>;
    onResponseChange: (questionId: string, value: boolean) => void;
    outcome: ScreeningOutcome | null;
}

/**
 * SymptomScreeningCard - Diamond Component
 * Institutional Clinical Screening UI with real-time feedback.
 * Adheres to Google/Meta premium design standards.
 * FIXED: Removed RadioGroup dependency, corrected imports, and removed hallucinated fonts.
 */
export const SymptomScreeningCard: React.FC<SymptomScreeningCardProps> = ({
    questions,
    responses,
    onResponseChange,
    outcome
}) => {
    // Strictly Dynamic Calculation: Filter against actual questions array
    const answeredCount = React.useMemo(() => 
        questions.filter(q => responses[q.id] !== undefined).length
    , [questions, responses]);
    
    const isComplete = questions.length > 0 && answeredCount === questions.length;

    return (
        <Card className={`rounded-[var(--card-radius)] border-primary/10 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm transition-all duration-500 ${isComplete ? 'ring-2 ring-emerald-500/20' : ''}`}>
            <CardHeader className="border-b border-primary/5 bg-primary/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-[var(--card-radius)] bg-primary/10 text-primary">
                            <Stethoscope className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold tracking-tight">Clinical Screening</CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Mandatory health screening for Botswana healthcare compliance
                            </CardDescription>
                        </div>
                    </div>
                    <div className="text-right">
                        <motion.div 
                            key={answeredCount}
                            initial={{ scale: 0.95, opacity: 0.8 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`text-[10px] font-bold uppercase tracking-widest ${isComplete ? 'text-emerald-500' : 'text-primary'}`}
                        >
                            {answeredCount} / {questions.length} Complete
                        </motion.div>
                        <div className="w-24 h-1 bg-muted/50 rounded-full mt-1 overflow-hidden">
                            <motion.div 
                                className="h-full bg-primary"
                                initial={false}
                                animate={{ width: `${(answeredCount / (questions.length || 1)) * 100}%` }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
                <div className="grid gap-6">
                    {questions.map((question, index) => (
                        <motion.div
                            key={question.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`flex items-center justify-between gap-4 p-4 rounded-[var(--card-radius)] bg-background/50 border transition-all duration-300 ${responses[question.id] === undefined ? 'border-transparent' : 'border-primary/20 shadow-sm'}`}
                        >
                            <div className="space-y-1 flex-1">
                                <p className="text-sm font-medium leading-tight text-foreground/90 flex items-center gap-2">
                                    {question.questionTextEn}
                                    {responses[question.id] === undefined && (
                                        <span className="inline-block w-1 h-1 rounded-full bg-red-500 animate-pulse" title="Required" />
                                    )}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border border-primary/5">
                                <button
                                    type="button"
                                    onClick={() => onResponseChange(question.id, false)}
                                    className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${responses[question.id] === false ? 'bg-white dark:bg-primary shadow-sm text-primary dark:text-white border border-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    No
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onResponseChange(question.id, true)}
                                    className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${responses[question.id] === true ? 'bg-red-500 shadow-sm text-white border border-red-600' : 'text-muted-foreground hover:text-red-400'}`}
                                >
                                    Yes
                                </button>
                                
                                {responses[question.id] !== undefined && (
                                    <motion.div 
                                        layoutId={`bg-${question.id}`}
                                        className="absolute inset-0 bg-primary/5 -z-10"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    />
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Real-time Outcome Logic Visualization */}
                <AnimatePresence mode="wait">
                    {outcome && (
                        <motion.div
                            key={outcome}
                            initial={{ opacity: 0, scale: 0.95, height: 0 }}
                            animate={{ opacity: 1, scale: 1, height: 'auto' }}
                            exit={{ opacity: 0, scale: 0.95, height: 0 }}
                            className="mt-6"
                        >
                            {outcome === 'PRESUMPTIVE' ? (
                                <div className="p-4 rounded-[var(--card-radius)] bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 flex items-start gap-4">
                                    <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 shrink-0">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-red-800 dark:text-red-300">Presumptive TB / High-Risk Detected</h4>
                                        <p className="text-xs text-red-700/80 dark:text-red-400/80 leading-relaxed">
                                            Based on your symptoms, we highly recommend a TB evaluation.
                                            Our system will provide you with clinical guidance upon booking.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 rounded-[var(--card-radius)] bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 flex items-start gap-4">
                                    <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                                        <CheckCircle className="w-5 h-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Screening Negative</h4>
                                        <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 leading-relaxed">
                                            No critical symptoms detected. You may proceed with your appointment booking safely.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="pt-4 border-t border-primary/5 flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                    <Info className="w-3 h-3" />
                    Medical grade security | Institutional privacy lock
                </div>
            </CardContent>
        </Card>
    );
};
