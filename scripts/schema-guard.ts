import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

/**
 * 🛡️ HAEMI LIFE — INSTITUTIONAL SCHEMA GUARD (v13.0 Platinum)
 *
 * Single-file governance gate. Two clearly delimited sections:
 *
 *   SECTION 2 — SCHEMA_MANIFEST  (the source of truth, hand-maintained)
 *   SECTION 3+ — VERIFIER         (pure logic; rarely changes)
 *
 * GOVERNANCE CONTRACT
 * Any agent (human or AI) that adds, removes, or renames a database
 * table MUST update SCHEMA_MANIFEST in the same change-set as the SQL.
 * The verifier below cross-checks the manifest against init.sql,
 * migrations, and the live database. Any drift across the three
 * surfaces fails the gate and prints the exact resolution path.
 *
 * The scripts/ directory is frozen at 7 files by .github/workflows/
 * security.yml; that is why the manifest lives inline rather than in
 * a sibling schema-manifest.ts. The two responsibilities (data + logic)
 * remain conceptually separate via the banner comments.
 */

// ─── SECTION 1 — Imports & Constants ─────────────────────────────────

const ROOT_DIR = path.resolve(__dirname, '..');

// Load env from BOTH root .env and backend/.env. Either may carry the
// DB credentials depending on how the developer has the repo configured.
dotenv.config({ path: path.resolve(ROOT_DIR, '.env') });
dotenv.config({ path: path.resolve(ROOT_DIR, 'backend/.env') });

const INIT_SQL_PATH = path.resolve(ROOT_DIR, 'backend/src/db/init.sql');
const MIGRATIONS_DIR = path.resolve(ROOT_DIR, 'backend/src/db/migrations');
const HASH_FILE = path.resolve(ROOT_DIR, 'tmp/.init_sql_sha256');
const ARCHIVE_DIR = path.resolve(ROOT_DIR, 'institutional_archives');

const DEFAULT_PG_PORT = 5432;

const EXIT_OK = 0;
const EXIT_DRIFT = 1;
const EXIT_ENV_MISSING = 2;
const EXIT_DB_DOWN = 3;
const EXIT_FILE_MISSING = 4;
const EXIT_SHA_DIVERGED = 5;
const EXIT_EXPIRED_TOLERATION = 6;
const EXIT_MANIFEST_INVALID = 7;
const EXIT_UNHANDLED = 99;


// ═════════════════════════════════════════════════════════════════════
// SECTION 2 — SCHEMA MANIFEST  (THE SOURCE OF TRUTH)
//
// To change the schema:
//   1. Update init.sql (or write a migration in backend/src/db/migrations).
//   2. Update this manifest in the SAME commit.
//   3. Run the migration on every environment.
//
// To remove a stale table from the live DB:
//   • Add a DROP migration AND remove the entry from `tolerated`.
//
// To temporarily allow a table that is not yet declared in SQL:
//   • Add to `tolerated` with a justification AND an expiry date.
//   • Past the expiry, the gate fails.
// ═════════════════════════════════════════════════════════════════════

const SCHEMA_MANIFEST = {
    version: '13.0',
    approvedAt: '2026-04-30',
    approvedBy: 'institutional-architect',

    domains: {
        auth_security: [
            'users',
            'user_sessions',
            'audit_logs',
            'security_events',
        ],
        clinical_core: [
            'doctor_profiles',
            'patient_profiles',
            'pharmacist_profiles',
            'doctor_schedules',
            'appointments',
            'medical_records',
            'medical_record_files',
            'telemedicine_consents',
            'pre_screening_definitions',
            'appointment_pre_screenings',
        ],
        prescriptions: [
            'prescriptions',
            'prescription_files',
            'prescription_items',
        ],
        pharmacy: [
            'medicines',
            'pharmacies',
            'pharmacy_inventory',
            'locations',
            'orders',
            'order_items',
        ],
        chat: [
            'conversations',
            'conversation_participants',
            'messages',
            'message_reactions',
            'message_attachments',
            'deleted_messages',
            'temp_attachments',
        ],
        notifications: [
            'notifications',
        ],
        analytics: [
            'analytics_daily_visits',
            'revenue_stats',
        ],
        presence: [
            'active_connections',
        ],
        platform: [
            'system_settings',
            'schema_migrations',
            'knex_migrations',
            'knex_migrations_lock',
        ],
    },

    // Tables that exist in the live DB but are NOT yet declared in
    // init.sql or any current migration. Each entry must justify itself
    // and expire — the gate fails on expired entries to prevent
    // permanent waivers.
    //
    // Currently empty: the three legacy tables (doctors, patients,
    // sessions) inherited from archived 20260305000000_baseline_schema
    // were dropped in migration 20260430141536_drop_legacy_baseline_tables.
    // Snapshot retained at:
    //   institutional_archives/20260430T141536Z_legacy_baseline_drop_snapshot.sql
    tolerated: [] as ReadonlyArray<{
        readonly name: string;
        readonly reason: string;
        readonly expiresOn: string;
        readonly owner: string;
    }>,
} as const;


