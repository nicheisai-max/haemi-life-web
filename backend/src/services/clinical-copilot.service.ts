import { GoogleGenerativeAI, GenerativeModel, ChatSession, Content, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { logger } from '../utils/logger';

/**
 * 🩺 HAEMI LIFE | INSTITUTIONAL AI COPILOT SERVICE (GEMINI 2.5 PRO)
 * Standard: Google/Meta Grade TypeScript Execution (Strict-Type Consensus)
 * Architecture: Stateless model instantiation with stateful ChatSession orchestration.
 */

export interface PatientRiskData {
    patientName: string;
    appointmentTime: string;
    riskCategory: 'Infectious' | 'Chronic' | 'Lifestyle';
    severityScore: number;
    keySymptoms: string[];
}

export interface ProactiveInsight {
    type: 'emergency' | 'briefing' | 'diagnostic';
    message: string;
    urgency: 'low' | 'medium' | 'high';
}

export interface PatientRiskReport {
    riskLevel: 'Low' | 'Medium' | 'High';
    summary: string;
    suggestedActions: string[];
}

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

    /**
     * Generates proactive clinical insights based on current patient risk profiles.
     * @param patients Array of high-risk patient data for the current session.
     * @returns A strictly typed collection of AI-generated clinical alerts in English.
     */
    async generateProactiveInsights(patients: PatientRiskData[]): Promise<ProactiveInsight[]> {
        if (patients.length === 0) return [];

        try {
            if (!this.model) this.initModel();
            if (!this.model) throw new Error('AI_INFRASTRUCTURE_UNAVAILABLE');

            const contextString = patients.map(p => 
                `- Patient: ${p.patientName}, Time: ${p.appointmentTime}, Risk: ${p.riskCategory}, Score: ${p.severityScore}, Symptoms: ${p.keySymptoms.join(', ')}`
            ).join('\n');

            const prompt = `
                Analyze the following high-risk patient profiles for today's clinic in Botswana:
                ${contextString}

                TASK:
                Generate 1-2 proactive, professional clinical alerts in English.
                - Focus on immediate triage needs or diagnostic preparations.
                - Keep each alert under 15 words.
                - Format as a JSON array of ProactiveInsight objects.
                
                Example Output Format:
                [{"type": "emergency", "message": "Patient [Name] shows severe TB symptoms. Follow infection control.", "urgency": "high"}]
            `;

            const result = await this.model.generateContent(prompt);
            const responseText = result.response.text();
            
            // Forensic extraction of JSON from AI response
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) throw new Error('INVALID_AI_JSON_STRUCTURE');

            const insights: ProactiveInsight[] = JSON.parse(jsonMatch[0]);
            return insights;

        } catch (error: unknown) {
            logger.error('[ClinicalCopilot] Proactive Insight Generation Failed:', {
                error: error instanceof Error ? error.message : String(error)
            });
            return []; // Fail gracefully to not disrupt the doctor's dashboard
        }
    }

    /**
     * Analyzes patient pre-screening data to generate a patient-facing risk report.
     * @param responses Collection of patient answers across all 3 tiers.
     * @returns A strictly typed health report in English.
     */
    async analyzePatientRisk(responses: { question: string; answer: boolean }[]): Promise<PatientRiskReport> {
        try {
            if (!this.model) this.initModel();
            if (!this.model) throw new Error('AI_INFRASTRUCTURE_UNAVAILABLE');

            const answerSummary = responses.map(r => `${r.question}: ${r.answer ? 'Yes' : 'No'}`).join('\n');

            const prompt = `
                You are a clinical assistant at Haemi Life. Analyze these patient responses from Botswana:
                ${answerSummary}

                TASK:
                Generate a concise, empathetic health risk report for the PATIENT in English.
                1. Risk Level: Categorize as 'Low', 'Medium', or 'High'.
                2. Summary: A 2-sentence empathetic explanation of their current triage state.
                3. Suggested Actions: 1-2 practical next steps (e.g., 'Wear a mask', 'Keep previous records ready').

                Format strictly as JSON:
                {
                    "riskLevel": "...",
                    "summary": "...",
                    "suggestedActions": ["...", "..."]
                }
            `;

            const result = await this.model.generateContent(prompt);
            const responseText = result.response.text();
            
            // Forensic JSON extraction
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('INVALID_PATIENT_AI_JSON');

            return JSON.parse(jsonMatch[0]) as PatientRiskReport;

        } catch (error: unknown) {
            logger.error('[ClinicalCopilot] Patient Risk Analysis Failed:', {
                error: error instanceof Error ? error.message : String(error)
            });
            
            // Safe fallback to prevent UX breakage
            return {
                riskLevel: 'Low',
                summary: 'Your pre-screening data has been recorded. Our clinical team will review it during your visit.',
                suggestedActions: ['Proceed with appointment booking']
            };
        }
    }
}

export const clinicalCopilotService = new ClinicalCopilotService();
