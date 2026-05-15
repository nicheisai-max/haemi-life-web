import { GoogleGenerativeAI, GenerativeModel, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { logger } from '../utils/logger';
import { createSemaphore } from '../utils/semaphore';

/**
 * 🩺 HAEMI LIFE — TRIAGE AI SCORER (Gemini-backed)
 *
 * Server-side risk scorer for the patient pre-screening flow. Used by
 * `pre-screening.repository.saveResponses()` when the admin has flipped
 * the platform-wide `pre_screening_risk_calculation_mode` to `'ai'`.
 *
 * Architecture (institutional):
 *   - Single tightly-scoped responsibility: read the responses + their
 *     question definitions, ask Gemini for a normalised 0-1 risk score,
 *     return it. No persistence, no side effects beyond logging.
 *   - Defensive failure model: any error path (missing API key, network
 *     timeout, malformed JSON, rate limit, empty response) throws a
 *     typed `TriageAiScorerError`. The caller is the SOLE site that
 *     decides what to do with the failure — typically a graceful
 *     fallback to the deterministic weighted-sum scorer.
 *   - Stateless: model client is initialised lazily on first use and
 *     reused thereafter; no chat history, no per-call state.
 *
 * Why the strict failure surface:
 *   AI failure must NEVER halt a patient booking. The institutional
 *   contract is "graceful degradation" — if Gemini is unreachable or
 *   returns garbage, the patient flow continues with the
 *   admin-configured weights (Phase 2 fallback). This service exposes
 *   a typed error so the caller can audit-log the degradation distinct
 *   from a retryable transient.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`
 *   - All wire-boundary `unknown` from Gemini responses structurally
 *     narrowed (parsed JSON validated against expected shape)
 *   - All errors flow through project `logger`; zero `console.*`
 */

export interface TriageAiQuestionInput {
    /** Stable identifier for the question — used in audit logs only. */
    readonly id: string;
    /** Question text shown to the patient (English). */
    readonly text: string;
    /** Admin-configured advisory weight (0+). The AI MAY use this as a
     *  hint but is not bound by it. */
    readonly weight: number;
    /** Optional disease tag for clinical context (e.g. 'TB', 'HIV'). */
    readonly diseaseTag?: string;
}

export interface TriageAiResponseInput {
    /** Question id this response corresponds to. */
    readonly questionId: string;
    /** Patient's answer (true = yes, false = no). */
    readonly answer: boolean;
}

export interface TriageAiScore {
    /** Normalised risk score in [0, 1]. */
    readonly normalisedRisk: number;
    /** Aggregated raw weight (admin units) — for audit trail consistency
     *  with the deterministic scorer. */
    readonly aggregateWeight: number;
}

/**
 * Typed exception surface for AI scorer failures. The caller MUST catch
 * and decide on a fallback strategy. Exposing the cause lets the
 * fallback path log the specific degradation reason in audit metadata
 * (`reason: TriageAiScorerError.message`).
 */
export class TriageAiScorerError extends Error {
    public override readonly name: string = 'TriageAiScorerError';
    public readonly cause?: unknown;
    constructor(message: string, cause?: unknown) {
        super(message);
        this.cause = cause;
    }
}

const MODEL_NAME: string = 'gemini-2.5-pro';
const MAX_RESPONSE_TOKENS: number = 256;
/**
 * Per-call timeout for the Gemini round-trip. Set to 12s based on
 * observed p99 latency of gemini-2.5-pro under burst load (the prior
 * 8s ceiling fired frequent false-degradation events, polluting
 * `HEALTH_SCREENING_AI_DEGRADED` audit logs). The fallback path is
 * still available if Gemini genuinely hangs longer than 12s — the
 * deterministic scorer is computed by the caller in parallel.
 */
const RESPONSE_TIMEOUT_MS: number = 12_000;

/**
 * Bound concurrent Gemini calls from this process to prevent a burst
 * of patient submissions (e.g. a clinic-wide intake event) from
 * cascading into rate-limit errors and a thundering-herd of
 * graceful-degradations. 10 is a conservative ceiling that maps to
 * gemini-2.5-pro's published per-project RPM budget when the rest of
 * the app is also calling the API; the limit can be lifted by editing
 * this single constant. Waiters resolve FIFO so tail latency stays
 * predictable.
 */
const MAX_CONCURRENT_AI_CALLS: number = 10;
const aiCallLimiter = createSemaphore(MAX_CONCURRENT_AI_CALLS);

/** Internal singleton model holder. Lazy-initialised on first call so a
 *  cold start with `manual` mode never pays the SDK boot cost. */
let cachedModel: GenerativeModel | null = null;

/** Lazy model factory. Throws `TriageAiScorerError` if the API key is
 *  missing — same surface as a runtime AI failure so the caller's
 *  fallback path handles both cases identically. */
const getModel = (): GenerativeModel => {
    if (cachedModel !== null) return cachedModel;

    const apiKey: string | undefined = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.length === 0) {
        throw new TriageAiScorerError('GEMINI_API_KEY is not configured');
    }

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
        model: MODEL_NAME,
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        systemInstruction:
            'You are a clinical triage scoring assistant for Haemi Life, a healthcare platform serving '
            + 'Botswana and South Africa. Given a list of patient pre-screening questions with admin-assigned '
            + 'advisory weights and the patient\'s yes/no answers, output a single normalised risk score '
            + 'in [0, 1] reflecting the OVERALL clinical urgency. Consider symptom co-occurrence, disease '
            + 'patterns (TB, HIV, respiratory, chronic conditions), and the advisory weights as a HINT — '
            + 'you may upweight clinically critical signals beyond their assigned weight if symptom '
            + 'co-occurrence warrants. Return ONLY valid JSON with the exact shape: '
            + '{"normalisedRisk": <number 0-1>, "rationale": "<one short sentence>"}. No prose, no markdown.',
    });

    cachedModel = model;
    return model;
};

