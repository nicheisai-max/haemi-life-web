import { run_safe_command } from './agent_watchdog';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 📸 AGENT CONTEXT SNAPSHOT
 * 
 * Captures critical environment metadata to ensure deterministic AI execution.
 */

function captureContext() {
    console.log('📸 Capturing Agent Context Snapshot...');
    
    try {
        const context = {
            timestamp: new Date().toISOString(),
            branch: run_safe_command('git rev-parse --abbrev-ref HEAD')?.trim(),
            status: run_safe_command('git status -sb')?.trim(),
            staged: run_safe_command('git diff --staged --name-only')?.trim().split('\n').filter(Boolean),
            scripts: getPackageScripts(),
            env: {
                SANDBOX_MODE: process.env.SANDBOX_MODE || 'false',
                CI: process.env.CI || 'false'
            }
        };

        const snapshotPath = path.join(__dirname, '..', '.agent_context.json');
        fs.writeFileSync(snapshotPath, JSON.stringify(context, null, 2));
        
        console.log(`✅ Context snapshot saved to: ${snapshotPath}`);
        console.log('--- CONTEXT SUMMARY ---');
        console.log(`Branch: ${context.branch}`);
        console.log(`Staged Files: ${context.staged?.length || 0}`);
        console.log('-----------------------');
    } catch (error: any) {
        console.error(`❌ Failed to capture context: ${error.message}`);
        process.exit(1);
    }
}

function getPackageScripts(): string[] {
    try {
        const pkgPath = path.join(__dirname, '..', 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return Object.keys(pkg.scripts || {});
    } catch {
        return [];
    }
}

captureContext();
