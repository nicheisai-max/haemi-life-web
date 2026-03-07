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
 * Ensures deterministic environment before execution.
 */
function validateWorkspaceIntegrity() {
    console.log('🔍 Validating Workspace Integrity...');

    // 1. Check clean tree
    const status = runCmd('git status --porcelain', true);
    if (status.trim()) {
        console.error('❌ Workspace is dirty. Commit or stash changes before running orchestrator.');
        process.exit(1);
    }

    // 2. Check node_modules
    if (!fs.existsSync('node_modules')) {
        console.error('❌ node_modules missing. Run npm install first.');
        process.exit(1);
    }

    // 3. Check node version
    const nodeVersion = process.version;
    if (!nodeVersion.startsWith('v20') && !nodeVersion.startsWith('v22')) {
        console.warn(`⚠️ Unexpected Node version: ${nodeVersion}. Enterprise standard is v20 or v22.`);
    }

    console.log('✅ Workspace integrity verified.');
}

function ensureSandboxBranch(taskNameArg?: string): string {
    const branch = runCmd('git rev-parse --abbrev-ref HEAD');
    if (branch === 'main') {
        const task = taskNameArg || 'stabilization';
        const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const sandboxBranch = `ai/sandbox-${task}-${timestamp}`;
        console.log(`🛡️ Creating sandbox: ${sandboxBranch}`);
        runCmd(`git checkout -b ${sandboxBranch}`);
        return sandboxBranch;
    }
    return branch;
}

async function createPR(branch: string) {
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
    } catch (e: any) {
        console.warn('⚠️ PR operation failed:', e.response?.data || e.message);
    }
}

async function main() {
    const pushMode = process.argv.includes('--push');
    const taskName = process.argv[2] || 'update';

    // Phase 1: Integrity Guard
    validateWorkspaceIntegrity();

    const branch = ensureSandboxBranch(taskName);

    if (pushMode) {
        console.log('📤 Pushing changes and creating PR...');
        runCmd('git add .');
        runCmd(`git commit -m "feat(ai): simplified platform stabilization for ${taskName}"`, true);
        runCmd(`git push -u origin ${branch}`);
        await createPR(branch);
    } else {
        console.log('\n✅ Local changes ready. Run with --push to finalize.');
    }
}

main().catch(err => {
    console.error('❌ Orchestrator failed:', err);
    process.exit(1);
});
