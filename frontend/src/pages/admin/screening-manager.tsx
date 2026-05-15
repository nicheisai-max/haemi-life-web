import React, { useState, useEffect, useRef } from 'react';
import { Plus, Save, Trash2, AlertCircle, CheckCircle2, Activity, ChevronDown, GripVertical, Undo2, Sparkles, Bot } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AnimatedAlert } from '@/components/ui/animated-alert';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { logger } from '@/utils/logger';
import screeningService, { ScreeningQuestion, type RiskCalculationMode } from '@/services/screening.service';
import { updateClinicalCopilotEnabled } from '@/services/clinical-copilot-admin.service';
import { useClinicalCopilot } from '@/hooks/use-clinical-copilot';
import { TransitionItem } from '@/components/layout/page-transition';
import { usePageLoader } from '@/hooks/use-page-loader';
import { useConfirm } from '@/hooks/use-confirm';

/**
 * Result of a successful reorder. Captures the previous order so the
 * Undo affordance can restore it within the visible window. Held in a
 * dedicated state slice (rather than mixed into `success`) so the toast
 * UX can be distinct: the success banner has an action button, an
 * automatic countdown, and a diff summary — none of which apply to the
 * generic save / delete success messages.
 */
interface ReorderUndoState {
    /** Snapshot of the order BEFORE the drag operation, for Undo. */
    readonly previousOrder: ReadonlyArray<{ id: string; sort_order: number }>;
    /** Question text and old/new positions of the row that actually moved. */
    readonly movedQuestionText: string;
    readonly fromPosition: number;
    readonly toPosition: number;
    /** Wall-clock millis at which the Undo offer expires and auto-dismisses. */
    readonly expiresAt: number;
}

const UNDO_WINDOW_MS = 10_000;


/**
 * 🛡️ HAEMI LIFE: INSTITUTIONAL SCREENING MANAGER (v14.0 Platinum)
 * Engineering Standard: Google/Meta Grade Dynamic Triage Engine.
 * Policy: Zero Visual Drift | Unified Design Tokens | DB-Driven Schema.
 */

const CATEGORIES = [
    'TB',
    'HIV',
    'Respiratory',
    'Diabetes',
    'Hypertension',
    'Other'
];

