import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { logger } from '../utils/logger';

export class ClinicalCopilotService {
    private model: GenerativeModel | null = null;
    private genAI: GoogleGenerativeAI | null = null;

    constructor() {
        // We no longer instantiate immediately to avoid "missing key" errors 
        // during module resolution/hoisting.
    }

    private initModel() {
        if (this.model) return;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            // Only log an error if we actually try to use the model and it's missing.
            throw new Error('MISSING_API_KEY');
        }

        if (!this.genAI) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }

        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }

    /**
     * Generates a clinical response based on the doctor's query and patient context.
     * @param query The doctor's question or command.
     * @param context Patient context (optional, but highly recommended for relevance).
     * @returns A string response from the AI.
     */
    async generateResponse(query: string, context?: Record<string, unknown>): Promise<string> {
        try {
            this.initModel();
        } catch (error: unknown) {
            logger.error('[ClinicalCopilot] FATAL: GEMINI_API_KEY is missing or init failed', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw new Error('SERVICE_UNAVAILABLE');
        }

        // Institutional Hardening: Prevent event loop stalling with a 15s timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI_TIMEOUT')), 15000).unref()
        );

        try {
            if (!this.model) throw new Error('SERVICE_UNAVAILABLE');

            const systemInstruction = `
                You are the 'Haemi Life Clinical Copilot', an advanced AI assistant for doctors in Botswana.
                
                ROLE & GUIDELINES:
                1.  **Professional Tone**: Use precise medical terminology. Be concise and authoritative.
                2.  **Safety First**: If a query is unsafe or outside clinical scope, professionally decline.
                3.  **Botswana Context**: Where applicable, reference Botswana treatment guidelines (e.g., HIV/TB protocols) or formulary availability.
                4.  **Format**: Use Markdown for readability (bolding key terms, lists for steps).
                
                CONTEXT:
                ${context ? JSON.stringify(context) : 'No specific patient context provided.'}
                
                QUERY:
                ${query}
            `;

            // Race the AI call against the timeout
            const result = await Promise.race([this.model.generateContent(systemInstruction), timeoutPromise]);

            // Type guard to handle GenerateContentResponse structure safely
            if (
                !result || 
                typeof result !== 'object' || 
                !('response' in result) || 
                typeof result.response !== 'object' || 
                result.response === null || 
                !('text' in result.response) || 
                typeof result.response.text !== 'function'
            ) {
                throw new Error('INVALID_AI_RESPONSE');
            }

            return result.response.text();

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage === 'AI_TIMEOUT') {
                logger.error('[ClinicalCopilot] Request timed out after 15s');
                throw new Error('SERVICE_UNAVAILABLE');
            }
            logger.error('[ClinicalCopilot] Error generating response:', { error: errorMessage });
            throw new Error('Failed to generate AI response. Please try again.');
        }
    }
}

export const clinicalCopilotService = new ClinicalCopilotService();
