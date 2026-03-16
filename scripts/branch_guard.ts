import { run_safe_command } from './agent_watchdog';

/**
 * ENTERPRISE AI BRANCH PROTECTION GUARD — HAEMI LIFE (TS)
 * 
 * POLICY: CONTROLLED AI SANDBOX WORKFLOW
 * 
 * PROTECTED: main (Direct AI commits strictly forbidden)
 * ALLOWED: ai-sandbox/* (Standard AI development zone)
 * FORBIDDEN: Any other branch naming convention
 */

const isCommit = process.argv.includes('--commit');
const isRevert = process.argv.includes('--revert');

function verifyBranch() {
    try {
        const branchName = run_safe_command('git rev-parse --abbrev-ref HEAD')?.trim();
        if (!branchName) {
            process.exit(0);
        }
        
        const isMain = branchName === 'main';
        const isAISandbox = branchName.startsWith('ai-sandbox') || branchName.startsWith('ai/sandbox');

        console.log(`🌿 Enterprise Branch Check: ${branchName} (Mode: ${isCommit ? 'COMMIT' : isRevert ? 'REVERT' : 'TRANSIT'})`);

        // RULE 1: PROTECT MAIN FROM COMMITS
        if (isMain && isCommit) {
            console.error('\n─────────────────────────────────────────────────────────────────');
            console.error('🚨 ENTERPRISE SECURITY ALERT: MAIN BRANCH PROTECTED');
            console.error('─────────────────────────────────────────────────────────────────');
            console.error('AI development policy prohibits direct commits to the main branch.');
            console.error('All work must occur in an ai-sandbox/* branch.');
            console.error('─────────────────────────────────────────────────────────────────\n');
            process.exit(1);
        }

        // RULE 2: ALLOW MAIN FOR TRANSIT / CHECKOUT
        if (isMain && !isCommit) {
            process.exit(0);
        }

        // RULE 3: ENFORCE SANDBOX NAMING FOR ALL NON-MAIN BRANCHES
        if (!isAISandbox) {
            console.error('\n─────────────────────────────────────────────────────────────────');
            console.error('🚨 BRANCH POLICY VIOLATION');
            console.error('─────────────────────────────────────────────────────────────────');
            console.error(`Branch '${branchName}' is forbidden.`);
            console.error("AI development is restricted to 'ai-sandbox/*' branches.");
            console.error('─────────────────────────────────────────────────────────────────\n');

            if (isRevert) {
                console.log('🔄 Reverting to main...');
                run_safe_command('git fetch origin --prune');
                run_safe_command('git reset --hard origin/main');
            }

            process.exit(1);
        }

        // Success: Inside valid AI Sandbox
        process.exit(0);
    } catch (error: any) {
        console.error('Guard Infrastructure Error:', error.message);
        process.exit(0);
    }
}

verifyBranch();
