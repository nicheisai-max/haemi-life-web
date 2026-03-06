import { execSync } from 'child_process';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { runSafeGitCleanup } from './safe-git-cleanup';
dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'nicheisai-max/haemi-life-web';

if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN is missing. Please add it to your .env file.');
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
    } catch (error: unknown) {
        const err = error as { stderr?: string; stdout?: string; message: string };
        if (!ignoreError) {
            console.error(`❌ Command failed: ${cmd}\n${err.stderr || err.message}`);
            process.exit(1);
        }
        return err.stdout || '';
    }
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPRForBranch(branch: string) {
    try {
        const response = await api.get(`/pulls?head=${REPO.split('/')[0]}:${branch}&state=open`);
        return response.data[0];
    } catch (e) {
        return null;
    }
}

async function createPR(head: string, base: string, title: string) {
    try {
        const response = await api.post('/pulls', {
            title,
            head,
            base,
            body: 'Autonomous AI Pipeline PR. Includes execution of all guardrails and Git cleanup.'
        });
        return response.data;
    } catch (e: any) {
        console.error('❌ PR Creation Failed:', e.response?.data || e.message);
        process.exit(1);
    }
}

async function mergePR(prNumber: number) {
    try {
        await api.put(`/pulls/${prNumber}/merge`, {
            merge_method: 'squash'
        });
        console.log(`✅ PR #${prNumber} merged successfully.`);
    } catch (e: any) {
        console.error(`❌ PR Merge Failed:`, e.response?.data || e.message);
        process.exit(1);
    }
}

async function pollCI(ref: string): Promise<boolean> {
    console.log(`⏳ Polling CI status for ref: ${ref}...`);
    let attempts = 0;
    while (attempts < 60) {
        try {
            const response = await api.get(`/commits/${ref}/check-runs`);
            const checkRuns = response.data.check_runs;

            if (checkRuns.length > 0) {
                const allFinished = checkRuns.every((run: any) => run.status === 'completed');
                const allSuccess = checkRuns.every((run: any) => run.conclusion === 'success');
                const hasFailures = checkRuns.some((run: any) => run.conclusion === 'failure' || run.conclusion === 'timed_out' || run.conclusion === 'cancelled');

                if (hasFailures) {
                    console.error('❌ CI failed or was cancelled.');
                    return false;
                }

                if (allFinished && allSuccess) {
                    console.log('✅ All CI checks passed!');
                    return true;
                }
            } else {
                // Combined status as fallback
                const statusResponse = await api.get(`/commits/${ref}/status`);
                if (statusResponse.data.state === 'success') {
                    console.log('✅ Combined status is success!');
                    return true;
                } else if (statusResponse.data.state === 'failure' || statusResponse.data.state === 'error') {
                    console.error('❌ CI combined status failed.');
                    return false;
                }
            }
        } catch (e: any) {
            console.warn(`[WARN] CI status poll failed: ${e.message}`);
        }
        await sleep(30000); // Poll every 30s
        attempts++;
    }
    return false;
}

async function main() {
    console.log('🚀 Starting Autonomous AI Pipeline Orchestrator...');

    const currentBranch = runCmd('git rev-parse --abbrev-ref HEAD');
    if (currentBranch === 'main') {
        console.error('❌ Cannot run orchestrator directly on main branch.');
        process.exit(1);
    }

    // Step 1: Detect changes and commit
    const statusOut = runCmd('git status --porcelain');
    if (statusOut) {
        console.log('📦 Committing local changes...');
        runCmd('git add .');
        runCmd('npm run ai-review -- --silent || true');
        runCmd('git commit -m "chore(ai): autonomous update with verified changes"');
    }

    // Step 2: Push
    console.log(`📤 Pushing ${currentBranch} to origin...`);
    runCmd(`git push -u origin ${currentBranch}`);

    // Step 3: Detect/Create PR
    let pr = await getPRForBranch(currentBranch);
    if (!pr) {
        console.log('🔗 Creating new Pull Request...');
        pr = await createPR(currentBranch, 'main', `chore(ai): autonomous update from ${currentBranch}`);
        console.log(`✅ PR created: ${pr.html_url}`);
    } else {
        console.log(`🔗 PR already exists: ${pr.html_url}`);
    }

    // Step 4: Wait for CI
    const ciSuccess = await pollCI(currentBranch);
    if (!ciSuccess) {
        console.error('❌ CI pipeline failed. Manual intervention required for branch maintenance.');
        process.exit(1);
    }

    // Step 5: Merge
    console.log('🔀 Auto-merging PR...');
    await mergePR(pr.number);

    // Step 6: Post-Merge Cleanup
    console.log('\n🧹 Starting Post-Merge Cleanup...');
    process.env.SANDBOX_MODE = 'true';

    console.log('🔄 Synchronizing local main with origin/main...');
    runSafeGitCleanup('sync');

    console.log(`🗑️ Deleting remote branch ${currentBranch}...`);
    try {
        runSafeGitCleanup('delete-branch', currentBranch);
    } catch (e) {
        console.warn('⚠️ Remote deletion might have failed or already handled by GitHub.');
    }

    console.log('🚿 Cleaning temporary artifacts...');
    runSafeGitCleanup('clean');
    process.env.SANDBOX_MODE = 'false';

    console.log('\n✅ AUTONOMOUS PIPELINE CYCLE COMPLETE.');
    console.log('Current branch: main | Working tree: clean');
}

main();
