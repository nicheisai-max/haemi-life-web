import { execSync } from 'child_process';

function runCmd(cmd: string): string {
    try {
        return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch (e: any) {
        return '';
    }
}

console.log('🧹 Starting Sandbox Lifecycle Cleanup...');

// 1. Fetch latest remote state
runCmd('git fetch origin --prune');

// 2. Get merged remote branches
const mergedBranches = runCmd('git branch -r --merged origin/main')
    .split('\n')
    .map(b => b.trim())
    .filter(b => b.includes('origin/ai/sandbox-'));

if (mergedBranches.length === 0) {
    console.log('✅ No merged sandbox branches found.');
    process.exit(0);
}

for (const remoteBranch of mergedBranches) {
    const branchName = remoteBranch.replace('origin/', '');
    console.log(`🗑️  Pruning merged remote sandbox: ${branchName}`);
    try {
        execSync(`git push origin --delete ${branchName}`, { stdio: 'inherit' });
        console.log(`✅ Deleted: ${branchName}`);
    } catch (e: any) {
        console.warn(`⚠️  Failed to delete ${branchName}: ${e.message}`);
    }
}

console.log('✨ Cleanup complete.');
