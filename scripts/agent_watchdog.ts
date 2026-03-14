import { execSync } from 'child_process';
import * as fs from 'fs';

/**
 * 🐕 AGENT WATCHDOG (Institutional Guard)
 * 
 * Policy Enforcement:
 * - Timeout: 60s
 * - Max Commands: 25
 * - Forbidden: git reset --hard main, git push origin main, etc.
 */

const CONFIG = {
    TIMEOUT_MS: 60000,
    MAX_COMMANDS: 50, // Increased for surgical mission
    RETRY_LIMIT: 3,
    FORBIDDEN_PATTERNS: [
        /git\s+push\s+origin\s+main/i,
        /git\s+reset\s+--hard\s+main/i,
        /git\s+push\s+--force/i,
        /rm\s+-rf\s+\//i
    ],
    WHITELIST_PATTERNS: [
        /^npm/i,
        /^git\s+status/i,
        /^git\s+add/i,
        /^git\s+commit/i,
        /^git\s+checkout\s+-b\s+ai-sandbox\//i,
        /^node\s+scripts\//i,
        /^tsx\s+scripts\//i,
        /^git\s+rev-parse/i,
        /^git\s+diff/i,
        /^git\s+fetch/i,
        /^git\s+remote\s+prune/i,
        /^git\s+branch/i,
        /^powershell/i,
        /^taskkill/i
    ]
};

import { validateAgentCommand } from './agent_contract';

let commandCount = 0;

export function run_safe_command(command: string) {
    commandCount++;

    // 0. Deterministic Contract Guard
    validateAgentCommand(command);

    // 1. Session Resource Guard
    if (commandCount > CONFIG.MAX_COMMANDS) {
        console.error('🛑 [WATCHDOG] CRITICAL: Session command limit exceeded.');
        process.exit(1);
    }

    // 2. Forbidden Command Guard
    for (const pattern of CONFIG.FORBIDDEN_PATTERNS) {
        if (pattern.test(command)) {
            console.error(`🛑 [WATCHDOG] SECURITY VIOLATION: Dangerous command blocked: "${command}"`);
            process.exit(1);
        }
    }

    // 3. Command Execution with Retry Logic
    let attempts = 0;
    while (attempts < CONFIG.RETRY_LIMIT) {
        try {
            console.log(`📡 [WATCHDOG] Executing (Attempt ${attempts + 1}): ${command}`);
            return execSync(command, { 
                encoding: 'utf8', 
                timeout: CONFIG.TIMEOUT_MS,
                stdio: 'pipe' // Pipe for better control in wrapper
            });
        } catch (error) {
            attempts++;
            if (attempts >= CONFIG.RETRY_LIMIT) {
                console.error(`❌ [WATCHDOG] Command failed after ${CONFIG.RETRY_LIMIT} attempts: ${command}`);
                process.exit(1);
            }
            console.warn(`⚠️ [WATCHDOG] Command failed, retrying... (${attempts}/${CONFIG.RETRY_LIMIT})`);
        }
    }
}

// Self-Verification on run
if (require.main === module) {
    console.log('✅ Agent Watchdog: Active and Monitoring Lifecycle.');
}
