import { run_safe_command } from './agent-watchdog';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * 🛡️ MASTER GOVERNANCE GUARD — HAEMI LIFE (Consolidated)
 * 
 * POLICY: CONTROLLED ENTERPRISE WORKFLOW
 * 1. Branch Policy (ai-sandbox/* enforcement)
 * 2. Schema Integrity (init.sql SHA256 lock)
 * 3. Identity Policy (Canonical user_id identifier)
 * 4. Code Quality (Zero Any policy)
 * 5. Resource Safety (Large file & forbidden pattern block)
 */

const MODE = {
    COMMIT: process.argv.includes('--commit'),
    REVERT: process.argv.includes('--revert'),
    STAGED: process.argv.includes('--staged') || process.argv.includes('--commit')
};

// ─── Configuration ─────────────────────────────────────────────────────────
const INIT_SQL_PATH = path.resolve(process.cwd(), 'backend/src/db/init.sql');
const HASH_FILE = path.resolve(__dirname, '.init_sql_sha256');
const FORBIDDEN_IDENTIFIERS = ['actor_id', 'actor_user_id', 'actorUserId'];
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB

// ─── Core Logic ─────────────────────────────────────────────────────────────

function verifyBranch() {
    const branchName = run_safe_command('git rev-parse --abbrev-ref HEAD', true);
    if (!branchName || typeof branchName !== 'string') return;

    const isMain = branchName === 'main';
    const isAISandbox = branchName.startsWith('ai-sandbox') || branchName.startsWith('ai/sandbox');

    console.log(`🌿 Branch Check: ${branchName}`);

    if (isMain && MODE.COMMIT) {
        console.error('🚨 SECURITY ALERT: AI commits to main are forbidden.');
        process.exit(1);
    }

    if (!isMain && !isAISandbox) {
        console.error(`🚨 POLICY VIOLATION: Branch '${branchName}' must follow ai-sandbox/* convention.`);
        if (MODE.REVERT) {
            console.log('🔄 Reverting to main...');
            run_safe_command('git fetch origin --prune');
            run_safe_command('git reset --hard origin/main');
        }
        process.exit(1);
    }
}

function verifySchema() {
    if (!fs.existsSync(INIT_SQL_PATH)) return;
    const currentHash = crypto.createHash('sha256').update(fs.readFileSync(INIT_SQL_PATH)).digest('hex');
    
    if (!fs.existsSync(HASH_FILE)) {
        fs.writeFileSync(HASH_FILE, currentHash);
        return;
    }

    const savedHash = fs.readFileSync(HASH_FILE, 'utf8');
    if (currentHash !== savedHash) {
        console.error('🚨 SCHEMA GUARD: init.sql changed without lock update. Run hygiene to sync.');
        process.exit(1);
    }
}

function scanStagedFiles() {
    const output = run_safe_command('git diff --cached --name-only --diff-filter=ACM', true);
    const files = (typeof output === 'string' ? output : '').split('\n').filter(Boolean);

    for (const file of files) {
        const fullPath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(fullPath) || file.includes('node_modules/') || file.includes('branch-guard.ts')) continue;

        const content = fs.readFileSync(fullPath, 'utf8');

        // 1. Identity Check
        for (const id of FORBIDDEN_IDENTIFIERS) {
            if (content.includes(id)) {
                console.error(`❌ IDENTITY VIOLATION: Forbidden identifier "${id}" in ${file}`);
                process.exit(1);
            }
        }

        // 2. Zero Any Check
        if (file.match(/\.(ts|tsx|js)$/) && /:\s*any\b|<\s*any\s*>|\bas\s+any\b|=\s*any\b/.test(content)) {
            console.error(`❌ ZERO ANY VIOLATION: "any" type found in ${file}`);
            process.exit(1);
        }

        // 3. Large File Check
        if (fs.statSync(fullPath).size > MAX_FILE_SIZE_BYTES) {
            console.error(`❌ SIZE VIOLATION: ${file} exceeds 1MB limit.`);
            process.exit(1);
        }
    }
}

// ─── Execution ─────────────────────────────────────────────────────────────
console.log('🛡️  Haemi Life Master Governance Active');
verifyBranch();

if (MODE.STAGED) {
    verifySchema();
    scanStagedFiles();
}

console.log('✅ Governance checks passed.');
process.exit(0);
