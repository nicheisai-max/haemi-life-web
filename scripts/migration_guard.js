/**
 * ENTERPRISE MIGRATION SAFETY GUARD (STAGED FILES ONLY)
 * 
 * Prevents destructive SQL operations in database migrations.
 * Scans for DROP TABLE, TRUNCATE, and CASCADE in STAGED files.
 */

const fs = require('fs');
const { execSync } = require('child_process');

const PROHIBITED_PATTERNS = [
    /\bDROP\s+TABLE\b/i,
    /\bTRUNCATE\b/i,
    /\bCASCADE\b/i
];

console.log('🛡️  Running Migration Safety Guard (Staged Files Only)...');

let stagedSqlFiles = [];
try {
    // Get list of staged files that are SQL files
    const output = execSync('git diff --cached --name-only').toString();
    stagedSqlFiles = output.split('\n')
        .map(f => f.trim())
        .filter(f => f.endsWith('.sql') && fs.existsSync(f));
} catch (error) {
    console.error('Failed to retrieve staged files list.');
    process.exit(0); // Fail open if git is having issues
}

if (stagedSqlFiles.length === 0) {
    console.log('✅ No new SQL migrations staged. Skipping check.');
    process.exit(0);
}

let violations = 0;

stagedSqlFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');

    PROHIBITED_PATTERNS.forEach(regex => {
        if (regex.test(content)) {
            console.error(`❌ SECURITY VIOLATION in ${file}: Destructive keyword detected matching ${regex}`);
            violations++;
        }
    });
});

if (violations > 0) {
    console.error(`\n🚨 Migration guard rejected ${violations} violation(s).`);
    console.error('Enterprise policy prohibits destructive migrations on production tables.');
    process.exit(1);
}

console.log('✅ Migration safety check passed.');
process.exit(0);
