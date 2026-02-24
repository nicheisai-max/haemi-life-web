
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export class ClinicalCopilotService {
    private model;

    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            console.error('[ClinicalCopilot] FATAL: GEMINI_API_KEY is missing.');
        }
        this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }

    /**
     * Generates a clinical response based on the doctor's query and patient context.
     * @param query The doctor's question or command.
     * @param context Patient context (optional, but highly recommended for relevance).
     * @returns A string response from the AI.
     */
    async generateResponse(query: string, context?: any): Promise<string> {
        // Institutional Hardening: Prevent event loop stalling with a 15s timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI_TIMEOUT')), 15000)
        );

        try {
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
            const resultPromise = this.model.generateContent(systemInstruction);
            const result = await Promise.race([resultPromise, timeoutPromise]) as any;

            const response = await result.response;
            const text = response.text();

            return text;

        } catch (error: any) {
            if (error.message === 'AI_TIMEOUT') {
                console.error('[ClinicalCopilot] Request timed out after 15s');
                throw new Error('SERVICE_UNAVAILABLE');
            }
            console.error('[ClinicalCopilot] Error generating response:', error);
            throw new Error('Failed to generate AI response. Please try again.');
        }
    }
}

export const clinicalCopilotService = new ClinicalCopilotService();
