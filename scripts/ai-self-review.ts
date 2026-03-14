import { run_safe_command } from './agent_watchdog';
import fs from 'fs';
import path from 'path';

const MEMORY_PATH = path.join(__dirname, '..', '.ai-system', 'memory.json');

function logToMemory(type: 'ci_failures' | 'test_failures' | 'lint_patterns' | 'resolved_issues', message: string) {
    if (!fs.existsSync(MEMORY_PATH)) return;
    try {
        const memory = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf-8'));
        if (!memory[type].includes(message)) {
            memory[type].push({
                timestamp: new Date().toISOString(),
                message
            });
            fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2));
        }
    } catch (e) {
        console.warn('⚠️ Failed to update AI memory:', e);
    }
}

async function runReview() {
    console.log('🔍 Initializing AI Architecture & Security Review...');

    try {
        // 1. Extract staged changes
        const diff = run_safe_command('git diff --cached') || '';

        if (!diff) {
            console.log('✅ No changes staged for review.');
            return;
        }

        console.log('\n--- TARGET DIFF EXTRACTED ---');
        // ... (rest of diff extraction)

        if (diff.includes('console.log')) {
            console.warn('⚠️ Pattern detected: console.log should be removed.');
            logToMemory('lint_patterns', 'Found console.log in committed code');
        }

        const THRESHOLD = 85;
        console.log('\n--- WAITING FOR AI QUALITY SCORE ---');
    } catch (error: any) {
        console.error(`❌ Review Engine Failure: ${error.message}`);
        logToMemory('ci_failures', `Review Engine Failure: ${error.message}`);
        process.exit(1);
    }
}

// Check if being run directly
if (require.main === module) {
    runReview();
}
