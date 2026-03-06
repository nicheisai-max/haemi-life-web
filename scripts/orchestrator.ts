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

async function createPR(head: string, base: string, title: string): Promise<void> {
    try {
        const payload = {
            title,
            head,
            base,
            body: 'Autonomous AI Pipeline PR. Includes execution of all guardrails and Git cleanup.'
        };
        const response = await axios.post(`https://api.github.com/repos/${REPO}/pulls`, payload, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });
        return response.data;
    } catch (e: unknown) {
        const err = e as { response?: { data?: unknown }; message: string };
        console.error('❌ PR Creation Failed:', err.response?.data || err.message);
        process.exit(1);
    }
}

async function pollPR(prNumber: number): Promise<boolean> {
    let attempts = 0;
    while (attempts < 60) {
        try {
            const response = await axios.get(`https://api.github.com/repos/${REPO}/pulls/${prNumber}`, {
                headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
            });
            const pr = response.data;
            if (pr.merged) {
                console.log('✅ PR has been successfully merged!');
                return true;
            }
            if (pr.state === 'closed' && !pr.merged) {
                console.error('❌ PR was closed without merging.');
                process.exit(1);
            }
        } catch (e: any) {
            console.warn(`[WARN] PR status poll failed: ${e.message}`);
        }
        console.log(`⏳ Waiting for PR #${prNumber} to merge (Attempt ${attempts + 1}/60)...`);
        await sleep(15000);
        attempts++;
    }
    console.error('❌ Timed out waiting for PR to merge.');
    process.exit(1);
}

async function main() {
    console.log('🚀 Starting Autonomous AI Local Git Cleanup Pipeline...');

    // Phase 9: Pre-push verification (resolve tracking before doing anything else if intended to run from scratch)
    const statusOut = runCmd('git status --porcelain');
    if (statusOut) {
        console.log('⚠️ Working tree is not clean. Attempting to add and commit remaining changes to safely integrate...');
        runCmd('git add .');

        console.log('\n🛡️ Triggering AI Code Quality Review...');
        runCmd('npm run ai-review'); // Phase 1-12 validation

        runCmd('git commit -m "chore(ai): prepare branch with architecture-validated changes"');
    }

    const currentBranch = runCmd('git rev-parse --abbrev-ref HEAD');
    if (currentBranch === 'main') {
        console.error('❌ Cannot run orchestrator directly on main branch. Must be an AI sandbox branch.');
        process.exit(1);
    }

    console.log(`📤 Pushing branch ${currentBranch} to origin...`);
    runCmd(`git push -u origin ${currentBranch}`);

    console.log(`\n🔗 Opening Pull Request for ${currentBranch}...`);
    const pr = await createPR(currentBranch, 'main', `chore(ai): automated pipeline orchestrator update from ${currentBranch}`);
    console.log(`✅ PR created: ${pr.html_url}`);

    console.log(`\n📡 Polling CI/CD completion and Auto-Merge state...`);
    await pollPR(pr.number);

    // Phase 2: Remote Branch Cleanup
    console.log(`\n🗑️ Executing Remote Branch Cleanup...`);
    process.env.SANDBOX_MODE = 'true';
    runSafeGitCleanup('delete-branch', currentBranch);

    // Phase 4 & 10: Automatic Local Repository Sync
    console.log(`\n🔄 Synchronizing local repository with origin/main...`);
    runSafeGitCleanup('sync');

    // Phase 5, 6, 7: Deep Artifact and Temporary File Purge
    console.log(`\n🚿 Executing Deep Working Tree Purge (git clean -fd)...`);
    runSafeGitCleanup('clean');
    process.env.SANDBOX_MODE = 'false';

    // Remove targeted temp artifacts forcefully if standard git clean missed them due to gitignore states
    const artifacts = ['frontend/bundle-report.html', 'scripts/temp-test.ts', 'scripts/create-pr.ts', 'scripts/ai-reviewer-temp.ts'];
    for (const file of artifacts) {
        const fullPath = path.join(__dirname, '..', file);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    }

    // Phase 11: Final Clean State Validation
    console.log(`\n🛡️ Final Verification...`);
    const finalBranch = runCmd('git rev-parse --abbrev-ref HEAD');
    if (finalBranch !== 'main') {
        console.error(`❌ Validation Failed: Local branch is ${finalBranch}, expected main.`);
        process.exit(1);
    }
    const finalStatus = runCmd('git status --porcelain');
    if (finalStatus.length > 0) {
        console.error(`❌ Validation Failed: Working tree is not completely clean.\n${finalStatus}`);
        process.exit(1);
    }

    console.log(`\n✅ PIPELINE SUCCESS. Local repository perfectly synchronized with origin/main.`);
}

main();