// ═════════════════════════════════════════════════════════════════════
// SECTION 3 — Types (derived strictly from the manifest)
// ═════════════════════════════════════════════════════════════════════

type DomainKey = keyof typeof SCHEMA_MANIFEST.domains;

interface ToleratedEntry {
    readonly name: string;
    readonly reason: string;
    readonly expiresOn: string;
    readonly owner: string;
}

interface DbConfig {
    readonly user: string;
    readonly host: string;
    readonly database: string;
    readonly password: string;
    readonly port: number;
}

interface DriftFinding {
    readonly table: string;
    readonly domain: DomainKey | 'unknown';
    readonly resolution: string;
}

interface AuditReport {
    readonly missingFromDb: readonly DriftFinding[];
    readonly missingFromManifest: readonly DriftFinding[];
    readonly missingFromSql: readonly DriftFinding[];
    readonly rogueInDb: readonly DriftFinding[];
    readonly expiredTolerations: readonly ToleratedEntry[];
    readonly expectedFromManifest: readonly string[];
    readonly declaredInSql: readonly string[];
    readonly presentInDb: readonly string[];
}


// ═════════════════════════════════════════════════════════════════════
// SECTION 4 — Structured logging helpers
//
// CLI scripts have no application logger; we emit structured-log style
// output to stdout/stderr so CI parsers and humans both see context.
// ═════════════════════════════════════════════════════════════════════

function logInfo(message: string, fields?: Record<string, unknown>): void {
    if (fields !== undefined) {
        console.log(message, JSON.stringify(fields));
    } else {
        console.log(message);
    }
}

function logWarn(message: string, fields?: Record<string, unknown>): void {
    if (fields !== undefined) {
        console.warn(message, JSON.stringify(fields));
    } else {
        console.warn(message);
    }
}

function logError(message: string, fields?: Record<string, unknown>): void {
    if (fields !== undefined) {
        console.error(message, JSON.stringify(fields));
    } else {
        console.error(message);
    }
}

function describeError(err: unknown): { name: string; message: string; stack?: string } {
    if (err instanceof Error) {
        return { name: err.name, message: err.message, stack: err.stack };
    }
    return { name: 'NonError', message: String(err) };
}


// ═════════════════════════════════════════════════════════════════════
// SECTION 5 — Environment & credential harvesting (fail-fast)
// ═════════════════════════════════════════════════════════════════════

function getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (typeof value !== 'string' || value.length === 0) {
        logError(`❌ Missing required environment variable: ${name}`);
        logError('   Configure it in backend/.env or root .env before running.');
        process.exit(EXIT_ENV_MISSING);
    }
    return value;
}

function getOptionalPort(name: string, fallback: number): number {
    const raw = process.env[name];
    if (typeof raw !== 'string' || raw.length === 0) return fallback;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
        logError(`❌ ${name} must be a positive integer (got "${raw}")`);
        process.exit(EXIT_ENV_MISSING);
    }
    return parsed;
}

