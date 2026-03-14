const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * IDENTITY GUARD (Zero-Trust Enforcement)
 * Policy: user_id is the single canonical identifier.
 * Forbidden: actor_id, actor_user_id, actorUserId
 */

const FORBIDDEN_IDENTIFIERS = ['actor_id', 'actor_user_id', 'actorUserId'];
const SCAN_DIRECTORIES = ['backend/src', 'frontend/src', 'scripts', 'e2e/tests'];
const IGNORE_FILES = [
    'scripts/identity_guard.js',
    'backend/src/db/init.sql', // Allowed in baseline comments only
    'backend/src/db/migrations/011_security_observability.sql' // Historical record
];

function scanRepository() {
    console.log('🛡️  Identity Guard: Initiating Forensic Scan...');
    let violationFound = false;

    for (const dir of SCAN_DIRECTORIES) {
        const fullPath = path.resolve(process.cwd(), dir);
        if (!fs.existsSync(fullPath)) continue;

        const files = getAllFiles(fullPath);
        for (const file of files) {
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
    }

    if (violationFound) {
        console.error('\n🛑 DEPLOYMENT BLOCKED: Identity policy drift detected.');
        console.error('Use only "user_id" as the canonical identifier.');
        process.exit(1);
    } else {
        console.log('✅ Identity Guard: Zero violations detected. Canonical integrity maintained.');
        process.exit(0);
    }
}

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, "/", file));
        }
    });

    return arrayOfFiles;
}

scanRepository();
