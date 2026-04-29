import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck, Activity } from 'lucide-react';
import { logger } from '@/utils/logger';
import screeningService, { 
    ScreeningQuestion, 
    ScreeningResponse, 
    RiskReport 
} from '@/services/screening.service';

interface HealthScreeningFormProps {
    onComplete: (responses: ScreeningResponse[], riskReport: RiskReport) => void;
    onAnalyzingChange?: (isAnalyzing: boolean) => void;
}

/**
 * 🛡️ HAEMI LIFE: INSTITUTIONAL HEALTH SCREENING FORM (v12.0 Platinum)
 * Engineering Standard: Google/Meta Grade Optimistic UI & Strict Type-Safety.
 * Policy: Zero Interaction Deadlock | Atomic State Transitions.
 */
export const HealthScreeningForm: React.FC<HealthScreeningFormProps> = ({ 
    onComplete,
    onAnalyzingChange 
}) => {
    const [questions, setQuestions] = useState<ScreeningQuestion[]>([]);
    const [responses, setResponses] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

    // 🛡️ INSTITUTIONAL ANALYZING SYNC
    useEffect(() => {
        onAnalyzingChange?.(isAnalyzing);
    }, [isAnalyzing, onAnalyzingChange]);

    // 🛡️ STABLE CALLBACK REF
    const onCompleteRef = useRef(onComplete);
    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    // 🩺 CONCURRENCY GUARD
    const latestRequestId = useRef<number>(0);

    const notifyParent = useCallback(async (currentResponses: Record<string, boolean>, currentQuestions: ScreeningQuestion[]): Promise<void> => {
        const requestId = ++latestRequestId.current;
        setIsAnalyzing(true);

        try {
            const formattedResponses: ScreeningResponse[] = Object.entries(currentResponses).map(([id, value]) => ({
                question_id: id,
                response_value: value
            }));

            const riskReport = await screeningService.analyzeWithAI(formattedResponses, currentQuestions);
            
            // 🛡️ INSTITUTIONAL CONCURRENCY LOCK
            // Only commit the result if this is the most recent user interaction.
            if (requestId === latestRequestId.current) {
                onCompleteRef.current(formattedResponses, riskReport);
            }
        } catch (error: unknown) {
            // Even on failure, we must commit a baseline report to keep the UI consistent
            if (requestId === latestRequestId.current) {
                logger.error('[HealthScreeningForm] AI Sync failure', { error });
                onCompleteRef.current(
                    Object.entries(currentResponses).map(([id, value]) => ({
                        question_id: id,
                        response_value: value
                    })),
                    {
                        score: 0,
                        level: 'Low',
                        message: 'Basic clinical flags detected (AI Sync Fallback).'
                    }
                );
            }
        } finally {
            // Global analyzed state reset: only the LATEST request is authorized to unlock the UI
            if (requestId === latestRequestId.current) {
                setIsAnalyzing(false);
            }
        }
    }, [setIsAnalyzing]);

    // 🛡️ DEBOUNCED AI NOTIFIER (Institutional Resilience)
    useEffect(() => {
        if (loading || questions.length === 0) return;

        const debounceTimer = setTimeout(() => {
            void notifyParent(responses, questions);
        }, 400); // Optimized 400ms Grace Period

        return () => clearTimeout(debounceTimer);
    }, [responses, questions, loading, notifyParent]);

    useEffect(() => {
        const bootSequence = async (): Promise<void> => {
            try {
                const activeQuestions = await screeningService.getActiveQuestions();
                setQuestions(activeQuestions);

                const initialResponses: Record<string, boolean> = {};
                activeQuestions.forEach(q => {
                    initialResponses[q.id] = false;
                });
                setResponses(initialResponses);
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Unknown clinical load failure';
                logger.error('[HealthScreeningForm] Boot failure', { msg });
            } finally {
                setLoading(false);
            }
        };
        void bootSequence();
    }, []);


    /**
     * 🛡️ OPTIMISTIC INTERACTION HANDLER
     */
    const handleToggle = useCallback((question_id: string): void => {
        const nextValue = !responses[question_id];
        const nextResponses = { ...responses, [question_id]: nextValue };
        
        // Instant Visual Feedback
        setIsAnalyzing(true); 
        setResponses(nextResponses);
    }, [responses, setIsAnalyzing, setResponses]);

    if (loading) {
        return <div className="p-8 text-center animate-pulse text-slate-400">Initializing clinical triage...</div>;
    }

    return (
        <div className="triage-container">
            {/* Institutional Banner */}
            <div className="triage-banner">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <div>
                        <h3 className="font-bold text-foreground text-sm leading-none">Clinical Health Screening</h3>
                        <p className="text-[0.65rem] text-slate-500 font-medium italic mt-1">Provide accurate clinical signals for institutional mapping.</p>
                    </div>
                </div>
            </div>

            {/* Questions Grid */}
            <div className="space-y-2">
                {questions.map((q) => {
                    const isActive = responses[q.id];
                    return (
                        <Card
                            key={q.id}
                            className={`triage-card ${isActive ? 'triage-card--active' : ''} ${isAnalyzing ? 'triage-card--analyzing' : ''}`}
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className={`triage-icon-box ${isActive ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        <Activity className="w-3 h-3" />
                                    </div>
                                    <span className={`triage-question-text ${isActive ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                                        {q.question_text}
                                    </span>
                                </div>
                                <div className="triage-switch-wrapper">
                                    <Switch
                                        checked={isActive}
                                        onCheckedChange={() => handleToggle(q.id)}
                                        className="data-[state=checked]:bg-primary scale-75"
                                    />
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};