function getDbConfig(): DbConfig {
    return {
        user: getRequiredEnv('DB_USER'),
        host: getRequiredEnv('DB_HOST'),
        database: getRequiredEnv('DB_NAME'),
        password: getRequiredEnv('DB_PASSWORD'),
        // DB_PORT defaults to PostgreSQL's protocol-standard 5432.
        // Other credentials have no defaults — they must be configured.
        port: getOptionalPort('DB_PORT', DEFAULT_PG_PORT),
    };
}


// ═════════════════════════════════════════════════════════════════════
// SECTION 6 — Manifest unwrap & self-consistency
// ═════════════════════════════════════════════════════════════════════

function getManifestTables(): { all: Set<string>; byDomain: Map<string, DomainKey> } {
    const all = new Set<string>();
    const byDomain = new Map<string, DomainKey>();

    const domainKeys = Object.keys(SCHEMA_MANIFEST.domains) as DomainKey[];
    for (const key of domainKeys) {
        for (const table of SCHEMA_MANIFEST.domains[key]) {
            all.add(table);
            byDomain.set(table, key);
        }
    }
    return { all, byDomain };
}

function validateManifestSelfConsistency(): void {
    const seenInDomains = new Set<string>();

    const domainKeys = Object.keys(SCHEMA_MANIFEST.domains) as DomainKey[];
    for (const key of domainKeys) {
        for (const table of SCHEMA_MANIFEST.domains[key]) {
            if (seenInDomains.has(table)) {
                logError(`❌ Manifest invariant violated: '${table}' appears in multiple domains.`);
                process.exit(EXIT_MANIFEST_INVALID);
            }
            seenInDomains.add(table);
        }
    }

    const seenInTolerated = new Set<string>();
    for (const entry of SCHEMA_MANIFEST.tolerated) {
        if (seenInDomains.has(entry.name)) {
            logError(`❌ Manifest invariant violated: '${entry.name}' is both managed (domains) and tolerated.`);
            process.exit(EXIT_MANIFEST_INVALID);
        }
        if (seenInTolerated.has(entry.name)) {
            logError(`❌ Manifest invariant violated: tolerated entry '${entry.name}' duplicated.`);
            process.exit(EXIT_MANIFEST_INVALID);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresOn)) {
            logError(`❌ Manifest invariant violated: tolerated '${entry.name}' has malformed expiresOn ('${entry.expiresOn}'). Expected YYYY-MM-DD.`);
            process.exit(EXIT_MANIFEST_INVALID);
        }
        seenInTolerated.add(entry.name);
    }
}


// ═════════════════════════════════════════════════════════════════════
// SECTION 7 — SQL parsing (init.sql + migrations → declared table set)
// ═════════════════════════════════════════════════════════════════════

function stripSqlComments(sql: string): string {
    return sql
        .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
        .replace(/--[^\n]*/g, '');         // line comments
}

