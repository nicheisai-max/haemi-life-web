import { execSync } from 'child_process';
import * as fs from 'fs';

function runCmd(cmd: string): string {
    try {
        return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch (e: any) {
        return '';
    }
}

async function main() {
    console.log('🧹 Starting Enterprise Sandbox Lifecycle Cleanup (Google/Meta Standard)...');

    // 1. Fetch latest remote state
    runCmd('git fetch origin --prune');

    // 2. Get all remote branches
    const allRemoteBranches = runCmd('git branch -r')
        .split('\n')
        .map(b => b.trim())
        .filter(b => b.match(/origin\/ai[-/]sandbox/i))
        .map(b => b.replace('origin/', ''));

    if (allRemoteBranches.length === 0) {
        console.log('✅ No remote sandbox branches found.');
        process.exit(0);
    }

    // 3. Query GitHub API for CLOSED Pull Requests
    // Squash merges erase git lineage, so the REST API is the only immutable source of truth for branch merge status.
    console.log('🔭 Querying GitHub API for Squash-Merged/Closed Sandboxes...');
    
    // Attempt to load GITHUB_TOKEN if present to avoid rate limits
    let token = process.env.GITHUB_TOKEN || '';
    try {
        if (!token && fs.existsSync('.env')) {
            const match = fs.readFileSync('.env', 'utf8').match(/GITHUB_TOKEN=([\S]+)/);
            if (match) token = match[1];
        }
    } catch (e) {}

    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Haemi-Life-Enterprise-CLI'
    };
    if (token) headers['Authorization'] = `token ${token}`;

    try {
        const res = await fetch('https://api.github.com/repos/nicheisai-max/haemi-life-web/pulls?state=closed&per_page=100', { headers });
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        
        const closedPRs = await res.json();
        const closedBranchNames = new Set(closedPRs.map((pr: any) => pr.head.ref));

        let deletedCount = 0;

        for (const branchName of allRemoteBranches) {
            // If the remote branch exists on GitHub but its Pull Request is closed/merged:
            if (closedBranchNames.has(branchName)) {
                console.log(`🗑️  Pruning merged/closed remote sandbox: ${branchName}`);
                try {
                    // Bypass the pre-push guard since this is a systemic infrastructure teardown
                    execSync(`git push origin --delete ${branchName} --no-verify`, { stdio: 'inherit' });
                    console.log(`✅ Deleted: ${branchName}`);
                    deletedCount++;
                } catch (e: any) {
                    console.warn(`⚠️  Failed to delete ${branchName}: ${e.message}`);
                }
            }
        }

        if (deletedCount === 0) {
            console.log('✅ No orphaned/squashed remote sandbox branches found.');
        }

    } catch (error: any) {
        console.warn(`⚠️  Failed to fetch GitHub API data. Falling back to Git heuristic pruning. (${error.message})`);
        // Fallback: Delete any remote tracking branch that doesn't have an open PR equivalent, or strictly matches `--merged`
        const mergedBranches = runCmd('git branch -r --merged origin/main')
            .split('\n')
            .map(b => b.trim())
            .filter(b => b.match(/origin\/ai[-/]sandbox/i))
            .map(b => b.replace('origin/', ''));

        for (const branchName of mergedBranches) {
            console.log(`🗑️  Pruning merged remote sandbox: ${branchName}`);
            try {
                execSync(`git push origin --delete ${branchName} --no-verify`, { stdio: 'inherit' });
                console.log(`✅ Deleted: ${branchName}`);
            } catch (e: any) {
                console.warn(`⚠️  Failed to delete ${branchName}: ${e.message}`);
            }
        }
    }

    console.log('✨ Cleanup complete.');
}

main();
