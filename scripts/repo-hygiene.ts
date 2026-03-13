import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 🧹 PROJECT HYGIENE GUARD (Google/Meta Grade)
 * 
 * This script ensures the repository is in a deterministic, clean state.
 * It is triggered during the 'npm run sync' lifecycle.
 */

const PROJECT_ROOT = path.resolve(__dirname, '..');

// --- 🔒 CONFIGURATION ---

const FILE_BLACKLIST = [
    'tmp/*',                              // All diagnostic scripts
    'logs/*.log',                         // Audit logs
    'repo-health.log',                    // CI strays
    'commit-lint.log',                    // CI strays
    'lint_output.txt',                    // CI strays
    '.ci-stats-bundle.json',              // CI assets
    'frontend/dev-crash.log',             // Crash reports
    'backend/logs/*.log',                 // Large backend logs
    'e2e/results.txt',                    // Test residues
    'e2e/test-results.txt',               // Test residues
    'e2e/playwright-report',              // Playwright reports
    'e2e/test-results',                   // Playwright screenshots/videos
];

const BRANCH_PATTERNS = [
    'ai/sandbox*',
    'ai-sandbox*',
];

// --- 🛠️ UTILITIES ---

function log(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') {
    const icons = { info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌' };
    console.log(`${icons[type]} ${message}`);
}

function run(command: string): string {
    try {
        return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
    } catch (err) {
        return '';
    }
}

// --- 🧹 CLEANUP LOGIC ---

async function purgeFiles() {
    log('Purging diagnostic residues and temporary artifacts...', 'info');
    
    for (const pattern of FILE_BLACKLIST) {
        const fullPath = path.join(PROJECT_ROOT, pattern);
        try {
            // Use shell for wildcard support (robustness)
            if (process.platform === 'win32') {
                run(`powershell -Command "Remove-Item -Path '${fullPath}' -Recurse -Force -ErrorAction SilentlyContinue"`);
            } else {
                run(`rm -rf ${fullPath}`);
            }
        } catch (err) {
            // Silently skip if file doesn't exist
        }
    }
    log('File system hygiene achieved.', 'success');
}

async function purgeBranches() {
    log('Pruning local merged and stale sandbox branches...', 'info');
    
    // 1. Ensure we are on main
    const currentBranch = run('git rev-parse --abbrev-ref HEAD');
    if (currentBranch !== 'main') {
        run('git checkout main');
    }

    // 2. Fetch and prune remote tracking
    run('git fetch origin --prune');

    // 3. Delete local branches matching patterns
    for (const pattern of BRANCH_PATTERNS) {
        const branches = run(`git branch --list "${pattern}"`).split('\n').map(b => b.trim()).filter(Boolean);
        for (const branch of branches) {
            // Remove the '*' if it's the current branch (though we checked)
            const branchName = branch.replace('*', '').trim();
            if (branchName) {
                run(`git branch -D ${branchName}`);
                log(`Deleted local branch: ${branchName}`, 'info');
            }
        }
    }
    log('Branch hygiene achieved.', 'success');
}

// --- 🚀 MAIN ---

async function startHygiene() {
    console.log('\n🛡️  HEAMI LIFE: Hermetic Lifecycle Guard');
    console.log('-----------------------------------------');
    
    try {
        await purgeFiles();
        await purgeBranches();
        
        console.log('-----------------------------------------');
        log('Repository is 100% Clean (Google/Meta Grade).', 'success');
    } catch (err) {
        log(`Hygiene failure: ${err}`, 'error');
        process.exit(1);
    }
}

startHygiene();
