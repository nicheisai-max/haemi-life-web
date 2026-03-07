import { execSync } from 'child_process';

/**
 * PRE-PUSH VALIDATION SCRIPT
 * 
 * Sequentially executes critical quality checks.
 * Aborts the push process if any check fails.
 */

function runCheck(name: string, command: string) {
    console.log(`\n🚀 Running ${name}...`);
    try {
        execSync(command, { stdio: 'inherit' });
        console.log(`✅ ${name} passed.`);
    } catch (error) {
        console.error(`\n❌ ${name} failed. Aborting push.`);
        process.exit(1);
    }
}

console.log('🛡️  Starting Deterministic Pre-push Validation...');

runCheck('Linting', 'npm run lint');
runCheck('Type Check', 'npm run type-check');
runCheck('Production Build', 'npm run build');
runCheck('Unit & Integration Tests', 'npm run test:ci');

console.log('\n🌟 ALL CHECKS PASSED. Ready to push!');
process.exit(0);