/** Builds the per-call user prompt — separate from the system instruction
 *  so the model boots once and the per-call payload stays compact. */
const buildPrompt = (
    questions: ReadonlyArray<TriageAiQuestionInput>,
    responses: ReadonlyArray<TriageAiResponseInput>
): string => {
    const lines: string[] = [];
    for (const r of responses) {
        const q = questions.find(question => question.id === r.questionId);
        if (q === undefined) continue; // Skip orphan responses defensively.
        const tagSuffix: string = q.diseaseTag !== undefined && q.diseaseTag.length > 0
            ? ` [${q.diseaseTag}]`
            : '';
        lines.push(`- "${q.text}"${tagSuffix} (weight: ${q.weight}) → ${r.answer ? 'YES' : 'NO'}`);
    }
    return `Patient pre-screening responses:\n${lines.join('\n')}\n\nReturn the JSON now.`;
};

/** Strips common LLM JSON wrapper artefacts (markdown fences, leading
 *  prose) and returns the inner JSON string. Throws if no JSON-like
 *  payload is present. */
const extractJsonPayload = (raw: string): string => {
    const trimmed: string = raw.trim();
    // Common Gemini wrapping: ```json\n{...}\n```
    const fenceMatch = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(trimmed);
    if (fenceMatch !== null && fenceMatch[1].length > 0) return fenceMatch[1];
    // Fallback: first `{` to last `}` (handles leading prose like "Here is:").
    const firstBrace: number = trimmed.indexOf('{');
    const lastBrace: number = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        return trimmed.slice(firstBrace, lastBrace + 1);
    }
    throw new TriageAiScorerError('Gemini response contains no JSON payload');
};

/** Type guard for the parsed Gemini response shape. */
const isScorePayload = (value: unknown): value is { normalisedRisk: number; rationale?: string } => {
    if (value === null || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    return typeof obj.normalisedRisk === 'number' && Number.isFinite(obj.normalisedRisk);
};

/**
 * Score a set of patient pre-screening responses using Gemini. Returns
 * the normalised risk in [0, 1]. Throws `TriageAiScorerError` on any
 * failure — caller handles fallback.
 */
export const scoreTriageWithAi = async (
    questions: ReadonlyArray<TriageAiQuestionInput>,
    responses: ReadonlyArray<TriageAiResponseInput>
): Promise<TriageAiScore> => {
    if (responses.length === 0) {
        return { normalisedRisk: 0, aggregateWeight: 0 };
    }

    const aggregateWeight: number = responses.reduce<number>((acc, r) => {
        const q = questions.find(question => question.id === r.questionId);
        if (q === undefined) return acc;
        return r.answer ? acc + q.weight : acc;
    }, 0);

    let model: GenerativeModel;
    try {
        model = getModel();
    } catch (err: unknown) {
        // Re-throw the typed error untouched — it already carries context.
        if (err instanceof TriageAiScorerError) throw err;
        throw new TriageAiScorerError('Failed to initialise Gemini client', err);
    }

    const prompt: string = buildPrompt(questions, responses);

    let rawResponseText: string;
    let timeoutHandle: NodeJS.Timeout | null = null;
    try {
        // Wrap the actual Gemini round-trip in a process-wide semaphore.
        // Concurrency above MAX_CONCURRENT_AI_CALLS queues here without
        // burning event-loop cycles; the timeout below applies to the
        // *generation* phase only — queue time is not penalised because
        // it represents controlled backpressure, not Gemini being slow.
        rawResponseText = await aiCallLimiter.run(async () => {
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new TriageAiScorerError('Gemini response exceeded timeout'));
                }, RESPONSE_TIMEOUT_MS);
            });
            const generation = await Promise.race([
                model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        maxOutputTokens: MAX_RESPONSE_TOKENS,
                        temperature: 0.2,
                        responseMimeType: 'application/json',
                    },
                }),
                timeoutPromise,
            ]);
            return generation.response.text();
        });
    } catch (err: unknown) {
        if (err instanceof TriageAiScorerError) throw err;
        const message: string = err instanceof Error ? err.message : String(err);
        throw new TriageAiScorerError(`Gemini generation failed: ${message}`, err);
    } finally {
        // Clear the timeout regardless of resolution path so the event
        // loop is not held open by a pending timer when generation
        // completes within the window.
        if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    }

    if (typeof rawResponseText !== 'string' || rawResponseText.length === 0) {
        throw new TriageAiScorerError('Gemini returned empty response');
    }

    let parsed: unknown;
    try {
        const jsonText: string = extractJsonPayload(rawResponseText);
        parsed = JSON.parse(jsonText);
    } catch (err: unknown) {
        if (err instanceof TriageAiScorerError) throw err;
        throw new TriageAiScorerError('Gemini response was not valid JSON', err);
    }

    if (!isScorePayload(parsed)) {
        throw new TriageAiScorerError('Gemini response missing or malformed `normalisedRisk` field');
    }

    // Clamp defensively — even if the model returns out-of-range, our
    // downstream high-risk threshold logic must operate on [0, 1].
    const normalisedRisk: number = Math.max(0, Math.min(1, parsed.normalisedRisk));

    logger.info('[TriageAiScorer] Gemini scored triage', {
        questionCount: questions.length,
        responseCount: responses.length,
        normalisedRisk,
        aggregateWeight,
        rationale: parsed.rationale ?? '(none)',
    });

    return { normalisedRisk, aggregateWeight };
};
