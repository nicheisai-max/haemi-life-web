/**
 * ENTERPRISE AI REVIEW PROMPTS
 * 
 * Defined reasoning templates for cross-referencing code against
 * Google, Meta, Stripe, and Netflix engineering standards.
 */

export const REVIEW_CATEGORIES = {
    ARCHITECTURE: "Code Structure, Component Design, Modularity",
    PERFORMANCE: "Rendering Efficiency, Complexity, Resource Usage",
    SECURITY: "SQL Injection, Exposed Secrets, Data Validation",
    MAINTAINABILITY: "Readability, Error Handling, API Resilience"
};

export const ENTERPRISE_REASONING_PROMPT = `
Evaluate the provided code diff against professional-grade engineering standards used by companies such as Google, Meta, Stripe, or Netflix.

CRITICAL FILTERS:
1. Would this code be acceptable in a high-scale production system?
2. Are there any temporary hacks, duplicate logic, or hardcoded values?
3. Does Frontend code follow React best practices (hooks, deps, re-renders)?
4. Does Backend code separate concerns (Controller/Service) and validate data?
5. Is the design the simplest and most scalable solution for the problem?

REASONING PASS 1: Detect Anti-Patterns.
REASONING PASS 2: Suggest Architectural Improvements.
REASONING PASS 3: Performance & Security Audit.

OUTPUT FORMAT (JSON):
{
    "scores": {
        "architecture": number (0-100),
        "performance": number (0-100),
        "security": number (0-100),
        "maintainability": number (0-100)
    },
    "violations": string[],
    "suggestions": string[],
    "must_refactor": boolean,
    "confidence_report": string
}
`;

export const COMMIT_MESSAGE_TEMPLATE = `
[type](scope): [description]

ARCHITECTURE:
- [key decisions]
- [modularity notes]

PERFORMANCE:
- [optimization summary]

CONFIDENCE: [score]
`;
