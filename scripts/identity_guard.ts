import { run_safe_command } from './agent_watchdog';
import * as fs from 'fs';
import * as path from 'path';

/**
 * IDENTITY GUARD (Zero-Trust Enforcement — Optimized TS)
 * Policy: user_id is the single canonical identifier.
 * Performance: Staged-file scanning for near-zero commit latency.
 */

const FORBIDDEN_IDENTIFIERS = ['actor_id', 'actor_user_id', 'actorUserId'];
const SCAN_DIRECTORIES = ['backend/src', 'frontend/src', 'scripts', 'e2e/tests'];
const IGNORE_FILES = [
    'scripts/identity_guard.ts',
    'scripts/identity_guard.js',
    'backend/src/db/init.sql',
    'backend/src/db/migrations/011_security_observability.sql'
];

function scanRepository() {
    const isStagedOnly = process.argv.includes('--staged');
    console.log(`🛡️  Identity Guard: Initiating ${isStagedOnly ? 'Staged' : 'Forensic'} Scan...`);
    
    let filesToScan: string[] = [];
    
    if (isStagedOnly) {
        // Optimization: Only scan files that are about to be committed
        const output = run_safe_command('git diff --cached --name-only --diff-filter=ACM');
        filesToScan = (output || '').split('\n')
            .filter(Boolean)
            .map(f => path.resolve(process.cwd(), f))
            .filter(f => SCAN_DIRECTORIES.some(dir => f.includes(path.normalize(dir))));
    } else {
        // Full forensic scan
        for (const dir of SCAN_DIRECTORIES) {
            const fullPath = path.resolve(process.cwd(), dir);
            if (fs.existsSync(fullPath)) {
                filesToScan.push(...getAllFiles(fullPath));
            }
        }
    }

    let violationFound = false;

    for (const file of filesToScan) {
        const relativePath = path.relative(process.cwd(), file);
        if (IGNORE_FILES.includes(relativePath.replace(/\\/g, '/'))) continue;

        const content = fs.readFileSync(file, 'utf8');
        for (const forbidden of FORBIDDEN_IDENTIFIERS) {
            if (content.includes(forbidden)) {
                console.error(`❌ POLICY VIOLATION: Forbidden identifier "${forbidden}" found in ${relativePath}`);
                violationFound = true;
            }
        }
    }

    if (violationFound) {
        console.error('\n🛑 DEPLOYMENT BLOCKED: Identity policy drift detected.');
        process.exit(1);
    } else {
        console.log(`✅ Identity Guard: ${filesToScan.length} files verified. Canonical integrity maintained.`);
        process.exit(0);
    }
}

function getAllFiles(dirPath: string, arrayOfFiles?: string[]): string[] {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(function(file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            arrayOfFiles!!.push(fullPath);
        }
    });
    return arrayOfFiles;
}

scanRepository();
