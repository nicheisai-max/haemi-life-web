import { run_safe_command } from './agent_watchdog';

/**
 * GIT PRUNE CHECK (Google/Meta Grade — TS)
 * 
 * Ensures the local repository is synchronized with origin.
 * Prunes stale tracking branches and local branches that no longer exist on remote.
 */

async function pruneRepo() {
    console.log('🛡️  Git Hygiene: Pruning stale branches...');
    
    try {
        // 1. Fetch and prune remote tracking
        run_safe_command('git fetch --prune origin');

        // 2. Get local branches
        const localBranchesOutput = run_safe_command('git for-each-ref --format="%(refname:short)" refs/heads/');
        const localBranches = (localBranchesOutput || '').split('\n').map(b => b.trim()).filter(Boolean);

        // 3. Get remote branches
        const remoteBranchesOutput = run_safe_command('git for-each-ref --format="%(refname:short)" refs/remotes/origin/');
        const remoteBranches = (remoteBranchesOutput || '').split('\n')
            .map(b => b.trim())
            .filter(Boolean)
            .map(b => b.replace('origin/', ''));

        // 4. Current branch
        const currentBranch = run_safe_command('git rev-parse --abbrev-ref HEAD')?.trim();

        // 5. Compare and Prune (Sandbox branches only)
        for (const localBranch of localBranches) {
            if (localBranch === 'main' || localBranch === currentBranch) continue;
            
            // Only target sandbox patterns
            if (localBranch.startsWith('ai/sandbox') || localBranch.startsWith('ai-sandbox')) {
                const remoteExists = remoteBranches.some((rb: string) => rb === localBranch || rb === `origin/${localBranch}`);
                
                if (!remoteExists) {
                    console.log(`🗑️  Pruning stale local sandbox: ${localBranch}`);
                    run_safe_command(`git branch -D ${localBranch}`);
                }
            }
        }

        console.log('✅ Git Hygiene: Branch state is clean.');
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Git Hygiene warning: ${message}`);
    }
}

pruneRepo();
