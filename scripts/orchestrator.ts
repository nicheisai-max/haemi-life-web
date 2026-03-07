import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

/**
 * ENTERPRISE INFRASTRUCTURE ORCHESTRATOR
 * 
 * Optimized for Node 22. Uses native fetch for zero-dependency execution.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'nicheisai-max/haemi-life-web';

if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN is missing.');
    process.exit(1);
}

// Global fetch configuration with headers
const githubHeaders = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Haemi-Life-Orchestrator'
};

function runCmd(cmd: string, ignoreError = false): string {
    try {
        console.log(`\n> ${cmd}`);
        return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch (error: any) {
        if (!ignoreError) {
            console.error(`❌ Command failed: ${cmd}\n${error.stderr || error.message}`);
            process.exit(1);
        }
        return error.stdout || '';
    }
}

/**
 * PHASE 1: Workspace Integrity
 */
function validateWorkspaceIntegrity() {
    console.log('🔍 Validating Workspace Integrity...');
    const status = runCmd('git status --porcelain', true);
    if (status.trim()) {
        console.error('❌ Workspace is dirty. Commit or stash changes before running orchestrator.');
        process.exit(1);
    }
    if (!fs.existsSync('node_modules')) {
        console.error('❌ node_modules missing. Run npm install first.');
        process.exit(1);
    }
    console.log('✅ Workspace integrity verified.');
}

function getSandboxBranches(): string[] {
    const local = runCmd('git branch --list "ai/sandbox-*"', true)
        .split('\n')
        .map(b => b.replace('*', '').trim())
        .filter(b => b.length > 0);
    return local;
}

function ensureSandboxBranch(taskNameArg?: string): string {
    const branch = runCmd('git rev-parse --abbrev-ref HEAD');
    if (branch === 'main') {
        const task = taskNameArg || 'update';
        const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const sandboxBranch = `ai/sandbox-${task}-${timestamp}`;
        console.log(`🛡️ Creating sandbox: ${sandboxBranch}`);
        runCmd(`git checkout -b ${sandboxBranch}`);
        return sandboxBranch;
    }
    return branch;
}

async function createPR(branch: string): Promise<number | null> {
    const taskName = branch.replace('ai/sandbox-', '');
    const prPayload = {
        title: `feat(ai): autonomous update for ${taskName}`,
        head: branch,
        base: 'main',
        body: 'Autonomous platform update. Validation handled via CI.'
    };

    console.log('🔗 Creating Pull Request...');
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO}/pulls`, {
            method: 'POST',
            headers: githubHeaders,
            body: JSON.stringify(prPayload)
        });

        const data: any = await response.json();

        if (response.ok) {
            console.log(`✅ PR created: ${data.html_url}`);
            return data.number;
        }

        console.warn('⚠️ PR creation failed (might already exist):', data.errors?.[0]?.message || data.message);

        // Fallback: search for existing PR
        const searchResp = await fetch(`https://api.github.com/repos/${REPO}/pulls?head=${REPO.split('/')[0]}:${branch}`, {
            headers: githubHeaders
        });
        const pulls: any = await searchResp.json();
        return pulls[0]?.number || null;
    } catch (e: any) {
        console.error('❌ Network error during PR creation:', e.message);
        return null;
    }
}

async function waitForCI(prNumber: number): Promise<boolean> {
    console.log(`⏳ Waiting for CI validation on PR #${prNumber}...`);
    const startTime = Date.now();
    const timeout = 10 * 60 * 1000; // 10 minutes

    while (Date.now() - startTime < timeout) {
        try {
            const prResp = await fetch(`https://api.github.com/repos/${REPO}/pulls/${prNumber}`, {
                headers: githubHeaders
            });
            const prData: any = await prResp.json();
            const headSha = prData.head.sha;

            // Try check-runs
            const checksResp = await fetch(`https://api.github.com/repos/${REPO}/commits/${headSha}/check-runs`, {
                headers: githubHeaders
            });
            const checksData: any = await checksResp.json();

            if (checksResp.ok) {
                const total = checksData.total_count;
                const completed = checksData.check_runs.filter((r: any) => r.status === 'completed');
                const success = checksData.check_runs.every((r: any) => r.conclusion === 'success' || r.conclusion === 'neutral' || r.conclusion === 'skipped');

                console.log(`   - Checks Status: ${completed.length}/${total} completed.`);
                if (total > 0 && completed.length === total && success) {
                    console.log('✅ All CI checks passed.');
                    return true;
                }
            }

            // Fallback: mergeable_state
            const mergeableState = prData.mergeable_state;
            console.log(`   - PR Mergeable State: ${mergeableState}`);
            if (mergeableState === 'clean') {
                console.log('✅ PR is clean and ready for merge.');
                return true;
            }

            if (prData.state === 'closed') {
                console.log('ℹ️ PR is already closed/merged.');
                return true;
            }

        } catch (e: any) {
            console.warn('⚠️ Error polling CI status:', e.message);
        }
        await new Promise(resolve => setTimeout(resolve, 30000));
    }
    console.error('❌ CI timeout.');
    return false;
}

