import React, { useState, useEffect, useRef } from 'react';
import { Plus, Save, Trash2, AlertCircle, CheckCircle2, Activity, ChevronDown, GripVertical, Undo2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { logger } from '@/utils/logger';
import screeningService, { ScreeningQuestion } from '@/services/screening.service';
import { TransitionItem } from '@/components/layout/page-transition';
import { MedicalLoader } from '../../components/ui/medical-loader';
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
            const data = await screeningService.getAllQuestions();
            setQuestions(data);
        } catch (error) {
            logger.error('[ScreeningManager] Load failure', error);
        } finally {
            setLoading(false);
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

    if (loading || saving) {
        return <MedicalLoader variant="global" message={saving ? "Saving Changes..." : "Synchronizing Clinical Triage Data..."} />;
    }

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

                {generalError && (
                    <Alert variant="destructive" className="rounded-[var(--card-radius)] border-rose-500/50 bg-rose-500/10 text-rose-500">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="font-medium">{generalError}</AlertDescription>
                        </div>
                    </Alert>
                )}

                {success && (
                    <Alert className="border-green-500/50 text-green-500 bg-green-500/10 rounded-[var(--card-radius)]">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertDescription className="font-medium">{success}</AlertDescription>
                        </div>
                    </Alert>
                )}

                {reorderUndo && (
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
                )}

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
