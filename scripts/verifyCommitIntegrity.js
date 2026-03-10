const { execSync } = require('child_process');

function runCommand(command, name) {
    console.log(`\n[INTEGRITY] Running ${name}...`);
    try {
        execSync(command, { stdio: 'inherit' });
        console.log(`[INTEGRITY] Γ£à ${name} PASSED.`);
        return true;
    } catch (error) {
        console.log(`[INTEGRITY] Γ¥î ${name} FAILED.`);
        return false;
    }
}

async function verifyIntegrity() {
    console.log('\n--- HAEMI LIFE COMMIT INTEGRITY CHECK ---');

    const lintPass = runCommand('npm run lint', 'Lint Check');
    const typePass = runCommand('npm run type-check', 'Type Check');
    const testPass = runCommand('npm run test:ci', 'Full Test Suite');

    if (!lintPass || !typePass || !testPass) {
        console.error('\n[FATAL] INTEGRITY VOID: One or more checks failed.');
        console.error('[ACTION] REVERTING LAST COMMIT TO PRESERVE MAIN STABILITY...');

        try {
            // Note: Only revert if we are in a post-commit context (HEAD is ahead of origin)
            // For manual verification, we just exit with 1.
            const status = execSync('git status -sb').toString();
            if (status.includes('[ahead')) {
                execSync('git reset --hard HEAD~1', { stdio: 'inherit' });
                console.log('\n[SUCCESS] ROLLBACK COMPLETE. Local branch is safe.');
            }
        } catch (revertError) {
            console.error('\n[ERROR] Rollback failed or not applicable.');
        }
        process.exit(1);
    }

    console.log('\n[FINAL] INTEGRITY 100% VERIFIED. Safe to push.');
    process.exit(0);
}

verifyIntegrity();
