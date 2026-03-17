import { execSync } from 'child_process';
import * as path from 'path';

/**
 * 🧹 ANTI-HALLUCINATION SYNC GUARD (CI-ONLY PROTECTION)
 * 
 * PROTECTS REPOSITORY FROM LOCAL BLIND EXECUTION.
 * ENSURES CANONICAL STATE ONLY IN CI AFTER MERGE.
 */

function log(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') {
    const icons = { info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌' };
    console.log(`${icons[type]} ${message}`);
}

function run(command: string): string {
    try {
        return execSync(command, { stdio: 'pipe', encoding: 'utf8' }).trim();
    } catch {
        return '';
    }
}

/**
 * 🔒 LAYER 0: CI ENVIRONMENT LOCK
 */
function ensureCiContext() {
    if (process.env.CI !== 'true' || process.env.SYNC_ALLOWED !== 'true') {
        log('Sync blocked: Execution restricted to CI environment with SYNC_ALLOWED flag.', 'error');
        log('Local Action: Please manually run "git checkout main && git pull origin main".', 'info');
        process.exit(1);
    }
}

/**
 * 🔒 LAYER 1: REAL BRANCH VALIDATION
 */
function ensureMainBranch() {
    const branch = run('git rev-parse --abbrev-ref HEAD');
    if (branch !== 'main') {
        log(`Sync blocked: Not on main branch (Current: ${branch}).`, 'error');
        log('Action: Please manually switch to main and pull latest changes.', 'warn');
        process.exit(1);
    }
}

/**
 * 🔒 LAYER 2: WORKING TREE VALIDATION
 */
function ensureCleanWorkingTree() {
    const status = run('git status --porcelain');
    if (status !== '') {
        log('Sync blocked: Uncommitted changes detected.', 'error');
        console.log('\n--- GIT STATUS ---');
        console.log(status);
        console.log('------------------\n');
        log('Action: Commit or stash changes before syncing.', 'warn');
        process.exit(1);
    }
}

/**
 * 🧹 PROGRAMMATIC SANDBOX CLEANUP
 */
function pruneSandboxes() {
    log('Scanning for stale sandbox artifacts...', 'info');

    // Local branches
    const localOutput = run('git branch --list "ai-sandbox/*" "ai/sandbox*"');
    const localBranches = localOutput.split('\n').map(s => s.replace('*', '').trim()).filter(Boolean);
    for (const branch of localBranches) {
        log(`Pruning local sandbox: ${branch}`, 'info');
        execSync(`git branch -D ${branch}`, { stdio: 'inherit' });
    }

    // Note: Remote cleanup is handled by GitHub auto-delete-merged-branches
}

/**
 * 🚀 CONTROLLED EXECUTION
 */
function executeSync() {
    log('All safety layers passed. Executing canonical CI synchronization...', 'success');

    try {
        execSync('git fetch origin --prune', { stdio: 'inherit' });
        execSync('git reset --hard origin/main', { stdio: 'inherit' });
        
        const cleanCmd = [
            'git clean -fd',
            '-e ".env"',
            '-e ".env.local"',
            '-e ".gitignore"',
            '-e ".gitkeep"'
        ].join(' ');
        execSync(cleanCmd, { stdio: 'inherit' });

        execSync('git remote prune origin', { stdio: 'inherit' });
        pruneSandboxes();

        log('Repository synchronization complete.', 'success');
    } catch (err) {
        log(`Sync operation failed: ${err}`, 'error');
        process.exit(1);
    }
}

async function startHygiene() {
    console.log('\n🛡️  HEAMI LIFE: Hermetic Protection Lifecycle (CI-ONLY)');
    console.log('---------------------------------------------------');

    // 🔒 Gating Sequence
    ensureCiContext();
    ensureMainBranch();
    ensureCleanWorkingTree();

    // 🚀 Armed Execution
    executeSync();

    console.log('---------------------------------------------------\n');
}

startHygiene();