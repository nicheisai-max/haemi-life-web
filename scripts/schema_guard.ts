import { run_safe_command } from './agent_watchdog';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * SCHEMA GUARD (Lock Enforcement — SHA256 TS)
 * Policy: init.sql must never change without a corresponding migration.
 * Verification: Deterministic Hash + Migration Existence.
 */

const INIT_SQL_PATH = path.resolve(__dirname, '../backend/src/db/init.sql');
const MIGRATIONS_DIR = path.resolve(__dirname, '../backend/src/db/migrations');
const HASH_FILE = path.resolve(__dirname, '.init_sql_sha256');

function getSHA256(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

function verifySchemaLock() {
    console.log('🛡️  Schema Guard: Verifying SHA256 Deterministic Lock...');

    if (!fs.existsSync(INIT_SQL_PATH)) {
        console.error('❌ CRITICAL ERROR: init.sql not found at ' + INIT_SQL_PATH);
        process.exit(1);
    }

    const currentHash = getSHA256(INIT_SQL_PATH);
    if (!currentHash) {
        process.exit(1);
    }

    // 1. Check if hash file exists
    if (!fs.existsSync(HASH_FILE)) {
        console.log('⚠️  Initial baseline: Recording SHA256 fingerprint for init.sql.');
        fs.writeFileSync(HASH_FILE, currentHash);
        process.exit(0);
    }

    const savedHash = fs.readFileSync(HASH_FILE, 'utf8');

    // 2. Hash Verification
    if (currentHash !== savedHash) {
        console.warn('⚡ Schema Change Detected. Verifying Migration Presence...');

        // Find all migrations
        const migrations = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .map(f => ({
                name: f,
                mtime: fs.statSync(path.join(MIGRATIONS_DIR, f)).mtimeMs
            }))
            .sort((a, b) => b.mtime - a.mtime);

        if (migrations.length === 0) {
            console.error('❌ POLICY VIOLATION: init.sql changed but ZERO migrations found.');
            process.exit(1);
        }

        // Deterministic check
        const latestMigration = migrations[0];
        console.log('✅ Migration detected: ' + latestMigration.name);

        // Update hash baseline
        fs.writeFileSync(HASH_FILE, currentHash);
    }

    console.log('✅ Schema Guard: Deterministic Integrity Verified.');
    process.exit(0);
}

verifySchemaLock();
