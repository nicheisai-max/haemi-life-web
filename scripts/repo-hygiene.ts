import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 🧹 PROJECT HYGIENE GUARD (GUARDED SYNC SYSTEM)
 * 
 * PROTECTS LOCAL DATA BY BLOCKING SYNC IF CHANGES EXIST.
 * ENSURES DETERMINISTIC CANONICAL STATE ON MAIN.
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
 * 🔒 PHASE 1: DATA PROTECTION
 */
function ensureCleanWorkingTree() {
    log('Verifying localized state for data safety...', 'info');
    const status = run('git status --porcelain');
    if (status !== '') {
        log('UNCOMMITTED CHANGES DETECTED. Sync blocked to protect local work.', 'error');
        console.log('\n--- GIT STATUS ---');
        console.log(status);
        console.log('------------------\n');
        log('Please commit or stash your changes before running sync.', 'info');
        process.exit(1);
    }
}

/**
 * 🔒 PHASE 2: BRANCH CONTROL
 */
function ensureBranchSafety() {
    const branch = run('git rev-parse --abbrev-ref HEAD');
    if (branch.startsWith('ai-sandbox/') || branch.startsWith('ai/sandbox')) {
        log(`Detected Sandbox Branch: ${branch}. Safe-switching to main (NO RESET)...`, 'info');
        try {
            execSync('git switch main', { stdio: 'inherit' });
        } catch (err) {
            log('Safe switch failed. Manual intervention required.', 'error');
            process.exit(1);
        }
    }
}

/**
 * 🔒 PHASE 3: GUARDED SYNC EXECUTION (LOCKED BY SAFETY GATES)
 */
function runGuardedSync() {
    const branch = run('git rev-parse --abbrev-ref HEAD');
    const status = run('git status --porcelain');

    if (branch === 'main' && status === '') {
        log('Hermetic environment confirmed. Executing canonical sync...', 'info');
        
        try {
            // CANONICAL SYNC SEQUENCE
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

            // Prune local sandboxes
            const sandboxOutput = run('git branch --list "ai-sandbox/*" "ai/sandbox*"');
            const sandboxes = sandboxOutput.split('\n').map(s => s.replace('*', '').trim()).filter(Boolean);
            
            for (const sb of sandboxes) {
                log(`Pruning stale repository artifact: ${sb}`, 'info');
                execSync(`git branch -D ${sb}`, { stdio: 'inherit' });
            }

            log('Repository synchronization complete.', 'success');
        } catch (err) {
            log(`Sync operation failed: ${err}`, 'error');
            process.exit(1);
        }
    } else {
        log('Sync prerequisites not met. Execution blocked.', 'error');
        process.exit(1);
    }
}

async function startHygiene() {
    console.log('\n🛡️  HEAMI LIFE: Guarded Lifecycle Integration');
    console.log('---------------------------------------------------');

    // 1. Mandatory Safety Gates
    ensureCleanWorkingTree();
    ensureBranchSafety();

    const currentBranch = run('git rev-parse --abbrev-ref HEAD');
    if (currentBranch !== 'main') {
        log('Terminal safety guard: Sync destination must be main.', 'error');
        process.exit(1);
    }

    log('Safety guards passed. Guarded Sync System is ARMED.', 'success');
    log('To execute sync, ensure working tree is clean and destination is main.', 'info');
    
    // NOTE: runGuardedSync() is available but not auto-triggered in this audit phase.
    log('Static integration complete. NO DESTRUCTIVE COMMANDS EXECUTED.', 'success');
    console.log('---------------------------------------------------\n');
}

startHygiene();