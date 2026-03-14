import { run_safe_command } from './agent_watchdog';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 📦 AI CONTEXT SNAPSHOT SYSTEM
 * 
 * Provides a deterministic, machine-readable snapshot of the repository state.
 * Eliminates AI hallucinations by providing a ground truth before execution.
 */

interface Snapshot {
    branch: string;
    workingTreeClean: boolean;
    modifiedFiles: string[];
    stagedFiles: string[];
    lastCommit: string;
    availableScripts: string[];
}

function getSnapshot(): Snapshot {
    console.log('📦 Generating AI Context Snapshot...');

    const branch = run_safe_command('git rev-parse --abbrev-ref HEAD')?.trim() || 'unknown';
    const statusRaw = run_safe_command('git status --porcelain')?.trim() || '';
    const lastCommit = run_safe_command('git log -1 --oneline')?.trim() || 'unknown';
    
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const availableScripts = Object.keys(pkg.scripts || {});

    const lines = statusRaw.split('\n').filter(Boolean);
    const modifiedFiles: string[] = [];
    const stagedFiles: string[] = [];

    lines.forEach(line => {
        const x = line[0];
        const y = line[1];
        const file = line.slice(3).trim();

        if (x !== ' ' && x !== '?') stagedFiles.push(file);
        if (y !== ' ' && y !== '?') modifiedFiles.push(file);
        if (x === '?' && y === '?') modifiedFiles.push(file); // Untracked
    });

    return {
        branch,
        workingTreeClean: lines.length === 0,
        modifiedFiles,
        stagedFiles,
        lastCommit,
        availableScripts
    };
}

const snapshot = getSnapshot();
const snapshotPath = path.resolve(__dirname, '../.agent_context.json');

fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
console.log(`✅ Snapshot created: ${snapshotPath}`);
