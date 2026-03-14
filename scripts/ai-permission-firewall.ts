import { run_safe_command } from './agent_watchdog';

const FORBIDDEN_COMMANDS = [
    'rm -rf .git',
    'rm -rf /',
    'git push --force origin main',
    'git push origin --delete main',
    'git branch -D main'
];

export function checkGitPermission(command: string) {
    // 1. Check for absolute forbidden commands
    const isForbidden = FORBIDDEN_COMMANDS.some(forbidden => command.includes(forbidden));
    if (isForbidden) {
        throw new Error(`🔥 AI FIREWALL BLOCK: Command matched forbidden pattern: ${command}`);
    }

    // 2. Main branch protections
    if (command.includes('git ') && command.includes('main')) {
        if (command.includes('--force') || command.includes('-f') || command.includes('rebase')) {
            throw new Error(`🔥 AI FIREWALL BLOCK: Destructive operation on main branch detected: ${command}`);
        }
    }

    // 3. Prevent bypass of Hooks via git reset or clean
    if (command.includes('git reset --hard') || command.includes('git clean -fd')) {
        if (process.env.SANDBOX_MODE !== 'true') {
            throw new Error(`🔥 AI FIREWALL BLOCK: Destructive operations require SANDBOX_MODE=true.`);
        }
    }

    return true;
}

export function enforceSandboxBranch() {
    try {
        const currentBranch = run_safe_command('git rev-parse --abbrev-ref HEAD')?.trim() || '';
        if (currentBranch === 'main') {
            if (process.env.SANDBOX_MODE === 'true') {
                return 'main'; // Authorized synchronization 
            }
            throw new Error(`🔥 AI FIREWALL BLOCK: Execution is explicitly forbidden on the main branch. Must use ai/* sandbox branch.`);
        }
        if (!currentBranch.startsWith('ai/')) {
            throw new Error(`🔥 AI FIREWALL BLOCK: Branch must match pattern "ai/*" for sandbox operations.`);
        }
        return currentBranch;
    } catch (error: unknown) {
        const err = error as Error;
        throw new Error(`🔥 AI FIREWALL BLOCK: Failed to verify branch.\n${err.message}`);
    }
}
