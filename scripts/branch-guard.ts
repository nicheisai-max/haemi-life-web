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


/**
 * ExecutionMode — strict discriminated mode object.
 * Each flag maps to exactly one Git hook context:
 *
 *  --commit    → pre-commit, pre-push  (an actual git commit/push is in progress)
 *  --checkout  → post-checkout         (a branch switch occurred; NO commit in progress)
 *  --staged    → pre-commit            (staged file scanning: quality, identity, size)
 *  --revert    → manual               (recovery: resets working tree to origin/main)
 *
 * Invariant: post-checkout MUST use --checkout. Using --commit in post-checkout sets
 * MODE.COMMIT=true on every branch switch, causing 'git checkout main' to be blocked
 * by the AI-commit guard — a false positive that prevents all developer checkouts.
 */
type ExecutionMode = Readonly<{
    readonly COMMIT: boolean;   // True only during actual commit/push operations
    readonly CHECKOUT: boolean; // True only during post-checkout branch validation
    readonly REVERT: boolean;   // True for manual working-tree recovery
    readonly STAGED: boolean;   // True when staged-file scanning is required
}>;

const MODE: ExecutionMode = {
    COMMIT:   process.argv.includes('--commit'),
    CHECKOUT: process.argv.includes('--checkout'),
    REVERT:   process.argv.includes('--revert'),
    STAGED:   process.argv.includes('--staged') || process.argv.includes('--commit'),
} as const;

// ─── Configuration ─────────────────────────────────────────────────────────
const INIT_SQL_PATH = path.resolve(process.cwd(), 'backend/src/db/init.sql');
const HASH_FILE = path.resolve(__dirname, '../tmp/.init_sql_sha256');
const FORBIDDEN_IDENTIFIERS = ['actor_id', 'actor_user_id', 'actorUserId'];
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB

// ─── Core Logic ─────────────────────────────────────────────────────────────

function verifyBranch(): void {
    // run_safe_command returns string | void — not boolean.
    // The !branchName guard below correctly handles void (falsy) without needing boolean.
    const branchName: string | void = run_safe_command('git rev-parse --abbrev-ref HEAD', true);
    if (!branchName || typeof branchName !== 'string') return;

    const isMain: boolean = branchName === 'main';
    const isAISandbox: boolean =
        branchName.startsWith('ai-sandbox') ||
        branchName.startsWith('ai/sandbox');

    console.log(`\u{1F33F} Branch Check: ${branchName}`);

    // AI-COMMIT GUARD: Only fires when MODE.COMMIT=true (pre-commit / pre-push hooks).
    // post-checkout uses MODE.CHECKOUT=true — this guard is intentionally skipped,
    // allowing developers to freely switch to main for review, pull, and inspection.
    // Root Cause of P0 Husky failure: .husky/post-checkout was passing --commit here,
    // causing MODE.COMMIT=true on every 'git checkout main', blocking all checkouts.
    if (isMain && MODE.COMMIT) {
        console.error('\u{1F6A8} SECURITY ALERT: AI commits to main are forbidden.');
        process.exit(1);
    }

    // CONVENTION GUARD: Fires in ALL modes (commit, checkout, revert).
    // Prevents creation of non-conforming branches except main.
    if (!isMain && !isAISandbox) {
        console.error(`\u{1F6A8} POLICY VIOLATION: Branch '${branchName}' must follow ai-sandbox/* convention.`);
        if (MODE.REVERT) {
            console.log('\u{1F504} Reverting to main...');
            run_safe_command('git fetch origin --prune');
            run_safe_command('git reset --hard origin/main');
        }
        process.exit(1);
    }
}

function verifySchema(): void {
    if (!fs.existsSync(INIT_SQL_PATH)) return;
    const currentHash: string = crypto
        .createHash('sha256')
        .update(fs.readFileSync(INIT_SQL_PATH))
        .digest('hex');
    
    if (!fs.existsSync(HASH_FILE)) {
        fs.writeFileSync(HASH_FILE, currentHash);
        return;
    }

    const savedHash: string = fs.readFileSync(HASH_FILE, 'utf8');
    if (currentHash !== savedHash) {
        console.error('\u{1F6A8} SCHEMA GUARD: init.sql changed without lock update. Run hygiene to sync.');
        process.exit(1);
    }
}

function scanStagedFiles(): void {
    // run_safe_command returns string | void — the (typeof output === 'string') guard below
    // narrows it to string before calling .split(), satisfying strictness.
    const output: string | void = run_safe_command('git diff --cached --name-only --diff-filter=ACM', true);
    const files: string[] = (typeof output === 'string' ? output : '').split('\n').filter(Boolean);

    for (const file of files) {
        const fullPath: string = path.resolve(process.cwd(), file);
        if (
            !fs.existsSync(fullPath) ||
            file.includes('node_modules/') ||
            file.includes('branch-guard.ts')
        ) continue;

        const content: string = fs.readFileSync(fullPath, 'utf8');

        // 1. Identity Check
        for (const id of FORBIDDEN_IDENTIFIERS) {
            if (content.includes(id)) {
                console.error(`\u274C IDENTITY VIOLATION: Forbidden identifier "${id}" in ${file}`);
                process.exit(1);
            }
        }

        // 2. Zero Any Check
        const anyPattern = /:\s*any\b|<\s*any\s*>|\bas\s+any\b|=\s*any\b/;
        if (file.match(/\.(ts|tsx|js)$/) && anyPattern.test(content)) {
            console.error(`\u274C ZERO ANY VIOLATION: "any" type found in ${file}`);
            process.exit(1);
        }

        // 3. Large File Check
        if (fs.statSync(fullPath).size > MAX_FILE_SIZE_BYTES) {
            console.error(`\u274C SIZE VIOLATION: ${file} exceeds 1MB limit.`);
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