async function getFailedJobLogs(prNumber: number): Promise<string> {
    console.log(`🔍 Fetching failed logs for PR #${prNumber}...`);
    try {
        const prResp = await fetch(`https://api.github.com/repos/${REPO}/pulls/${prNumber}`, {
            headers: githubHeaders
        });
        const prData: any = await prResp.json();
        const headSha = prData.head.sha;

        const checksResp = await fetch(`https://api.github.com/repos/${REPO}/commits/${headSha}/check-runs`, {
            headers: githubHeaders
        });
        const checksData: any = await checksResp.json();

        const failedRun = checksData.check_runs.find((r: any) => r.conclusion === 'failure');
        if (!failedRun) return 'No failed checks found.';

        return `Failed Run: ${failedRun.name}\nSummary: ${failedRun.output?.summary || 'No summary available.'}\nText: ${failedRun.output?.text || ''}`;
    } catch (e: any) {
        return `Error fetching logs: ${e.message}`;
    }
}

// mergePR removed in accordance with STRICT REPOSITORY GOVERNANCE

async function aggressiveCleanup() {
    console.log('\n🧹 Starting Aggressive Repository Cleanup...');

    // Switch to main
    runCmd('git checkout main', true);
    runCmd('git fetch origin --prune', true);
    runCmd('git pull origin main', true);

    // Delete local sandboxes
    const sandboxes = getSandboxBranches();
    for (const branch of sandboxes) {
        if (branch !== 'main') {
            console.log(`   - Deleting local: ${branch}`);
            runCmd(`git branch -D ${branch}`, true);
        }
    }

    // Delete remote sandboxes
    const remoteSandboxes = runCmd('git branch -r --list "origin/ai/sandbox-*"', true)
        .split('\n')
        .map(b => b.trim().replace('origin/', ''))
        .filter(b => b.length > 0);

    for (const branch of remoteSandboxes) {
        console.log(`   - Deleting remote: ${branch}`);
        runCmd(`git push origin --delete ${branch}`, true);
    }

    // Final Reset
    runCmd('git reset --hard origin/main', true);
    runCmd('git clean -fd', true);

    console.log('✅ Cleanup complete.');
}

function validateFinalState() {
    console.log('\n🏁 Final Repository State Validation...');
    const branch = runCmd('git rev-parse --abbrev-ref HEAD');
    const status = runCmd('git status --porcelain', true);
    const sandboxes = getSandboxBranches();

    if (branch !== 'main') throw new Error(`State Violation: Current branch is ${branch}, expected main.`);
    if (status.trim()) throw new Error(`State Violation: Working tree is not clean.`);
    if (sandboxes.length > 0) throw new Error(`State Violation: Sandbox branches still exist: ${sandboxes.join(', ')}`);

    console.log('🌟 REPOSITORY STATE ENFORCED: main branch clean and synchronized.');
}

// Task Planner Integration Imports
import { getNextTask, markTaskExecuting, markTaskComplete, markTaskFailed } from './task-planner';

async function main() {
    const pushMode = process.argv.includes('--push');
    const taskNameArg = process.argv[2];

    // 1. Workspace Integrity Check
    validateWorkspaceIntegrity();

    // 2. Task Selection
    let task = null;
    if (taskNameArg && !taskNameArg.startsWith('--')) {
        task = { id: 'manual', description: taskNameArg };
    } else {
        task = getNextTask();
    }

    if (!task) {
        console.log('✅ No tasks in queue. System idle.');
        return;
    }

    console.log(`🚀 Processing Task: [${task.id}] ${task.description}`);
    if (task.id !== 'manual') markTaskExecuting(task.id);

    const branch = ensureSandboxBranch(task.id === 'manual' ? task.description : task.id);

    if (pushMode) {
        try {
            // 1. Workspace Integrity Check (Strict)
            console.log('🔍 Enforcing strict workspace integrity...');
            const status = runCmd('git status --porcelain', true);
            if (status.trim()) {
                console.error('❌ Workspace is dirty. Commit or stash changes before pushing.');
                process.exit(1);
            }

            // 2. Deterministic Environment
            console.log('📦 Running deterministic dependency install...');
            runCmd('npm ci');

            // 3. Validation Suite
            console.log('🛡️  Running full validation suite...');

            console.log('   - Linting...');
            runCmd('npm run lint');

            console.log('   - Type Checking...');
            runCmd('npm run type-check');

            console.log('   - Building...');
            runCmd('npm run build');

            console.log('   - Backend Testing...');
            runCmd('npm run test:backend');

            // 4. Push Lifecycle
            console.log('📤 Validation successful. Pushing changes...');
            runCmd('git add .');
            runCmd(`git commit -m "feat(ci): workflow execution for task ${task.id}"`, true);
            runCmd(`git push -u origin ${branch}`);

            const prNumber = await createPR(branch);
            if (prNumber) {
                console.log(`\n🚀 Pull Request #${prNumber} is live.`);
                console.log('⏳ Automated AI flow ends here. Human review and merge required.');
                if (task.id !== 'manual') markTaskComplete(task.id);
            }
        } catch (error: any) {
            console.error(`❌ Task Execution Failed: ${error.message}`);
            if (task.id !== 'manual') markTaskFailed(task.id);
            process.exit(1);
        }
    } else {
        console.log('\n✅ Local changes ready. Run with --push to enforce full lifecycle.');
    }
}

main().catch(err => {
    console.error(`❌ CRITICAL FAILURE: ${err.message}`);
    process.exit(1);
});
