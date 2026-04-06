import { GoogleGenerativeAI, GenerativeModel, ChatSession, Content, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { logger } from '../utils/logger';

/**
 * 🩺 HAEMI LIFE | INSTITUTIONAL AI COPILOT SERVICE (GEMINI 2.5 PRO)
 * Standard: Google/Meta Grade TypeScript Execution (Strict-Type Consensus)
 * Architecture: Stateless model instantiation with stateful ChatSession orchestration.
 */
export class ClinicalCopilotService {
    private genAI: GoogleGenerativeAI | null = null;
    private model: GenerativeModel | null = null;

    constructor() {
        // Deferred initialization to respect environment hoisting during container boot
    }

    /**
     * Initializes the Generative AI client and model.
     * Logic: Strictly locks 'systemInstruction' to the model instance per 2.5 Pro standards.
     */
    private initModel(): void {
        const apiKey: string | undefined = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            logger.error('[ClinicalCopilot] SECURITY_ABORT: MISSING_API_KEY');
            throw new Error('MISSING_API_KEY');
        }

        if (!this.genAI) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }

        // Institutional Health & Safety Protocol (Standard filtering)
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        const systemInstructionText: string = `
            You are the 'Haemi Life Clinical Copilot', a specialized AI assistant for doctors in Botswana.
            
            INSTITUTIONAL PROTOCOLS:
            1. Professional medical tone (Google/Meta Grade). Concise and authoritative.
            2. Use Markdown for readability: bold keywords and use bulleted lists for diagnostics.
            3. Safety: Professionally decline non-medical or harmful queries.
            4. Botswana Context: Reference Botswana National Treatment Guidelines where relevant.
        `;

        /**
         * 🎯 ARCHITECT SYNC: Injecting systemInstruction at model level.
         * This eliminates the 20s hang caused by passing instructions to startChat.
         */
        this.model = this.genAI.getGenerativeModel({ 
            model: 'gemini-2.5-pro',
            safetySettings,
            systemInstruction: systemInstructionText
        });
        
        logger.info('[ClinicalCopilot] Gemini 2.5 Pro Model initialized with internal instructions.');
    }

    /**
     * Generates a clinical AI response using stateful ChatSession protocol.
     * @param message The user's current clinical query.
     * @param history Conversational history for stateful diagnostic context.
     * @returns A strictly typed clinical response string.
     */
    async generateResponse(message: string, history: Content[] = []): Promise<string> {
        try {
            // Re-initialize check (Idempotent)
            if (!this.model) {
                this.initModel();
            }
            
            if (!this.model) throw new Error('AI_INFRASTRUCTURE_UNAVAILABLE');

            /**
             * 🧬 CHAT SESSION ORCHESTRATION (Architect-Valid Protocol)
             * We strictly omit 'systemInstruction' here to prevent the SDK retry-loop timeout.
             */
            const chat: ChatSession = this.model.startChat({
                history: history
            });

            // Institutional Execution: 20s timeout protocol for complex reasoning
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('AI_INFERENCE_TIMEOUT')), 20000).unref()
            );

            // sendMessage performs the primary conversational turn
            const result = await Promise.race([
                chat.sendMessage(message), 
                timeoutPromise
            ]);

            // Final Response Validation & Extraction
            if (!result || !result.response) {
                logger.error('[ClinicalCopilot] NULL_RESPONSE_REJECTION');
                throw new Error('NO_AI_RESPONSE_OBJECT');
            }

            const textOutput: string = result.response.text();
            if (!textOutput) {
                logger.error('[ClinicalCopilot] EMPTY_SYNC_BUFFER');
                throw new Error('EMPTY_AI_RESPONSE_TEXT');
            }

            return textOutput;

        } catch (error: unknown) {
            const errorMessage: string = error instanceof Error ? error.message : String(error);
            const errorStatus: string = (error as { status?: string })?.status || '500';

            logger.error('[ClinicalCopilot] AI Inference Hard Crash:', { 
                error: errorMessage,
                status: errorStatus,
                model: 'gemini-2.5-pro'
            });
            
            // Standardized Error Propagation for Controller Layer
            throw new Error(`[GEMINI_2_PRO_ERROR] ${errorMessage}`);
        }
    }
}

export const clinicalCopilotService = new ClinicalCopilotService();
