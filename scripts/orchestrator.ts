import { execSync } from 'child_process';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'nicheisai-max/haemi-life-web';

if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN is missing.');
    process.exit(1);
}

const api = axios.create({
    baseURL: `https://api.github.com/repos/${REPO}`,
    headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json'
    }
});

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
        const response = await api.post('/pulls', prPayload);
        console.log(`✅ PR created: ${response.data.html_url}`);
        return response.data.number;
    } catch (e: any) {
        console.warn('⚠️ PR creation failed (might already exist):', e.response?.data?.errors?.[0]?.message || e.message);
        const pulls = await api.get('/pulls', { params: { head: `${REPO.split('/')[0]}:${branch}` } });
        return pulls.data[0]?.number || null;
    }
}

async function waitForCI(prNumber: number): Promise<boolean> {
    console.log(`⏳ Waiting for CI validation on PR #${prNumber}...`);
    const startTime = Date.now();
    const timeout = 10 * 60 * 1000; // 10 minutes

    while (Date.now() - startTime < timeout) {
        try {
            const pr = await api.get(`/pulls/${prNumber}`);
            const headSha = pr.data.head.sha;

            // Try check-runs first
            try {
                const checks = await api.get(`/commits/${headSha}/check-runs`);
                const total = checks.data.total_count;
                const completed = checks.data.check_runs.filter((r: any) => r.status === 'completed');
                const success = checks.data.check_runs.every((r: any) => r.conclusion === 'success' || r.conclusion === 'neutral' || r.conclusion === 'skipped');

                console.log(`   - Checks Status: ${completed.length}/${total} completed.`);
                if (total > 0 && completed.length === total && success) {
                    console.log('✅ All CI checks passed.');
                    return true;
                }
            } catch (e: any) {
                console.warn('   - Check runs API restricted. Checking PR mergeability...');
            }

            // Fallback: Check mergeable_state
            // 'clean' means it's ready to merge and passes all checks.
            const mergeableState = pr.data.mergeable_state;
            console.log(`   - PR Mergeable State: ${mergeableState}`);
            if (mergeableState === 'clean') {
                console.log('✅ PR is clean and ready for merge.');
                return true;
            }

            if (pr.data.state === 'closed') {
                console.log('ℹ️ PR is already closed/merged.');
                return true;
            }

        } catch (e: any) {
            console.warn('⚠️ Error polling CI status:', e.message);
        }
        await new Promise(resolve => setTimeout(resolve, 30000)); // Poll every 30s
    }
    console.error('❌ CI timeout.');
    return false;
}

async function getFailedJobLogs(prNumber: number): Promise<string> {
    console.log(`🔍 Fetching failed logs for PR #${prNumber}...`);
    try {
        const pr = await api.get(`/pulls/${prNumber}`);
        const headSha = pr.data.head.sha;
        const checks = await api.get(`/commits/${headSha}/check-runs`);

        const failedRun = checks.data.check_runs.find((r: any) => r.conclusion === 'failure');
        if (!failedRun) return 'No failed checks found.';

        // In a real scenario, we'd fetch the raw logs. 
        // For this platform demonstration, we use the check run output summary.
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

async function main() {
    const pushMode = process.argv.includes('--push');
    const taskName = process.argv[2] || 'update';

    validateWorkspaceIntegrity();
    const branch = ensureSandboxBranch(taskName);

    if (pushMode) {
        console.log('🛡️ Running mandatory prepush-check...');
        runCmd('npm run prepush-check');

        console.log('📤 Pushing changes to sandbox...');
        runCmd('git add .');
        runCmd(`git commit -m "feat(ci): stabilization and framework improvements for ${taskName}"`, true);
        runCmd(`git push -u origin ${branch}`); // Force push removed per Governance rules

        const prNumber = await createPR(branch);
        if (prNumber) {
            console.log(`\n🚀 Pull Request #${prNumber} is live.`);
            console.log('⏳ Automated AI flow ends here. Human review and merge required.');
            console.log('🔍 GitHub Actions will now validate the PR.');
        }
    } else {
        console.log('\n✅ Local changes ready. Run with --push to enforce full lifecycle.');
    }
}

main().catch(err => {
    console.error(`❌ CRITICAL FAILURE: ${err.message}`);
    process.exit(1);
});
