import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, ShieldCheck, Stethoscope, Activity, BrainCircuit, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PreScreeningQuestion, PreScreeningResponse } from '../../services/appointment.service';
import api from '../../services/api';

interface PreScreeningFormProps {
    questions: PreScreeningQuestion[];
    responses: PreScreeningResponse[];
    onResponseChange: (responses: PreScreeningResponse[]) => void;
    onRiskAnalysisComplete?: (report: PatientRiskReport) => void;
}

export interface PatientRiskReport {
    riskLevel: 'Low' | 'Medium' | 'High';
    summary: string;
    suggestedActions: string[];
}

export const PreScreeningForm: React.FC<PreScreeningFormProps> = ({
    questions,
    responses,
    onResponseChange,
    onRiskAnalysisComplete
}) => {
    const [isAnalyzing, setIsAnalyzing] = React.useState(false);
    const [riskReport, setRiskReport] = React.useState<PatientRiskReport | null>(null);

    const selfDeclarationQuestions = questions.filter(q => q.category === 'self-declaration');
    const triageQuestions = questions.filter(q => q.category === 'triage');
    const riskAssessmentQuestions = questions.filter(q => q.category === 'risk-assessment');

    const handleToggle = (questionId: string, value: boolean) => {
        const existingIndex = responses.findIndex(r => r.question_id === questionId);
        const newResponses = [...responses];

        if (existingIndex > -1) {
            newResponses[existingIndex] = { ...newResponses[existingIndex], response_value: value };
        } else {
            newResponses.push({ question_id: questionId, response_value: value });
        }

        onResponseChange(newResponses);
    };

    const isChecked = (questionId: string) => {
        return responses.find(r => r.question_id === questionId)?.response_value || false;
    };

    const allAnswered = questions.length > 0 && responses.length === questions.length;

    const runRiskAnalysis = React.useCallback(async () => {
        if (!allAnswered || isAnalyzing) return;
        
        setIsAnalyzing(true);
        try {
            const apiPayload = {
                responses: responses.map(r => ({
                    question: questions.find(q => q.id === r.question_id)?.question_text || '',
                    answer: r.response_value
                }))
            };

            const response = await api.post('/clinical-copilot/analyze-patient-risk', apiPayload);
            if (response.data?.success && response.data?.report) {
                setRiskReport(response.data.report);
                if (onRiskAnalysisComplete) onRiskAnalysisComplete(response.data.report);
            }
        } catch (error) {
            console.error('[RISK_ANALYSIS_ERROR]:', error);
        } finally {
            setIsAnalyzing(false);
        }
    }, [allAnswered, isAnalyzing, responses, questions, onRiskAnalysisComplete]);

    React.useEffect(() => {
        if (allAnswered && !riskReport) {
            runRiskAnalysis();
        }
    }, [allAnswered, riskReport, runRiskAnalysis]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* TIER 1: CHRONIC SELF-DECLARATION */}
            <section className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-primary/10 flex items-center justify-center text-primary rounded-[var(--card-radius)]">
                        <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground">Tier 1: Health Self-Declaration</h3>
                        <p className="text-xs text-muted-foreground italic">Please declare any existing chronic conditions for clinical safety.</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {selfDeclarationQuestions.map((q) => (
                        <Card
                            key={q.id}
                            className={cn(
                                "p-4 flex items-center justify-between gap-4 transition-all duration-300 rounded-[var(--card-radius)]",
                                isChecked(q.id) ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-white dark:bg-card/30"
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <ShieldCheck className={cn(
                                    "h-5 w-5 mt-0.5",
                                    isChecked(q.id) ? "text-primary" : "text-muted-foreground/40"
                                )} />
                                <span className="text-sm font-medium text-foreground leading-snug">{q.question_text}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    {isChecked(q.id) ? 'Yes' : 'No'}
                                </span>
                                <Switch
                                    checked={isChecked(q.id)}
                                    onCheckedChange={(checked) => handleToggle(q.id, checked === true)}
                                />
                            </div>
                        </Card>
                    ))}
                </div>
            </section>

            {/* TIER 2: ACUTE SYMPTOM TRIAGE */}
            <section className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400 rounded-[var(--card-radius)]">
                        <Stethoscope className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground">Tier 2: Symptom Assessment</h3>
                        <p className="text-xs text-muted-foreground italic">Identifying acute symptoms for diagnostic triage.</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {triageQuestions.map((q) => (
                        <Card
                            key={q.id}
                            className={cn(
                                "p-4 flex items-center justify-between gap-4 transition-all duration-300 rounded-[var(--card-radius)]",
                                isChecked(q.id) ? "bg-orange-50/50 dark:bg-orange-950/10 border-orange-200/50" : "bg-white dark:bg-card/30"
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <AlertCircle className={cn(
                                    "h-5 w-5 mt-0.5",
                                    isChecked(q.id) ? "text-orange-500" : "text-muted-foreground/40"
                                )} />
                                <span className="text-sm font-medium text-foreground leading-snug">{q.question_text}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    {isChecked(q.id) ? 'Yes' : 'No'}
                                </span>
                                <Switch
                                    checked={isChecked(q.id)}
                                    onCheckedChange={(checked) => handleToggle(q.id, checked)}
                                />
                            </div>
                        </Card>
                    ))}
                </div>
            </section>

            {/* TIER 3: CLINICAL RISK & LIFESTYLE (New) */}
            {riskAssessmentQuestions.length > 0 && (
                <section className="space-y-4 pt-4 border-t border-border/20">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400 rounded-[var(--card-radius)]">
                            <AlertCircle className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Tier 3: Risk & Lifestyle Assessment</h3>
                            <p className="text-xs text-muted-foreground italic">Background risk factors and clinical predisposition.</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {riskAssessmentQuestions.map((q) => (
                            <Card
                                key={q.id}
                                className={cn(
                                    "p-4 flex items-center justify-between gap-4 transition-all duration-300 rounded-[var(--card-radius)]",
                                    isChecked(q.id) ? "bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50" : "bg-white dark:bg-card/30"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <Activity className={cn(
                                        "h-5 w-5 mt-0.5",
                                        isChecked(q.id) ? "text-amber-500" : "text-muted-foreground/40"
                                    )} />
                                    <span className="text-sm font-medium text-foreground leading-snug">{q.question_text}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        {isChecked(q.id) ? 'Yes' : 'No'}
                                    </span>
                                    <Switch
                                        checked={isChecked(q.id)}
                                        onCheckedChange={(checked) => handleToggle(q.id, checked)}
                                    />
                                </div>
                            </Card>
                        ))}
                    </div>
                </section>
            )}

            {/* AI-POWERED RISK ASSESSMENT CARD */}
            {(isAnalyzing || riskReport) && (
                <Card className={cn(
                    "p-6 border-t-4 transition-all duration-500 animate-in zoom-in-95 shadow-xl rounded-[var(--card-radius)]",
                    isAnalyzing ? "border-primary/20 bg-primary/5" : 
                    riskReport?.riskLevel === 'High' ? "border-rose-500 bg-rose-50/30 dark:bg-rose-950/10" :
                    riskReport?.riskLevel === 'Medium' ? "border-amber-500 bg-amber-50/30 dark:bg-amber-950/10" :
                    "border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/10"
                )}>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-2 rounded-full",
                                    riskReport?.riskLevel === 'High' ? "bg-rose-100 text-rose-600" :
                                    riskReport?.riskLevel === 'Medium' ? "bg-amber-100 text-amber-600" :
                                    "bg-emerald-100 text-emerald-600"
                                )}>
                                    <BrainCircuit className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-base">AI Health Insights</h4>
                                    <p className="text-xs text-muted-foreground">Clinical assessment based on your responses.</p>
                                </div>
                            </div>
                            {riskReport && (
                                <Badge variant="outline" className={cn(
                                    "px-3 py-1 font-black uppercase tracking-tighter text-[10px]",
                                    riskReport.riskLevel === 'High' ? "border-rose-200 text-rose-700 bg-rose-50" :
                                    riskReport.riskLevel === 'Medium' ? "border-amber-200 text-amber-700 bg-amber-50" :
                                    "border-emerald-200 text-emerald-700 bg-emerald-50"
                                )}>
                                    {riskReport.riskLevel} Risk
                                </Badge>
                            )}
                        </div>

                        {isAnalyzing ? (
                            <div className="py-4 space-y-3">
                                <div className="h-4 bg-slate-200 animate-pulse rounded-full w-3/4" />
                                <div className="h-4 bg-slate-200 animate-pulse rounded-full w-1/2" />
                            </div>
                        ) : riskReport && (
                            <div className="space-y-4">
                                <p className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300 italic">
                                    "{riskReport.summary}"
                                </p>
                                
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <Lightbulb className="h-3 w-3" />
                                        Recommended Actions
                                    </p>
                                    <ul className="grid grid-cols-1 gap-2">
                                        {riskReport.suggestedActions.map((action, idx) => (
                                            <li key={idx} className="text-xs flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                {action}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
};
