/**
 * ENTERPRISE BRANCH PROTECTION GUARD
 * 
 * Prevents accidental commits directly to the protected 'main' branch.
 * Enforces branch naming policy.
 */

const { execSync } = require('child_process');

try {
    const branchName = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    const isMain = branchName === 'main' || branchName === 'master';

    console.log(`🌿 Branch Check: ${branchName}`);

    if (isMain) {
        console.error('─────────────────────────────────────────────────────────────────');
        console.error('🚨 ENTERPRISE SECURITY ALERT: DIRECT COMMIT TO MAIN PROTECTED');
        console.error('─────────────────────────────────────────────────────────────────');
        console.error('Enterprise policy prohibits direct commits to the main branch.');
        console.error('Please create a feature/sandbox branch and use a Pull Request.');
        console.error('─────────────────────────────────────────────────────────────────');
        process.exit(1);
    }

    const allowedPatterns = [/^(ai|feature|bugfix|hotfix|security|refactor)\/.+/];
    const isAllowed = allowedPatterns.some(regex => regex.test(branchName));

    if (!isAllowed) {
        console.warn(`⚠️  NON-STANDARD BRANCH NAME: ${branchName}`);
        console.warn('Recommended naming: ai/*, feature/*, bugfix/*');
    }

    process.exit(0);
} catch (error) {
    console.error('Failed to verify branch name.');
    process.exit(0); // Fail open if git is missing, but log error
}
