const { execSync } = require('child_process');

function checkAndPruneStaleBranches() {
    console.log("Running enterprise stale branch check...");

    try {
        // 1. Fetch and prune from origin first to get accurate status
        execSync('git fetch --prune origin', { stdio: 'ignore' });

        // 2. Get all local branches
        const localBranchesOutput = execSync('git for-each-ref --format="%(refname:short)" refs/heads/', { encoding: 'utf8' });
        const localBranches = localBranchesOutput.split('\n').filter(Boolean).map(b => b.trim());

        // 3. Get all remote branches
        const remoteBranchesOutput = execSync('git for-each-ref --format="%(refname:short)" refs/remotes/origin/', { encoding: 'utf8' });
        const remoteBranches = remoteBranchesOutput.split('\n').filter(Boolean).map(b => b.replace('origin/', '').trim());

        // 4. Identify branches matching our target patterns (ai/sandbox-* and copilot-worktree-*)
        const targetPatterns = [/^ai\/sandbox-/, /^copilot-worktree-/];

        let prunedCount = 0;

        for (const localBranch of localBranches) {
            const isTargetBranch = targetPatterns.some(pattern => pattern.test(localBranch));

            if (isTargetBranch) {
                // If the branch exists locally but not on the remote, it's an orphan
                if (!remoteBranches.includes(localBranch)) {
                    console.log(`🧹 Stale sandbox branch detected: ${localBranch}. Remote counterpart is gone.`);
                    try {
                        // Force delete the local branch safely
                        execSync(`git branch -D ${localBranch}`, { stdio: 'ignore' });
                        console.log(`✅ Successfully pruned local orphan branch: ${localBranch}`);
                        prunedCount++;
                    } catch (e) {
                        console.error(`❌ Failed to prune branch ${localBranch}: ${e.message}`);
                    }
                }
            }
        }

        if (prunedCount === 0) {
            console.log("✅ No stale sandbox branches found locally.");
        }

    } catch (error) {
        console.error("❌ Error during git branch verification:", error.message);
    }
}

checkAndPruneStaleBranches();