export const ScreeningManager: React.FC = () => {
    const { confirm } = useConfirm();
    const [questions, setQuestions] = useState<ScreeningQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generalError, setGeneralError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    // Persistent reorder confirmation. Replaces the previous 3-second
    // auto-dismiss banner that gave the user no time to verify the change
    // and no way to revert. While this is non-null, the UI shows the
    // change diff plus an Undo button.
    const [reorderUndo, setReorderUndo] = useState<ReorderUndoState | null>(null);
    const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Platform-wide risk-calculation mode (admin-controlled). `null` =
    // not yet hydrated; the toggle stays disabled until the initial GET
    // resolves so the admin can never accidentally flip an unknown
    // state into the wrong direction.
    const [riskMode, setRiskMode] = useState<RiskCalculationMode | null>(null);
    const [riskModeUpdating, setRiskModeUpdating] = useState<boolean>(false);

    // Clinical Copilot kill switch (AI cost-control). Live state is
    // sourced from `<ClinicalCopilotProvider>` so a flip from any
    // device propagates here instantly via the socket broadcast.
    // Local `updating` flag gates the spinner during the PUT round-trip.
    const { enabled: copilotEnabled, isHydrated: copilotHydrated } = useClinicalCopilot();
    const [copilotUpdating, setCopilotUpdating] = useState<boolean>(false);

    // Cleanup the Undo timer on unmount so a stale closure cannot fire
    // setState after teardown — strict-mode-safe.
    useEffect(() => {
        return () => {
            if (undoTimerRef.current !== null) {
                clearTimeout(undoTimerRef.current);
                undoTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        loadQuestions();
    }, []);

    const loadQuestions = async () => {
        try {
            setLoading(true);
            // Hydrate questions + risk-calculation mode in parallel so the
            // page lands fully ready in a single network round-trip pair.
            // Mode-fetch failure is non-fatal — we keep the toggle
            // disabled-with-fallback-default until the admin retries.
            const modePromise = screeningService.getRiskCalculationMode().catch((err: unknown) => {
                logger.warn('[ScreeningManager] Failed to hydrate risk-calculation mode', {
                    error: err instanceof Error ? err.message : String(err),
                });
                return null;
            });
            const [data, mode] = await Promise.all([
                screeningService.getAllQuestions(),
                modePromise,
            ]);
            setQuestions(data);
            if (mode !== null) setRiskMode(mode);
        } catch (error) {
            logger.error('[ScreeningManager] Load failure', error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Persist a flip of the platform-wide risk-calculation mode.
     * Optimistic UI: update local state first, then PUT; on failure roll
     * back and surface the error in the existing inline alert. Confirmation
     * uses the page's existing `setSuccess` banner — single canonical
     * feedback surface, mirrored across every other admin action on this
     * page.
     */
    const handleToggleRiskMode = async (nextEnabled: boolean): Promise<void> => {
        if (riskMode === null || riskModeUpdating) return;
        const previous: RiskCalculationMode = riskMode;
        const next: RiskCalculationMode = nextEnabled ? 'ai' : 'manual';
        if (next === previous) return;

        setRiskModeUpdating(true);
        setRiskMode(next);
        setGeneralError(null);
        setSuccess(null);
        try {
            const echoed = await screeningService.updateRiskCalculationMode(next);
            // Trust the server's echoed value (covers any normalisation).
            setRiskMode(echoed);
            const message: string = echoed === 'ai'
                ? 'Risk scoring switched to AI. Future patient screenings will be scored by Gemini, with graceful fallback to your configured weights if the AI service is unavailable.'
                : 'Risk scoring switched to configured weights. Future patient screenings will be scored using the per-question values below.';
            setSuccess(message);
            setTimeout(() => setSuccess(null), 5000);
        } catch (err: unknown) {
            setRiskMode(previous);
            const apiErr = err as { response?: { data?: { message?: string } } };
            const errorMessage: string = apiErr.response?.data?.message ?? 'Failed to update risk scoring mode';
            setGeneralError(errorMessage);
            logger.error('[ScreeningManager] Risk mode toggle failed', {
                attempted: next,
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setRiskModeUpdating(false);
        }
    };

    /**
     * Persist a flip of the Clinical Copilot kill switch. This is a
     * higher-impact toggle than the risk-mode one — disabling it
     * blocks EVERY doctor across the deployment from using the AI
     * chat / proactive insights / patient analysis. Enabling it
     * resumes billable Gemini calls per doctor interaction. Both
     * directions get an explicit confirmation dialog before the PUT.
     *
     * Note: optimistic UI is NOT done here because the live state
     * comes from `<ClinicalCopilotProvider>` (socket-fed). The PUT
     * succeeds → backend emits → provider receives → context
     * updates → this component re-renders. So we just kick off the
     * PUT and rely on the broadcast for the visual confirmation. On
     * failure, the broadcast never fires, the context stays put,
     * and we surface the error.
     */
    const handleToggleCopilot = async (nextEnabled: boolean): Promise<void> => {
        if (!copilotHydrated || copilotUpdating) return;
        if (nextEnabled === copilotEnabled) return;

        const confirmed = await confirm(
            nextEnabled
                ? {
                    title: 'Enable Clinical AI Copilot?',
                    message:
                        'Enabling this will resume Gemini API charges. Every doctor chat message, proactive-insight batch, and patient risk analysis will incur Gemini token costs. Continue?',
                    confirmText: 'Yes, enable copilot',
                    cancelText: 'Cancel',
                    type: 'warning',
                }
                : {
                    title: 'Disable Clinical AI Copilot?',
                    message:
                        'Disabling this will immediately block every doctor across the platform from using AI chat, proactive insights, and patient risk analysis. Existing chats will show a "managed by administrator" banner. No Gemini API charges will accrue while disabled. Continue?',
                    confirmText: 'Yes, disable copilot',
                    cancelText: 'Cancel',
                    type: 'warning',
                },
        );
        if (!confirmed) return;

        setCopilotUpdating(true);
        setGeneralError(null);
        setSuccess(null);
        try {
            await updateClinicalCopilotEnabled(nextEnabled);
            const message: string = nextEnabled
                ? 'Clinical Copilot enabled. Doctors can now use AI chat, proactive insights, and patient risk analysis. Every interaction will incur Gemini API charges.'
                : 'Clinical Copilot disabled. All doctor AI requests across the platform will be refused at the backend until you re-enable it. Zero Gemini API charges will accrue while disabled.';
            setSuccess(message);
            setTimeout(() => setSuccess(null), 6000);
        } catch (err: unknown) {
            const apiErr = err as { response?: { data?: { message?: string } } };
            const errorMessage: string = apiErr.response?.data?.message ?? 'Failed to update Clinical Copilot toggle';
            setGeneralError(errorMessage);
            logger.error('[ScreeningManager] Clinical Copilot toggle failed', {
                attempted: nextEnabled,
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setCopilotUpdating(false);
        }
    };

    const handleToggle = async (id: string, currentStatus: boolean) => {
        try {
            await screeningService.toggleQuestion(id, !currentStatus);
            setQuestions(prev => prev.map(q =>
                q.id === id ? { ...q, is_active: !currentStatus } : q
            ));
        } catch (error) {
            logger.error('[ScreeningManager] Toggle failure', error);
        }
    };

    const handleDelete = async (id: string, text: string) => {
        const confirmed = await confirm({
            title: 'Confirm Clinical Asset Purge',
            message: `Are you sure you want to permanently delete "${text || 'this question'}"? This action will remove the clinical signal from the triage engine.`,
            type: 'error',
            confirmText: 'Purge Question',
            cancelText: 'Cancel'
        });

        if (!confirmed) return;

        if (id.startsWith('temp-')) {
            setQuestions(prev => prev.filter(q => q.id !== id));
            setSuccess('Question deleted successfully!');
            setTimeout(() => setSuccess(null), 3000);
            return;
        }

        try {
            setSaving(true);
            setGeneralError(null);
            setSuccess(null);
            await screeningService.deleteQuestion(id);
            setQuestions(prev => prev.filter(q => q.id !== id));
            setSuccess('Question deleted successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (error) {
            logger.error('[ScreeningManager] Delete failure', error);
            setGeneralError('Failed to delete question');
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async (question: ScreeningQuestion) => {
        try {
            setSaving(true);
            setGeneralError(null);
            setSuccess(null);
            if (question.id.startsWith('temp-')) {
                const { id, ...rest } = question;
                const newQ = await screeningService.createQuestion(rest);
                setQuestions(prev => prev.map(q => q.id === id ? newQ : q));
            } else {
                await screeningService.updateQuestion(question.id, question);
            }
            setSuccess('Changes saved successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (error) {
            logger.error('[ScreeningManager] Save failure', error);
            setGeneralError('Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateLocal = (id: string, updates: Partial<ScreeningQuestion>) => {
        setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    const addNewQuestion = () => {
        const tempId = `temp-${Date.now()}`;
        const newQ: ScreeningQuestion = {
            id: tempId,
            category: 'triage',
            question_text: '',
            disease_tag: '',
            risk_weight: 1,
            is_active: true,
            sort_order: questions.length + 1
        };
        setQuestions([newQ, ...questions]);
    };

    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;

        const sourceIndex = result.source.index;
        const destinationIndex = result.destination.index;

        if (sourceIndex === destinationIndex) return;

        // Snapshot the previous order BEFORE the optimistic mutation. This is
        // what `handleUndoReorder` restores if the admin clicks Undo. Stored
        // as a lean { id, sort_order } projection — the question content
        // itself does not need to be re-uploaded since only ordering changed.
        const previousOrder: ReadonlyArray<{ id: string; sort_order: number }> = questions.map((q) => ({
            id: q.id,
            sort_order: q.sort_order,
        }));
        const movedQuestion = questions[sourceIndex];

        const updatedQuestions = Array.from(questions);
        const [reorderedItem] = updatedQuestions.splice(sourceIndex, 1);
        updatedQuestions.splice(destinationIndex, 0, reorderedItem);

        const finalQuestions = updatedQuestions.map((q, index) => ({
            ...q,
            sort_order: index + 1
        }));

        setQuestions(finalQuestions);

        try {
            setSaving(true);
            setGeneralError(null);
            setSuccess(null);

            const updates = finalQuestions.map(q => ({
                id: q.id,
                sort_order: q.sort_order
            }));

            await screeningService.reorderQuestions(updates);

            // Persistent confirmation with diff + Undo. Replaces the prior
            // 3-second auto-dismiss banner. Toast surface (system:success)
            // gives a global confirmation for any admin glancing at the
            // page; the inline panel below carries the actionable Undo.
            const undoState: ReorderUndoState = {
                previousOrder,
                movedQuestionText: movedQuestion.question_text || movedQuestion.disease_tag || 'Unnamed question',
                fromPosition: sourceIndex + 1,
                toPosition: destinationIndex + 1,
                expiresAt: Date.now() + UNDO_WINDOW_MS,
            };
            setReorderUndo(undoState);

            // Dispatch the global success toast through the symmetric
            // `system:success` channel wired in toast-context.tsx — admin
            // does not need the inline panel open to know the save landed.
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('system:success', {
                    detail: {
                        message: `Order saved · ${updates.length} questions reordered`,
                    },
                }));
            }

            // Auto-dismiss the Undo affordance after the window closes.
            if (undoTimerRef.current !== null) {
                clearTimeout(undoTimerRef.current);
            }
            undoTimerRef.current = setTimeout(() => {
                setReorderUndo(null);
                undoTimerRef.current = null;
            }, UNDO_WINDOW_MS);
        } catch (error: unknown) {
            logger.error('[ScreeningManager] Reorder failure', error instanceof Error ? error : new Error(String(error)));
            setGeneralError('Failed to save the new order. Restoring original order.');
            setQuestions(questions);
        } finally {
            setSaving(false);
        }
    };

    /**
     * Restore the order captured before the most recent drag. The previous
     * snapshot is sent through the same reorder endpoint so the audit trail
     * records a *second* reorder (not a special "undo" verb) — admins
     * downstream see exactly what happened in the audit log.
     *
     * Failure is loud here: an Undo that silently fails is worse than no
     * Undo at all because the admin has no signal that their intent did
     * not land.
     */
    const handleUndoReorder = async (): Promise<void> => {
        if (reorderUndo === null) return;
        const snapshot: ReadonlyArray<{ id: string; sort_order: number }> = reorderUndo.previousOrder;

        try {
            setSaving(true);
            setGeneralError(null);
            setSuccess(null);

            await screeningService.reorderQuestions([...snapshot]);

            // Reapply the snapshot to local state by re-projecting it onto
            // the current questions array. This avoids re-fetching from the
            // server while still keeping local state authoritative until
            // the next mutation.
            setQuestions((prev) => {
                const orderById = new Map(snapshot.map((row) => [row.id, row.sort_order]));
                const next = prev
                    .map((q) => {
                        const restored: number | undefined = orderById.get(q.id);
                        return restored === undefined ? q : { ...q, sort_order: restored };
                    })
                    .sort((a, b) => a.sort_order - b.sort_order);
                return next;
            });

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('system:success', {
                    detail: { message: 'Reorder undone — previous order restored.' },
                }));
            }
        } catch (error: unknown) {
            logger.error('[ScreeningManager] Undo reorder failure', error instanceof Error ? error : new Error(String(error)));
            setGeneralError('Could not undo the reorder. The previous order remains saved on the server only if the original save failed.');
        } finally {
            if (undoTimerRef.current !== null) {
                clearTimeout(undoTimerRef.current);
                undoTimerRef.current = null;
            }
            setReorderUndo(null);
            setSaving(false);
        }
    };

    const handleDismissUndo = (): void => {
        if (undoTimerRef.current !== null) {
            clearTimeout(undoTimerRef.current);
            undoTimerRef.current = null;
        }
        setReorderUndo(null);
    };

    const isBusy: boolean = loading || saving;
    const busyMessage: string = saving ? 'Saving Changes...' : 'Synchronizing Clinical Triage Data...';
    usePageLoader(isBusy, busyMessage);
    if (isBusy) return null;

    return (
        <TransitionItem>
            <div className="w-full space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="page-heading !mb-0 transition-all duration-300">Manage Screening</h1>
                        <p className="page-subheading italic">Configure clinical triage questions and risk weights for patient assessment.</p>
                    </div>
                    <Button
                        onClick={addNewQuestion}
                        className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:brightness-110 shadow-lg shadow-teal-900/20 border-0 h-11 px-6 rounded-[var(--card-radius)] font-bold transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Add Question
                    </Button>
                </div>

                <AnimatedAlert visible={generalError !== null}>
                    <Alert variant="destructive" className="rounded-[var(--card-radius)] border-rose-500/50 bg-rose-500/10 text-rose-500">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="font-medium">{generalError}</AlertDescription>
                        </div>
                    </Alert>
                </AnimatedAlert>

                <AnimatedAlert visible={success !== null}>
                    <Alert className="border-green-500/50 text-green-500 bg-green-500/10 rounded-[var(--card-radius)]">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertDescription className="font-medium">{success}</AlertDescription>
                        </div>
                    </Alert>
                </AnimatedAlert>

                <AnimatedAlert visible={reorderUndo !== null}>
                    {reorderUndo !== null ? (
                        <Alert className="border-primary/50 bg-primary/5 text-foreground rounded-[var(--card-radius)]">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                    <AlertDescription className="font-medium">
                                        <span className="font-semibold">Order saved.</span>{' '}
                                        <span className="text-muted-foreground">
                                            &ldquo;{reorderUndo.movedQuestionText}&rdquo; moved from position{' '}
                                            <span className="font-semibold text-foreground">{reorderUndo.fromPosition}</span>
                                            {' → '}
                                            <span className="font-semibold text-foreground">{reorderUndo.toPosition}</span>
                                            .
                                        </span>
                                    </AlertDescription>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => { void handleUndoReorder(); }}
                                        disabled={saving}
                                        className="h-8 px-3 text-xs font-bold uppercase tracking-wider border-primary/40 text-primary hover:bg-primary/10 rounded-[var(--card-radius)] flex items-center gap-1.5"
                                    >
                                        <Undo2 className="h-3.5 w-3.5" />
                                        Undo
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={handleDismissUndo}
                                        className="h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground rounded-[var(--card-radius)]"
                                    >
                                        Dismiss
                                    </Button>
                                </div>
                            </div>
                        </Alert>
                    ) : null}
                </AnimatedAlert>

                {/*
                  Clinical Copilot kill switch (AI cost-control).
                  Highest-impact AI toggle on the platform: blocks
                  every doctor's AI chat / proactive insights /
                  patient risk analysis at the backend when OFF.
                  Live state from `<ClinicalCopilotProvider>` — a
                  flip from any device propagates here via the
                  socket broadcast. Two-direction confirmation
                  dialog before any PUT — both enabling (resumes
                  Gemini billing) and disabling (blocks every
                  doctor) get an explicit "Yes" click.
                */}
                <Card className="p-6 border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/20 rounded-[var(--card-radius)]">
                    <div className="flex flex-col sm:flex-row items-start gap-4">
                        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 flex-shrink-0">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0 w-full">
                            <h2 className="text-base font-bold text-foreground mb-1">Clinical AI Copilot</h2>
                            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                                Master kill switch for the doctor-facing AI copilot. Affects chat, proactive
                                insights, and per-patient risk analysis. When disabled, every doctor across the
                                platform sees a "managed by administrator" banner — zero Gemini API charges
                                accrue.
                            </p>
                            <div className="flex items-center gap-3 flex-wrap">
                                <Switch
                                    checked={copilotEnabled}
                                    onCheckedChange={(checked: boolean) => { void handleToggleCopilot(checked); }}
                                    disabled={!copilotHydrated || copilotUpdating}
                                    aria-label="Enable or disable the Clinical AI Copilot platform-wide"
                                />
                                <span className="text-sm font-semibold text-foreground">
                                    {copilotEnabled ? 'Enabled — doctors can use AI features' : 'Disabled — all doctor AI requests are refused'}
                                </span>
                                {copilotUpdating && (
                                    <span className="text-xs text-muted-foreground italic">Saving...</span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                                {copilotEnabled
                                    ? 'Each doctor interaction with the AI copilot incurs Gemini API charges (model: gemini-2.5-pro). Rate-limited to 20 requests per minute per IP at the backend. Every change to this toggle is audit-logged with your user ID, prior + new value, and request metadata.'
                                    : 'All Clinical Copilot endpoints currently return HTTP 403 with code COPILOT_DISABLED. Doctors will see a banner explaining the feature is administratively disabled. Re-enabling resumes service instantly across every connected device.'}
                            </p>
                        </div>
                    </div>
                </Card>

                {/*
                  Platform-wide risk-calculation mode toggle. Determines
                  whether patient triage responses are scored by Gemini
                  AI ('ai') or by the admin-configured per-question
                  risk weights below ('manual'). The AI path always
                  falls back to the deterministic weighted sum if
                  Gemini is unreachable — patient flow is never
                  blocked. Hydration is delayed via riskMode === null
                  so the toggle does not flicker into the wrong
                  position before the GET resolves.
                */}
                <Card className="p-6 border-primary/20 bg-primary/5 rounded-[var(--card-radius)]">
                    <div className="flex flex-col sm:flex-row items-start gap-4">
                        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-primary/15 text-primary flex-shrink-0">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0 w-full">
                            <h2 className="text-base font-bold text-foreground mb-1">Risk Scoring Mode</h2>
                            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                                Choose how patient triage responses are converted into risk scores for clinical routing.
                            </p>
                            <div className="flex items-center gap-3 flex-wrap">
                                <Switch
                                    checked={riskMode === 'ai'}
                                    onCheckedChange={(checked: boolean) => { void handleToggleRiskMode(checked); }}
                                    disabled={riskMode === null || riskModeUpdating}
                                    aria-label="Use AI for clinical risk calculation"
                                />
                                <span className="text-sm font-semibold text-foreground">
                                    {riskMode === 'ai' ? 'AI-powered (Gemini)' : 'Configured weights'}
                                </span>
                                {riskModeUpdating && (
                                    <span className="text-xs text-muted-foreground italic">Saving...</span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                                {riskMode === 'ai' ? (
                                    'Patient triage responses are scored by Gemini AI based on clinical context, symptom co-occurrence, and disease patterns. The risk weights below remain advisory; the AI may upweight critical signals beyond their assigned values. If the AI service is unavailable, the system gracefully falls back to your configured weights.'
                                ) : (
                                    'Patient triage responses are scored using the risk weights configured for each question below. No external AI service is consulted, so no API costs are incurred.'
                                )}
                            </p>
                        </div>
                    </div>
                </Card>

                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="screening-questions">
                        {(provided) => (
                            <div 
                                className="grid grid-cols-1 gap-6"
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                            >
                                {questions.length === 0 ? (
                                    <div className="text-center p-16 bg-slate-50/50 rounded-[var(--card-radius)] border-2 border-dashed border-slate-200">
                                        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500 font-bold">No clinical questions configured.</p>
                                    </div>
                                ) : (
                                    questions.map((q, index) => (
                                        <Draggable key={q.id} draggableId={q.id} index={index}>
                                            {(provided) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className="w-full"
                                                >
                                                    <Card className="p-0 overflow-hidden border-border shadow-sm hover:shadow-md transition-all duration-300 rounded-[var(--card-radius)] bg-card flex">
                                                        <div 
                                                            {...provided.dragHandleProps}
                                                            className="w-10 bg-secondary/30 border-r border-border/50 flex flex-col justify-center items-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary transition-colors"
                                                        >
                                                            <GripVertical className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex flex-col md:flex-row flex-1">
                                                            <div className="flex-1 p-3 md:p-4 space-y-2 md:space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-3 md:gap-5">
                                                                        <div className="p-1.5 md:p-2 bg-primary/10 rounded-full text-primary">
                                                                            <Activity className="w-3.5 h-3.5" />
                                                                        </div>
                                                                        
                                                                        <span className="hidden sm:flex text-[10px] font-bold uppercase tracking-widest text-muted-foreground items-center gap-1 whitespace-nowrap">
                                                                            Category
                                                                            <span className="lowercase italic font-medium text-rose-600">(Mandatory)</span>
                                                                        </span>

                                                                        <DropdownMenu modal={false}>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <Button
                                                                                    variant="outline"
                                                                                    className="w-32 md:w-40 h-8 bg-secondary/50 border-primary/20 rounded-[var(--card-radius)] text-[11px] md:text-xs font-bold transition-all focus:ring-primary/20 text-foreground justify-between px-3 hover:bg-secondary hover:border-primary/40"
                                                                                >
                                                                                    {q.disease_tag || 'Select'}
                                                                                    <ChevronDown className="h-3 w-3 opacity-50" />
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent 
                                                                                className="w-32 md:w-40 rounded-[var(--card-radius)] border-border bg-popover shadow-2xl backdrop-blur-xl p-1"
                                                                            >
                                                                                <DropdownMenuItem
                                                                                    onSelect={() => handleUpdateLocal(q.id, { disease_tag: '' })}
                                                                                    className="text-[11px] md:text-xs font-bold py-2 px-3 rounded-[var(--card-radius)] cursor-pointer hover:bg-accent focus:bg-accent"
                                                                                >
                                                                                    Select
                                                                                </DropdownMenuItem>
                                                                                {CATEGORIES.map(cat => (
                                                                                    <DropdownMenuItem 
                                                                                        key={cat} 
                                                                                        onSelect={() => handleUpdateLocal(q.id, { disease_tag: cat })}
                                                                                        className="text-[11px] md:text-xs font-bold py-2 px-3 rounded-[var(--card-radius)] cursor-pointer hover:bg-accent focus:bg-accent"
                                                                                    >
                                                                                        {cat}
                                                                                    </DropdownMenuItem>
                                                                                ))}
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 md:gap-4">
                                                                        <span className="hidden sm:inline text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">Risk</span>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max="10"
                                                                            step="0.1"
                                                                            value={q.risk_weight}
                                                                            onChange={(e) => handleUpdateLocal(q.id, { risk_weight: parseFloat(e.target.value) || 0 })}
                                                                            className="w-20 md:w-24 h-8 text-center border border-border rounded-[var(--card-radius)] focus:border-primary/40 outline-none text-sm font-bold text-foreground bg-secondary/30 transition-all shadow-inner"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <input
                                                                    type="text"
                                                                    value={q.question_text}
                                                                    onChange={(e) => handleUpdateLocal(q.id, { question_text: e.target.value })}
                                                                    placeholder="Enter clinical question..."
                                                                    className="w-full text-xs md:text-sm font-medium text-foreground bg-secondary/10 border border-border rounded-[var(--card-radius)] focus:border-primary/40 outline-none placeholder:text-muted-foreground/50 transition-all shadow-inner px-3 md:px-4"
                                                                />
                                                            </div>

                                                            <div className="md:w-40 bg-secondary/20 p-3 md:p-4 flex flex-row md:flex-col justify-center items-center gap-4 border-t md:border-t-0 md:border-l border-border/50">
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <span className="text-[0.65rem] uppercase font-bold tracking-tighter text-muted-foreground">Status</span>
                                                                    <Switch
                                                                        checked={q.is_active}
                                                                        onCheckedChange={() => handleToggle(q.id, q.is_active)}
                                                                        className="data-[state=checked]:bg-primary scale-75 md:scale-90"
                                                                    />
                                                                </div>

                                                                <div className="flex flex-col gap-2 w-full items-center">
                                                                    <Button
                                                                        variant="outline"
                                                                        onClick={() => handleSave(q)}
                                                                        disabled={saving || !q.disease_tag || q.disease_tag === 'Select' || !q.question_text.trim()}
                                                                        className="w-full md:w-[110px] flex items-center justify-center gap-1.5 h-8 px-2 font-bold border-primary/70 text-foreground bg-primary/5 hover:bg-primary/10 hover:border-primary transition-all active:scale-95 text-[10px] uppercase tracking-wider shadow-sm rounded-[var(--card-radius)] disabled:opacity-20"
                                                                    >
                                                                        <Save className="w-3 h-3 text-primary" />
                                                                        Save
                                                                    </Button>
                                                                    <Button
                                                                        variant="default"
                                                                        onClick={() => handleDelete(q.id, q.question_text)}
                                                                        className="
                                                                            w-full md:w-[110px] flex items-center justify-center gap-1.5 h-8 px-2 font-medium shadow-lg shadow-rose-900/20
                                                                            bg-rose-600 text-white hover:bg-rose-700
                                                                            transition-all active:scale-95 text-[10px] uppercase tracking-wider
                                                                            rounded-[var(--card-radius)]
                                                                        "
                                                                    >
                                                                        <Trash2 className="w-3 h-3 text-white" />
                                                                        <span className="text-white">Delete</span>
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))
                                )}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </div>
        </TransitionItem>
    );
};
