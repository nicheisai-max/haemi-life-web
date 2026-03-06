import { execSync } from 'child_process';
import { checkGitPermission, enforceSandboxBranch } from './ai-permission-firewall';
import fs from 'fs';
import path from 'path';

export function runSafeGitCleanup(action: 'reset' | 'clean' | 'force-push' | 'sync' | 'delete-branch', targetBranch?: string) {
    if (process.env.SANDBOX_MODE !== 'true') {
        throw new Error('🔥 SECURITY BLOCK: safe-git-cleanup requires SANDBOX_MODE=true');
    }

    const currentBranch = enforceSandboxBranch(); // Will crash if not on ai/*

    if (action === 'delete-branch' && targetBranch && !targetBranch.startsWith('ai/')) {
        throw new Error('🔥 SECURITY BLOCK: Can only delete ai/* sandbox branches.');
    }

    if (action === 'force-push' && targetBranch === 'main') {
        throw new Error('🔥 SECURITY BLOCK: Cannot force push main branch.');
    }

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] BRANCH: ${currentBranch} | ACTION: ${action}\n`;
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    fs.appendFileSync(path.join(logDir, 'git-security-audit.log'), logEntry);

    try {
        if (action === 'reset') {
            const cmd = 'git reset --hard origin/main';
            checkGitPermission(cmd);
            console.log('🔄 Executing Safe Reset...');
            execSync(cmd, { stdio: 'inherit' });
        } else if (action === 'clean') {
            const cmd = 'git clean -fd';
            checkGitPermission(cmd);
            console.log('🧹 Executing Safe Clean...');
            execSync(cmd, { stdio: 'inherit' });
        } else if (action === 'force-push') {
            const cmd = `git push --force origin ${currentBranch}`;
            checkGitPermission(cmd);
            console.log('🚀 Executing Safe Force Push...');
            execSync(cmd, { stdio: 'inherit' });
        } else if (action === 'sync') {
            console.log('🔄 Executing Safe Local Sync...');
            execSync('git checkout main', { stdio: 'inherit' });
            execSync('git fetch origin', { stdio: 'inherit' });
            execSync('git reset --hard origin/main', { stdio: 'inherit' });
        } else if (action === 'delete-branch') {
            console.log(`🗑️ Executing Safe Branch Deletion for ${targetBranch}...`);
            const cmdRemote = `git push origin --delete ${targetBranch}`;
            checkGitPermission(cmdRemote);
            try { execSync(cmdRemote, { stdio: 'inherit' }); } catch (e) { console.log('Remote deletion skipped.'); }
            try { execSync(`git branch -D ${targetBranch}`, { stdio: 'inherit' }); } catch (e) { console.log('Local deletion skipped.'); }
        }
    } catch (error: unknown) {
        const err = error as Error;
        console.error(`❌ Safe Git Command Failed: ${err.message}`);
        process.exit(1);
    }
}
