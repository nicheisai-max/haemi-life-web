
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
        try {
            // Construct a system-like prompt for the AI
            // Note: gemini-pro doesn't strictly support 'system' role in the same way as GPT-4,
            // so we prepend instructions to the user prompt or use chat history.

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

            const result = await this.model.generateContent(systemInstruction);
            const response = await result.response;
            const text = response.text();

            return text;

        } catch (error) {
            console.error('[ClinicalCopilot] Error generating response:', error);
            throw new Error('Failed to generate AI response. Please try again.');
        }
    }
}

export const clinicalCopilotService = new ClinicalCopilotService();
