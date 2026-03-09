/**
 * ENTERPRISE AI BRANCH PROTECTION GUARD — HAEMI LIFE
 * 
 * POLICY: CONTROLLED AI SANDBOX WORKFLOW
 * 
 * PROTECTED: main (Direct AI commits strictly forbidden)
 * ALLOWED: ai-sandbox/* (Standard AI development zone)
 * FORBIDDEN: feat/*, feature/*, temp/*, debug/*, test/*
 */

const { execSync } = require('child_process');

try {
    const branchName = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    const isMain = branchName === 'main';
    const isAISandbox = branchName.startsWith('ai-sandbox/');

    console.log(`🌿 Enterprise Branch Check: ${branchName}`);

    // RULE 1: PROTECT MAIN
    if (isMain) {
        console.error('\n─────────────────────────────────────────────────────────────────');
        console.error('🚨 ENTERPRISE SECURITY ALERT: MAIN BRANCH PROTECTED');
        console.error('─────────────────────────────────────────────────────────────────');
        console.error('AI development policy prohibits direct commits to the main branch.');
        console.error('All work must occur in an ai-sandbox/* branch.');
        console.error('─────────────────────────────────────────────────────────────────\n');
        process.exit(1);
    }

    // RULE 2: ENFORCE SANDBOX NAMING
    if (!isAISandbox) {
        console.error('\n─────────────────────────────────────────────────────────────────');
        console.error('🚨 BRANCH POLICY VIOLATION');
        console.error('─────────────────────────────────────────────────────────────────');
        console.error(`Branch '${branchName}' is forbidden.`);
        console.error("AI development is restricted to 'ai-sandbox/*' branches.");
        console.error('─────────────────────────────────────────────────────────────────\n');
        process.exit(1);
    }

    // Success: We are in a valid AI Sandbox
    process.exit(0);
} catch (error) {
    console.error('Guard Error:', error.message);
    process.exit(0); // Fail open only on critical infrastructure failure
}