const CREATE_TABLE_RE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["`]?(\w+)["`]?/gi;
const DROP_TABLE_RE = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?["`]?(\w+)["`]?/gi;
const ALTER_RENAME_RE = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?["`]?(\w+)["`]?\s+RENAME\s+TO\s+(?:public\.)?["`]?(\w+)["`]?/gi;

function applySqlEffects(sql: string, declared: Set<string>): void {
    const stripped = stripSqlComments(sql);

    let match: RegExpExecArray | null;

    CREATE_TABLE_RE.lastIndex = 0;
    while ((match = CREATE_TABLE_RE.exec(stripped)) !== null) {
        declared.add(match[1].toLowerCase());
    }

    DROP_TABLE_RE.lastIndex = 0;
    while ((match = DROP_TABLE_RE.exec(stripped)) !== null) {
        declared.delete(match[1].toLowerCase());
    }

    ALTER_RENAME_RE.lastIndex = 0;
    while ((match = ALTER_RENAME_RE.exec(stripped)) !== null) {
        const from = match[1].toLowerCase();
        const to = match[2].toLowerCase();
        if (declared.has(from)) {
            declared.delete(from);
            declared.add(to);
        }
    }
}

function deriveSqlTables(): Set<string> {
    if (!fs.existsSync(INIT_SQL_PATH)) {
        logError(`❌ init.sql missing at ${INIT_SQL_PATH}`);
        process.exit(EXIT_FILE_MISSING);
    }

    const declared = new Set<string>();

    applySqlEffects(fs.readFileSync(INIT_SQL_PATH, 'utf8'), declared);

    if (fs.existsSync(MIGRATIONS_DIR)) {
        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();
        for (const file of files) {
            applySqlEffects(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'), declared);
        }
    }

    return declared;
}


// ═════════════════════════════════════════════════════════════════════
// SECTION 8 — Forensic SHA256 lock (init.sql immutability proof)
// ═════════════════════════════════════════════════════════════════════

function getSHA256(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

function verifySchemaLock(): void {
    logInfo('\n--- 🩺 HAEMI LIFE: FORENSIC SCHEMA AUDIT ---');
    logInfo('🛡️  Audit State: VERIFYING SHA256 DETERMINISTIC LOCK');

    if (!fs.existsSync(INIT_SQL_PATH)) {
        logError('❌ CRITICAL FAILURE: Institutional Baseline (init.sql) is MISSING.');
        process.exit(EXIT_FILE_MISSING);
    }

    const sqlContent = fs.readFileSync(INIT_SQL_PATH, 'utf8');
    const versionMatch = sqlContent.match(/DATABASE INITIALIZATION \(v(\d+\.\d+)\)/i);
    const version = versionMatch !== null ? versionMatch[1] : 'UNKNOWN';
    logInfo(`📊 Detected Baseline Version: ${version}`);

    const currentHash = getSHA256(INIT_SQL_PATH);
    if (currentHash === null) process.exit(EXIT_FILE_MISSING);

    if (!fs.existsSync(HASH_FILE)) {
        logInfo('📜 Initializing new SHA256 baseline fingerprint...');
        const hashDir = path.dirname(HASH_FILE);
        if (!fs.existsSync(hashDir)) fs.mkdirSync(hashDir, { recursive: true });
        fs.writeFileSync(HASH_FILE, currentHash);
        return;
    }

    const savedHash = fs.readFileSync(HASH_FILE, 'utf8').trim();

    if (currentHash === savedHash) {
        logInfo('✅ Deterministic Integrity: VERIFIED (Zero Drift Detected)');
        return;
    }

    logWarn('⚡ SCHEMA CHANGE DETECTED: Verifying Migration Lineage...');
    const migrations = fs.existsSync(MIGRATIONS_DIR)
        ? fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql') || f.endsWith('.js'))
        : [];
    if (migrations.length === 0) {
        logError('❌ GOVERNANCE VIOLATION: init.sql changed but ZERO migrations found.');
        process.exit(EXIT_SHA_DIVERGED);
    }
    logInfo(`📝 Migration Proof Found (${migrations.length} files). Synchronizing Lock...`);
    const hashDir = path.dirname(HASH_FILE);
    if (!fs.existsSync(hashDir)) fs.mkdirSync(hashDir, { recursive: true });
    fs.writeFileSync(HASH_FILE, currentHash);
    logInfo('🔄 SHA256 Lock Synchronized.');
}


// ═════════════════════════════════════════════════════════════════════
// SECTION 9 — Three-way verification (manifest ↔ SQL ↔ DB)
// ═════════════════════════════════════════════════════════════════════

async function performAudit(): Promise<AuditReport> {
    logInfo('\n--- 🩺 HAEMI LIFE: DATABASE HEALTH HEARTBEAT ---');

    const config = getDbConfig();
    const client = new Client(config);

    try {
        await client.connect();
    } catch (err: unknown) {
        logError('❌ DB connection failed', describeError(err));
        process.exit(EXIT_DB_DOWN);
    }
    logInfo('🔗 Connection State: ESTABLISHED');

    try {
        const res = await client.query<{ table_name: string }>(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_type = 'BASE TABLE'
              AND table_name NOT LIKE 'pg_stat_%'
        `, ['public']);

        const presentInDb = new Set<string>(res.rows.map(r => r.table_name.toLowerCase()));
        const declaredInSql = deriveSqlTables();
        const { all: expectedFromManifest, byDomain } = getManifestTables();
        const toleratedNames = new Set<string>(SCHEMA_MANIFEST.tolerated.map(t => t.name.toLowerCase()));

        const missingFromDb: DriftFinding[] = [];
        const missingFromSql: DriftFinding[] = [];
        const missingFromManifest: DriftFinding[] = [];
        const rogueInDb: DriftFinding[] = [];

        for (const table of expectedFromManifest) {
            if (!presentInDb.has(table)) {
                missingFromDb.push({
                    table,
                    domain: byDomain.get(table) ?? 'unknown',
                    resolution: `Run pending migration that creates '${table}', OR remove from manifest and author a DROP migration if obsolete.`,
                });
            }
            if (!declaredInSql.has(table)) {
                missingFromSql.push({
                    table,
                    domain: byDomain.get(table) ?? 'unknown',
                    resolution: `Add a CREATE TABLE for '${table}' to init.sql or a migration. The manifest declares it but no SQL does.`,
                });
            }
        }

        for (const table of declaredInSql) {
            if (!expectedFromManifest.has(table)) {
                missingFromManifest.push({
                    table,
                    domain: 'unknown',
                    resolution: `Add '${table}' to SCHEMA_MANIFEST.domains under the appropriate domain key.`,
                });
            }
        }

        for (const table of presentInDb) {
            if (!expectedFromManifest.has(table) && !toleratedNames.has(table)) {
                rogueInDb.push({
                    table,
                    domain: 'unknown',
                    resolution: `Add '${table}' to SCHEMA_MANIFEST.domains, OR add an entry to SCHEMA_MANIFEST.tolerated[] with reason+expiry, OR DROP from the database.`,
                });
            }
        }

        const today = new Date().toISOString().slice(0, 10);
        const expiredTolerations: ToleratedEntry[] = SCHEMA_MANIFEST.tolerated
            .filter(t => t.expiresOn < today)
            .map(t => ({ name: t.name, reason: t.reason, expiresOn: t.expiresOn, owner: t.owner }));

        return {
            missingFromDb,
            missingFromSql,
            missingFromManifest,
            rogueInDb,
            expiredTolerations,
            expectedFromManifest: [...expectedFromManifest].sort(),
            declaredInSql: [...declaredInSql].sort(),
            presentInDb: [...presentInDb].sort(),
        };
    } catch (err: unknown) {
        logError('❌ Audit query failed', describeError(err));
        process.exit(EXIT_DB_DOWN);
    } finally {
        await client.end();
    }
}


// ═════════════════════════════════════════════════════════════════════
// SECTION 10 — Drift reporting (by name, by domain, with resolutions)
// ═════════════════════════════════════════════════════════════════════

function reportDrift(report: AuditReport): boolean {
    logInfo(`📊 Manifest expectation:         ${report.expectedFromManifest.length} tables`);
    logInfo(`📊 init.sql/migrations declared: ${report.declaredInSql.length} tables`);
    logInfo(`📊 Database actual:              ${report.presentInDb.length} tables`);

    const totalIssues =
        report.missingFromDb.length +
        report.missingFromSql.length +
        report.missingFromManifest.length +
        report.rogueInDb.length +
        report.expiredTolerations.length;

    if (totalIssues === 0) {
        logInfo('');
        logInfo('✅ Three-way Verification: PASSED');
        logInfo('   manifest ↔ init.sql ↔ database — all aligned.');
        if (SCHEMA_MANIFEST.tolerated.length > 0) {
            logInfo('');
            logInfo(`   ⚠ ${SCHEMA_MANIFEST.tolerated.length} active toleration(s) — expiring soon should be acted on:`);
            for (const t of SCHEMA_MANIFEST.tolerated) {
                logInfo(`     - ${t.name}  expires ${t.expiresOn}  (${t.owner})`);
            }
        }
        return true;
    }

    logError('');
    logError('❌ SCHEMA GOVERNANCE BREACH: drift detected across surfaces.');

    if (report.missingFromDb.length > 0) {
        logError('');
        logError('⚠ Missing in database (declared in manifest):');
        for (const f of report.missingFromDb) {
            logError(`   - ${f.table}  [domain: ${f.domain}]`);
            logError(`     ► ${f.resolution}`);
        }
    }

    if (report.missingFromSql.length > 0) {
        logError('');
        logError('⚠ Missing in init.sql/migrations (declared in manifest):');
        for (const f of report.missingFromSql) {
            logError(`   - ${f.table}  [domain: ${f.domain}]`);
            logError(`     ► ${f.resolution}`);
        }
    }

    if (report.missingFromManifest.length > 0) {
        logError('');
        logError('⚠ Declared in init.sql but NOT in manifest:');
        for (const f of report.missingFromManifest) {
            logError(`   - ${f.table}`);
            logError(`     ► ${f.resolution}`);
        }
    }

    if (report.rogueInDb.length > 0) {
        logError('');
        logError('⚠ Present in database but unknown to manifest/init.sql:');
        for (const f of report.rogueInDb) {
            logError(`   - ${f.table}`);
            logError(`     ► ${f.resolution}`);
        }
    }

    if (report.expiredTolerations.length > 0) {
        logError('');
        logError('🕒 EXPIRED tolerations (have outlived their grace period):');
        for (const t of report.expiredTolerations) {
            logError(`   - ${t.name}  expired ${t.expiresOn}  (owner: ${t.owner})`);
            logError(`     ► reason: ${t.reason}`);
            logError(`     ► author the DROP migration NOW or extend with explicit re-approval.`);
        }
    }

    return false;
}


// ═════════════════════════════════════════════════════════════════════
// SECTION 11 — Archival orchestration (cross-platform, env-driven)
// ═════════════════════════════════════════════════════════════════════

function resolvePgDumpPath(): string {
    return process.env.PG_DUMP_PATH ?? 'pg_dump';
}

function orchestrateArchival(): void {
    if (!process.argv.includes('--archive')) return;

    logInfo('\n--- 📦 HAEMI LIFE: ARCHIVAL ORCHESTRATION ---');

    if (!fs.existsSync(ARCHIVE_DIR)) {
        fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    }

    const config = getDbConfig();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pgDump = resolvePgDumpPath();
    const tables: readonly string[] = ['audit_logs', 'conversations', 'messages', 'notifications'];

    try {
        logInfo(`🚀 Initiating clinical archive to: ${ARCHIVE_DIR}`);
        for (const table of tables) {
            const archivePath = path.join(ARCHIVE_DIR, `${table}_archive_${timestamp}.sql`);
            const args = `-U ${config.user} -h ${config.host} -p ${config.port} ${config.database} -t ${table}`;
            const cmd = process.platform === 'win32'
                ? `set "PGPASSWORD=${config.password}" && "${pgDump}" ${args} > "${archivePath}"`
                : `PGPASSWORD='${config.password}' "${pgDump}" ${args} > "${archivePath}"`;
            execSync(cmd, {
                stdio: 'inherit',
                shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
            });
            logInfo(`✅ Table '${table}' archived successfully.`);
        }
        logInfo('✨ Archival Lifecycle: COMPLETE');
    } catch (err: unknown) {
        logError('❌ ARCHIVAL FAILURE: System Interrupted', describeError(err));
        process.exit(EXIT_UNHANDLED);
    }
}


// ═════════════════════════════════════════════════════════════════════
// SECTION 12 — Entry point
// ═════════════════════════════════════════════════════════════════════

async function startController(): Promise<void> {
    try {
        validateManifestSelfConsistency();
        verifySchemaLock();
        orchestrateArchival();
        const report = await performAudit();
        const passed = reportDrift(report);

        if (!passed) {
            const exitCode = report.expiredTolerations.length > 0
                ? EXIT_EXPIRED_TOLERATION
                : EXIT_DRIFT;
            process.exit(exitCode);
        }

        logInfo('');
        logInfo('✨ Summary: 100% Institutional Purity Verified. ✨');
        logInfo('');
        process.exit(EXIT_OK);
    } catch (err: unknown) {
        logError('❌ CONTROLLER COLLAPSE: Unhandled Exception', describeError(err));
        process.exit(EXIT_UNHANDLED);
    }
}

void startController();
