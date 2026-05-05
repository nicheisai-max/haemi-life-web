import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

/**
 * 🛡️ HAEMI LIFE — INSTITUTIONAL SCHEMA GUARD (v14.0 Platinum + Column Verification)
 *
 * Single-file governance gate. Two clearly delimited sections:
 *
 *   SECTION 2 — SCHEMA_MANIFEST  (the source of truth, hand-maintained)
 *   SECTION 3+ — VERIFIER         (pure logic; rarely changes)
 *
 * GOVERNANCE CONTRACT
 * Any agent (human or AI) that adds, removes, or renames a database
 * table OR a column on any table MUST update SCHEMA_MANIFEST in the
 * same change-set as the SQL. The verifier below cross-checks the
 * manifest against init.sql, migrations, and the live database at
 * BOTH the table-level AND the column-level. Any drift across the
 * three surfaces fails the gate and prints the exact resolution path.
 *
 * v14.0 (this revision) closes a known blind spot: prior versions only
 * verified at the table-grain. A column added to an existing table
 * (e.g. `appointments.doctor_archived` in PR #110) would slip past
 * the gate because the table count remained constant. Per institutional
 * mandate, the manifest is now the SINGLE SOURCE OF TRUTH for the full
 * table×column matrix — every PR that touches a column MUST update
 * `tableColumns`, and every column drift across {manifest, init.sql,
 * migrations, live DB} now blocks merge.
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
    version: '14.0',
    approvedAt: '2026-05-05',
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

    // ─── COLUMN MANIFEST (v14.0) ──────────────────────────────────────────
    //
    // Per-table expected columns. Every PR that adds, removes, or renames
    // a column MUST update both the SQL surface (init.sql / a migration)
    // AND this map in the same change-set. The verifier reports any drift
    // across {this manifest, init.sql, migrations, live DB} as a hard
    // failure with a domain-correct resolution path.
    //
    // Keys MUST exactly match the union of all `domains` table names —
    // `validateManifestSelfConsistency()` enforces this invariant at boot.
    //
    // Column ordering inside each array is informational, not load-bearing
    // (the verifier compares as Sets). We preserve DB ordinal_position
    // ordering as a courtesy to readers reviewing diffs.
    //
    // Bootstrap was performed on 2026-05-05 from the live development DB
    // (38 tables, 366 columns) immediately after applying the PR #110
    // appointments-lifecycle migration. Future divergence is the verifier's
    // responsibility to surface — operators must NOT regenerate this map
    // wholesale; columns must be added/removed deliberately, one at a time,
    // alongside the corresponding SQL change.
    tableColumns: {
        active_connections: ['id', 'user_id', 'socket_id', 'connected_at', 'last_activity', 'last_ping'],
        analytics_daily_visits: ['id', 'date', 'visits', 'new_users', 'created_at'],
        appointment_pre_screenings: ['id', 'appointment_id', 'question_id', 'response_value', 'additional_notes', 'risk_score', 'created_at'],
        appointments: ['id', 'patient_id', 'doctor_id', 'appointment_date', 'appointment_time', 'duration_minutes', 'status', 'consultation_type', 'reason', 'notes', 'created_at', 'updated_at', 'deleted_at', 'pre_screening_status', 'referral_recommendation', 'doctor_archived', 'overdue_notified_at'],
        audit_logs: ['id', 'user_id', 'actor_role', 'action', 'entity_type', 'entity_id', 'details', 'previous_state', 'new_state', 'ip_address', 'user_agent', 'request_id', 'trace_id', 'api_endpoint', 'http_method', 'status', 'created_at'],
        conversation_participants: ['conversation_id', 'user_id', 'created_at', 'role'],
        conversations: ['id', 'created_at', 'updated_at', 'last_message_at', 'participant_one_id', 'participant_two_id', 'sequence_counter', 'participants_hash', 'name', 'is_redundant', 'last_message_id', 'preview_text'],
        deleted_messages: ['message_id', 'user_id', 'created_at'],
        doctor_profiles: ['id', 'user_id', 'specialization', 'license_number', 'years_of_experience', 'bio', 'consultation_fee', 'is_verified', 'profile_image', 'created_at', 'updated_at', 'can_video_consult'],
        doctor_schedules: ['id', 'doctor_id', 'day_of_week', 'start_time', 'end_time', 'is_available', 'created_at'],
        knex_migrations: ['id', 'name', 'batch', 'migration_time'],
        knex_migrations_lock: ['index', 'is_locked'],
        locations: ['id', 'city', 'district', 'gps_latitude', 'gps_longitude', 'created_at'],
        medical_record_files: ['id', 'record_id', 'file_path', 'file_mime', 'file_name', 'created_at', 'deleted_at'],
        medical_records: ['id', 'patient_id', 'name', 'record_type', 'doctor_name', 'facility_name', 'date_of_service', 'status', 'notes', 'file_path', 'file_type', 'file_size', 'uploaded_at', 'deleted_at', 'file_data', 'file_mime', 'created_at', 'updated_at'],
        medicines: ['id', 'name', 'generic_name', 'common_uses', 'price_per_unit', 'created_at', 'strength', 'category'],
        message_attachments: ['id', 'message_id', 'file_type', 'file_size', 'created_at', 'file_name', 'file_extension', 'file_category', 'file_path', 'deleted_at'],
        message_reactions: ['id', 'message_id', 'user_id', 'reaction_type', 'created_at'],
        messages: ['id', 'conversation_id', 'sender_id', 'content', 'attachment_url', 'attachment_type', 'is_read', 'created_at', 'message_type', 'is_deleted', 'reply_to_id', 'attachment_data', 'attachment_mime', 'attachment_name', 'status', 'delivered_at', 'read_at', 'updated_at', 'sequence_number', 'preview_text', 'sender_role', 'file_path', 'temp_id', 'deleted_at'],
        notifications: ['id', 'user_id', 'title', 'description', 'type', 'is_read', 'created_at', 'updated_at', 'message_id', 'conversation_id', 'metadata', 'received_at'],
        order_items: ['id', 'order_id', 'medicine_id', 'quantity', 'unit_price', 'created_at'],
        orders: ['id', 'patient_id', 'pharmacy_id', 'status', 'total_amount', 'created_at', 'updated_at', 'prescription_url', 'is_prescription_required', 'delivery_mode', 'is_government_subsidized', 'omang_number', 'hospital_origin'],
        patient_profiles: ['id', 'user_id', 'date_of_birth', 'gender', 'blood_group', 'emergency_contact_name', 'emergency_contact_phone', 'allergies', 'medical_conditions', 'created_at', 'updated_at'],
        pharmacies: ['id', 'name', 'location_id', 'address', 'phone_number', 'email', 'created_at'],
        pharmacist_profiles: ['id', 'user_id', 'license_number', 'workplace_name', 'years_of_experience', 'bio', 'created_at', 'updated_at'],
        pharmacy_inventory: ['id', 'pharmacy_id', 'medicine_id', 'price', 'stock_quantity', 'created_at', 'updated_at', 'dispensed_today', 'reorder_level', 'expiry_date'],
        pre_screening_definitions: ['id', 'category', 'question_text', 'disease_tag', 'risk_weight', 'is_active', 'sort_order', 'created_at'],
        prescription_files: ['id', 'prescription_id', 'file_path', 'file_mime', 'file_name', 'created_at', 'file_size', 'deleted_at'],
        prescription_items: ['id', 'prescription_id', 'medicine_id', 'dosage', 'frequency', 'duration_days', 'quantity', 'instructions', 'created_at', 'deleted_at'],
        prescriptions: ['id', 'patient_id', 'doctor_id', 'appointment_id', 'prescription_date', 'status', 'notes', 'created_at', 'updated_at', 'deleted_at'],
        revenue_stats: ['id', 'month', 'revenue', 'expenses', 'created_at'],
        schema_migrations: ['id', 'name', 'applied_at'],
        security_events: ['id', 'user_id', 'user_role', 'event_type', 'event_category', 'event_severity', 'ip_address', 'user_agent', 'device_fingerprint', 'session_id', 'request_path', 'request_method', 'http_status_code', 'event_metadata', 'is_suspicious', 'created_at'],
        system_settings: ['id', 'key', 'value', 'updated_at'],
        telemedicine_consents: ['id', 'patient_id', 'agreed_at', 'ip_address', 'user_agent', 'version', 'signature_data', 'created_at', 'updated_at', 'is_consented'],
        temp_attachments: ['id', 'data', 'mime', 'name', 'created_at'],
        user_sessions: ['id', 'user_id', 'user_role', 'session_id', 'access_token_jti', 'refresh_token_jti', 'ip_address', 'user_agent', 'device_type', 'browser_name', 'os_name', 'login_method', 'login_time', 'last_activity', 'logout_time', 'is_active', 'logout_reason', 'tab_identifier', 'created_at', 'updated_at', 'expires_at', 'previous_refresh_token_jti', 'previous_access_token_jti', 'jti_rotated_at', 'revoked'],
        users: ['id', 'name', 'email', 'phone_number', 'password', 'role', 'id_number', 'is_active', 'is_verified', 'created_at', 'updated_at', 'token_version', 'status', 'profile_image', 'profile_image_data', 'profile_image_mime', 'last_activity', 'initials', 'phone_blind_index', 'id_blind_index', 'deleted_at'],
    },

    // Columns that exist in the SQL surface (init.sql or a migration) but
    // are NOT yet declared in `tableColumns`, OR vice versa. Same expiry
    // discipline as `tolerated` for tables — every entry must justify
    // itself and expire. Past the expiry, the gate fails.
    //
    // This list is intended for transitional state ONLY (e.g. a column
    // is being introduced in one PR and the DB-side migration lands in
    // a follow-up). Steady-state should keep this list at zero entries.
    //
    // ─── 2026-05-05 SEED ENTRIES (pre-existing drift) ─────────────────────
    //
    // The v14.0 column verifier surfaced 30 pre-existing column-level
    // drifts across 13 tables on its first run — these are NOT regressions
    // from this PR. They fall into two buckets:
    //
    //   BUCKET A (23 entries): init.sql lags actual schema. Columns were
    //   added by archived migrations (e.g. archive/011_security_observability.sql)
    //   that have since been consolidated, but init.sql's CREATE TABLE
    //   blocks were not updated to reflect those additions. Both manifest
    //   (bootstrapped from live DB) and live DB hold the column; init.sql
    //   is silent.
    //
    //   BUCKET B (7 entries): init.sql declares aspirational columns that
    //   were never provisioned to the live DB. Either the migration was
    //   never run, or the column was renamed and init.sql wasn't updated.
    //
    // Both buckets are owned by `institutional-architect` and expire on
    // 2026-07-04 (60 days). The follow-up reconciliation PR must either:
    //   1. Update init.sql's CREATE TABLE blocks to include the missing
    //      columns (BUCKET A) and remove/rename the aspirational ones
    //      (BUCKET B), then delete these toleration entries; OR
    //   2. Author migrations that add the missing columns to live DB
    //      (BUCKET B) and make the aspirational declarations real, then
    //      delete the toleration entries.
    //
    // Past 2026-07-04 the gate fails — preventing this institutional debt
    // from becoming permanent.
    toleratedColumns: [
        // ── BUCKET A: init.sql lags actual schema ────────────────────────
        { table: 'audit_logs', column: 'previous_state', reason: 'Bucket A: column added by archive/011_security_observability.sql; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'audit_logs', column: 'new_state', reason: 'Bucket A: column added by archive/011_security_observability.sql; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'audit_logs', column: 'request_id', reason: 'Bucket A: column added by archive/011_security_observability.sql; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'audit_logs', column: 'trace_id', reason: 'Bucket A: column added by archive/011_security_observability.sql; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'audit_logs', column: 'api_endpoint', reason: 'Bucket A: column added by archive/011_security_observability.sql; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'audit_logs', column: 'http_method', reason: 'Bucket A: column added by archive/011_security_observability.sql; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'audit_logs', column: 'status', reason: 'Bucket A: column added by archive/011_security_observability.sql; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'conversation_participants', column: 'role', reason: 'Bucket A: column added by archived migration; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'conversations', column: 'participant_one_id', reason: 'Bucket A: chat-integrity columns added by archived migration; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'conversations', column: 'participant_two_id', reason: 'Bucket A: chat-integrity columns added by archived migration; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'conversations', column: 'sequence_counter', reason: 'Bucket A: chat-integrity columns added by archived migration; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'conversations', column: 'name', reason: 'Bucket A: chat-integrity columns added by archived migration; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'deleted_messages', column: 'created_at', reason: 'Bucket A: column added by archived migration; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'medical_records', column: 'created_at', reason: 'Bucket A: column added by archived migration; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'medical_records', column: 'updated_at', reason: 'Bucket A: column added by archived migration; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'message_reactions', column: 'id', reason: 'Bucket A: surrogate key added by archived migration; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'messages', column: 'attachment_url', reason: 'Bucket A: column added by archived migration; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'messages', column: 'updated_at', reason: 'Bucket A: column added by archived migration; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'messages', column: 'temp_id', reason: 'Bucket A: column added by archived migration; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'prescription_files', column: 'deleted_at', reason: 'Bucket A: soft-delete column added by archived migration; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'schema_migrations', column: 'name', reason: 'Bucket A: live DB column "name" replaced init.sql\'s "migration_name"; reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'telemedicine_consents', column: 'created_at', reason: 'Bucket A: column added by archived migration; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'telemedicine_consents', column: 'updated_at', reason: 'Bucket A: column added by archived migration; init.sql canonical reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },

        // ── BUCKET B: init.sql declares aspirational columns not in DB ───
        { table: 'user_sessions', column: 'revoked_at', reason: 'Bucket B: declared in init.sql but never provisioned to live DB; reconciliation (drop or migrate) pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'appointments', column: 'referral_code', reason: 'Bucket B: declared in init.sql but never provisioned to live DB; reconciliation (drop or migrate) pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'appointments', column: 'referral_source', reason: 'Bucket B: declared in init.sql but never provisioned to live DB; reconciliation (drop or migrate) pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'prescription_files', column: 'updated_at', reason: 'Bucket B: declared in init.sql but never provisioned to live DB; reconciliation (drop or migrate) pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'deleted_messages', column: 'deleted_at', reason: 'Bucket B: declared in init.sql but never provisioned to live DB; reconciliation (drop or migrate) pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'temp_attachments', column: 'deleted_at', reason: 'Bucket B: declared in init.sql but never provisioned to live DB; reconciliation (drop or migrate) pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
        { table: 'schema_migrations', column: 'migration_name', reason: 'Bucket B: legacy column name in init.sql; live DB renamed to "name"; reconciliation pending.', expiresOn: '2026-07-04', owner: 'institutional-architect' },
    ] as ReadonlyArray<{
        readonly table: string;
        readonly column: string;
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

interface ToleratedColumnEntry {
    readonly table: string;
    readonly column: string;
    readonly reason: string;
    readonly expiresOn: string;
    readonly owner: string;
}

interface ColumnDriftFinding {
    readonly table: string;
    readonly column: string;
    readonly resolution: string;
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

    // Column-level drift (v14.0).
    readonly columnsMissingFromDb: readonly ColumnDriftFinding[];
    readonly columnsMissingFromSql: readonly ColumnDriftFinding[];
    readonly columnsMissingFromManifest: readonly ColumnDriftFinding[];
    readonly columnsRogueInDb: readonly ColumnDriftFinding[];
    readonly expiredColumnTolerations: readonly ToleratedColumnEntry[];
    readonly columnTotals: {
        readonly manifest: number;
        readonly sql: number;
        readonly db: number;
    };
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

    // v14.0 — Column manifest invariants.
    //
    // Invariant 1: every key in `tableColumns` MUST be a managed table
    // (present in `domains`). Otherwise we would silently grow a parallel
    // table list that escapes domain governance.
    const tableColumnsKeys = Object.keys(SCHEMA_MANIFEST.tableColumns);
    for (const tableName of tableColumnsKeys) {
        if (!seenInDomains.has(tableName)) {
            logError(`❌ Manifest invariant violated: tableColumns key '${tableName}' is not declared in any domain.`);
            process.exit(EXIT_MANIFEST_INVALID);
        }
    }

    // Invariant 2: every managed table MUST appear in `tableColumns` —
    // a table without column declarations would silently bypass column-
    // level verification.
    for (const table of seenInDomains) {
        if (!Object.prototype.hasOwnProperty.call(SCHEMA_MANIFEST.tableColumns, table)) {
            logError(`❌ Manifest invariant violated: managed table '${table}' is missing from tableColumns.`);
            process.exit(EXIT_MANIFEST_INVALID);
        }
    }

    // Invariant 3: per-table column lists must be non-empty and have no
    // duplicates. Empty/duplicated lists are always operator error.
    const tableColumnsMap: Readonly<Record<string, ReadonlyArray<string>>> = SCHEMA_MANIFEST.tableColumns;
    for (const tableName of tableColumnsKeys) {
        const cols = tableColumnsMap[tableName];
        if (cols.length === 0) {
            logError(`❌ Manifest invariant violated: tableColumns['${tableName}'] is empty.`);
            process.exit(EXIT_MANIFEST_INVALID);
        }
        const seen = new Set<string>();
        for (const c of cols) {
            const lower = c.toLowerCase();
            if (seen.has(lower)) {
                logError(`❌ Manifest invariant violated: tableColumns['${tableName}'] has duplicate column '${c}'.`);
                process.exit(EXIT_MANIFEST_INVALID);
            }
            seen.add(lower);
        }
    }

    // Invariant 4: toleratedColumns entries are well-formed, do not
    // duplicate, and reference a table that the domains map manages.
    //
    // Toleration acts as a universal silencer for (table, column) drift
    // findings across all three drift dimensions (missing-from-db /
    // missing-from-sql / missing-from-manifest / rogue-in-db). It is
    // valid for a tolerated column to ALSO be in `tableColumns` — that
    // covers the "manifest+DB have it, SQL doesn't" reconciliation case
    // (Bucket A). It is also valid for a tolerated column to NOT be in
    // `tableColumns` — that covers the "SQL declares aspirationally,
    // not in DB" case (Bucket B). The toleration just suppresses the
    // finding either way until expiresOn.
    const seenColTolerated = new Set<string>();
    for (const entry of SCHEMA_MANIFEST.toleratedColumns) {
        const key = `${entry.table.toLowerCase()}.${entry.column.toLowerCase()}`;
        if (seenColTolerated.has(key)) {
            logError(`❌ Manifest invariant violated: toleratedColumns has duplicate entry '${key}'.`);
            process.exit(EXIT_MANIFEST_INVALID);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresOn)) {
            logError(`❌ Manifest invariant violated: toleratedColumns '${key}' has malformed expiresOn ('${entry.expiresOn}'). Expected YYYY-MM-DD.`);
            process.exit(EXIT_MANIFEST_INVALID);
        }
        if (!seenInDomains.has(entry.table.toLowerCase())) {
            logError(`❌ Manifest invariant violated: toleratedColumns '${key}' references unmanaged table '${entry.table}'. Add the table to a domain first.`);
            process.exit(EXIT_MANIFEST_INVALID);
        }
        seenColTolerated.add(key);
    }
}

// ─── Manifest accessors (typed, total-function) ──────────────────────────
//
// Encapsulating the cast to `Record<string, ReadonlyArray<string>>` here
// keeps the verifier code below totally cast-free, while keeping the
// manifest's literal types fully derivable for IDE autocomplete.
function getManifestColumns(): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>();
    const map: Readonly<Record<string, ReadonlyArray<string>>> = SCHEMA_MANIFEST.tableColumns;
    for (const tableName of Object.keys(map)) {
        const set = new Set<string>(map[tableName].map(c => c.toLowerCase()));
        result.set(tableName.toLowerCase(), set);
    }
    return result;
}

function getToleratedColumnSet(): Set<string> {
    // Returns "table.column" lowercase keys for fast membership testing.
    const set = new Set<string>();
    for (const entry of SCHEMA_MANIFEST.toleratedColumns) {
        set.add(`${entry.table.toLowerCase()}.${entry.column.toLowerCase()}`);
    }
    return set;
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
// SECTION 7B — Column-grain SQL parsing (v14.0)
//
// Parses init.sql + every migration file to derive { table → columns }.
// Mirrors `applySqlEffects` / `deriveSqlTables` for tables, but works
// at the column level. The output is the cumulative effect of:
//
//   • CREATE TABLE x (col_a TYPE, col_b TYPE, ...);     — declares columns
//   • ALTER TABLE x ADD COLUMN [IF NOT EXISTS] y TYPE;  — adds a column
//   • ALTER TABLE x DROP COLUMN [IF EXISTS] y;          — removes a column
//   • ALTER TABLE x RENAME COLUMN y TO z;               — swaps a column
//   • ALTER TABLE x RENAME TO z;                        — already handled
//                                                          via applySqlEffects;
//                                                          we mirror the rename
//                                                          here for column maps.
//
// The CREATE TABLE body parser is paren-aware (so `DEFAULT now()` /
// `CHECK (x IN (1,2,3))` don't confuse the comma-splitter) and skips
// table-level constraint clauses (`PRIMARY KEY (...)`, `FOREIGN KEY ...`,
// `CONSTRAINT foo`, `UNIQUE (...)`, `CHECK (...)`, `EXCLUDE ...`,
// `LIKE other_table`).
// ═════════════════════════════════════════════════════════════════════

const CREATE_TABLE_BODY_RE =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["`]?(\w+)["`]?\s*\(/gi;
const ADD_COLUMN_RE =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?["`]?(\w+)["`]?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/gi;
const DROP_COLUMN_RE =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?["`]?(\w+)["`]?\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?["`]?(\w+)["`]?/gi;
const RENAME_COLUMN_RE =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?["`]?(\w+)["`]?\s+RENAME\s+(?:COLUMN\s+)?["`]?(\w+)["`]?\s+TO\s+["`]?(\w+)["`]?/gi;

const COLUMN_CONSTRAINT_KEYWORDS: ReadonlySet<string> = new Set([
    'PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK', 'CONSTRAINT', 'EXCLUDE', 'LIKE',
]);

/**
 * Locate the index of the matching close paren for an opener at
 * `text[startIdx - 1]`. `startIdx` is the position immediately AFTER the
 * '(' that opens the body. Returns -1 if no match (malformed input).
 *
 * Treats single-quoted and double-quoted literals as opaque (their
 * contents are not scanned for parens), which is enough for the
 * institutional init.sql / migration SQL we own — we do not embed
 * dollar-quoted strings in CREATE TABLE clauses. If that changes, this
 * helper will need a `$$ ... $$` aware path.
 */
function findMatchingClosingParen(text: string, startIdx: number): number {
    let depth = 1;
    for (let i = startIdx; i < text.length; i++) {
        const ch = text[i];
        if (ch === "'") {
            i++;
            while (i < text.length && text[i] !== "'") {
                if (text[i] === '\\') i++;
                i++;
            }
            continue;
        }
        if (ch === '"') {
            i++;
            while (i < text.length && text[i] !== '"') i++;
            continue;
        }
        if (ch === '(') {
            depth++;
            continue;
        }
        if (ch === ')') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/**
 * Splits a CREATE TABLE body into top-level field definitions, then
 * extracts the column name from each (skipping table-level constraints).
 * Returns lower-cased column names.
 */
function parseColumnNamesFromTableBody(body: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let buf = '';
    for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (ch === "'") {
            buf += ch;
            i++;
            while (i < body.length && body[i] !== "'") {
                if (body[i] === '\\') {
                    buf += body[i];
                    i++;
                }
                buf += body[i];
                i++;
            }
            if (i < body.length) buf += body[i];
            continue;
        }
        if (ch === '"') {
            buf += ch;
            i++;
            while (i < body.length && body[i] !== '"') {
                buf += body[i];
                i++;
            }
            if (i < body.length) buf += body[i];
            continue;
        }
        if (ch === '(') {
            depth++;
            buf += ch;
            continue;
        }
        if (ch === ')') {
            depth--;
            buf += ch;
            continue;
        }
        if (ch === ',' && depth === 0) {
            parts.push(buf);
            buf = '';
            continue;
        }
        buf += ch;
    }
    if (buf.trim().length > 0) parts.push(buf);

    const cols: string[] = [];
    for (const raw of parts) {
        const trimmed = raw.trim();
        if (trimmed === '') continue;
        // Strip the leading word; tolerate quoted identifiers.
        const firstTokenMatch = trimmed.match(/^["`]?(\w+)["`]?/);
        if (firstTokenMatch === null) continue;
        const firstToken = firstTokenMatch[1];
        if (COLUMN_CONSTRAINT_KEYWORDS.has(firstToken.toUpperCase())) continue;
        cols.push(firstToken.toLowerCase());
    }
    return cols;
}

function applySqlColumnEffects(sql: string, byTable: Map<string, Set<string>>): void {
    const stripped = stripSqlComments(sql);

    let createMatch: RegExpExecArray | null;
    CREATE_TABLE_BODY_RE.lastIndex = 0;
    while ((createMatch = CREATE_TABLE_BODY_RE.exec(stripped)) !== null) {
        const tableName = createMatch[1].toLowerCase();
        const bodyStart = createMatch.index + createMatch[0].length;
        const bodyEnd = findMatchingClosingParen(stripped, bodyStart);
        if (bodyEnd === -1) continue;
        const body = stripped.slice(bodyStart, bodyEnd);
        const columns = parseColumnNamesFromTableBody(body);
        let bucket = byTable.get(tableName);
        if (bucket === undefined) {
            bucket = new Set<string>();
            byTable.set(tableName, bucket);
        }
        for (const c of columns) bucket.add(c);
    }

    let addMatch: RegExpExecArray | null;
    ADD_COLUMN_RE.lastIndex = 0;
    while ((addMatch = ADD_COLUMN_RE.exec(stripped)) !== null) {
        const tableName = addMatch[1].toLowerCase();
        const columnName = addMatch[2].toLowerCase();
        let bucket = byTable.get(tableName);
        if (bucket === undefined) {
            bucket = new Set<string>();
            byTable.set(tableName, bucket);
        }
        bucket.add(columnName);
    }

    let dropMatch: RegExpExecArray | null;
    DROP_COLUMN_RE.lastIndex = 0;
    while ((dropMatch = DROP_COLUMN_RE.exec(stripped)) !== null) {
        const tableName = dropMatch[1].toLowerCase();
        const columnName = dropMatch[2].toLowerCase();
        const bucket = byTable.get(tableName);
        if (bucket !== undefined) bucket.delete(columnName);
    }

    let renameMatch: RegExpExecArray | null;
    RENAME_COLUMN_RE.lastIndex = 0;
    while ((renameMatch = RENAME_COLUMN_RE.exec(stripped)) !== null) {
        const tableName = renameMatch[1].toLowerCase();
        const fromCol = renameMatch[2].toLowerCase();
        const toCol = renameMatch[3].toLowerCase();
        // Skip RENAME TABLE forms (handled in applySqlEffects). Pattern
        // requires a column-name token between table and TO; for table
        // renames that token would actually be the new table's name,
        // which still slots in here harmlessly only if the table appears
        // in our column map (which would be wrong). Guard explicitly:
        // a RENAME TO that names a managed-table-rename has the same
        // shape — distinguish by checking whether `fromCol` exists as a
        // column in the table's set.
        const bucket = byTable.get(tableName);
        if (bucket === undefined) continue;
        if (!bucket.has(fromCol)) continue;
        bucket.delete(fromCol);
        bucket.add(toCol);
    }

    // Mirror table-level RENAME so column buckets follow the table.
    ALTER_RENAME_RE.lastIndex = 0;
    let tRenameMatch: RegExpExecArray | null;
    while ((tRenameMatch = ALTER_RENAME_RE.exec(stripped)) !== null) {
        const fromTable = tRenameMatch[1].toLowerCase();
        const toTable = tRenameMatch[2].toLowerCase();
        const oldBucket = byTable.get(fromTable);
        if (oldBucket === undefined) continue;
        byTable.delete(fromTable);
        byTable.set(toTable, oldBucket);
    }
}

function deriveSqlColumnsByTable(): Map<string, Set<string>> {
    const byTable = new Map<string, Set<string>>();

    if (!fs.existsSync(INIT_SQL_PATH)) {
        logError(`❌ init.sql missing at ${INIT_SQL_PATH}`);
        process.exit(EXIT_FILE_MISSING);
    }

    applySqlColumnEffects(fs.readFileSync(INIT_SQL_PATH, 'utf8'), byTable);

    if (fs.existsSync(MIGRATIONS_DIR)) {
        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();
        for (const file of files) {
            applySqlColumnEffects(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'), byTable);
        }
    }

    return byTable;
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

        // ─── COLUMN-LEVEL THREE-WAY VERIFICATION (v14.0) ────────────────
        //
        // Pull (table, column) tuples from the live DB, derive the same
        // map from init.sql + migrations, and read the manifest. Diff
        // each pair direction. Toleration entries suppress findings for
        // their (table, column) tuple until expiresOn.
        const colsRes = await client.query<{ table_name: string; column_name: string }>(`
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = $1
              AND table_name IN (
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = $1
                  AND table_type = 'BASE TABLE'
                  AND table_name NOT LIKE 'pg_stat_%'
              )
        `, ['public']);

        const dbColsByTable = new Map<string, Set<string>>();
        for (const row of colsRes.rows) {
            const t = row.table_name.toLowerCase();
            const c = row.column_name.toLowerCase();
            let bucket = dbColsByTable.get(t);
            if (bucket === undefined) {
                bucket = new Set<string>();
                dbColsByTable.set(t, bucket);
            }
            bucket.add(c);
        }

        const sqlColsByTable = deriveSqlColumnsByTable();
        const manifestColsByTable = getManifestColumns();
        const toleratedColumns = getToleratedColumnSet();

        const isTolerated = (table: string, column: string): boolean =>
            toleratedColumns.has(`${table}.${column}`);

        const columnsMissingFromDb: ColumnDriftFinding[] = [];
        const columnsMissingFromSql: ColumnDriftFinding[] = [];
        const columnsMissingFromManifest: ColumnDriftFinding[] = [];
        const columnsRogueInDb: ColumnDriftFinding[] = [];

        // Drift dimension 1: manifest declares a column → must be in DB and SQL.
        for (const [table, manifestCols] of manifestColsByTable) {
            const dbCols = dbColsByTable.get(table) ?? new Set<string>();
            const sqlCols = sqlColsByTable.get(table) ?? new Set<string>();
            for (const col of manifestCols) {
                if (isTolerated(table, col)) continue;
                if (!dbCols.has(col)) {
                    columnsMissingFromDb.push({
                        table,
                        column: col,
                        resolution: `Run the pending migration that adds '${table}.${col}', OR remove the column from tableColumns and author a DROP migration if obsolete.`,
                    });
                }
                if (!sqlCols.has(col)) {
                    columnsMissingFromSql.push({
                        table,
                        column: col,
                        resolution: `Add '${col}' to ${table}'s CREATE TABLE in init.sql or to a migration. The manifest declares it but no SQL does.`,
                    });
                }
            }
        }

        // Drift dimension 2: SQL declares a column → must be in manifest.
        for (const [table, sqlCols] of sqlColsByTable) {
            const manifestCols = manifestColsByTable.get(table) ?? new Set<string>();
            for (const col of sqlCols) {
                if (isTolerated(table, col)) continue;
                if (!manifestCols.has(col)) {
                    columnsMissingFromManifest.push({
                        table,
                        column: col,
                        resolution: `Add '${col}' to SCHEMA_MANIFEST.tableColumns['${table}'], OR add a toleratedColumns entry with reason+expiry, OR drop it from init.sql/migrations.`,
                    });
                }
            }
        }

        // Drift dimension 3: DB has a column that no surface declares.
        for (const [table, dbCols] of dbColsByTable) {
            const manifestCols = manifestColsByTable.get(table) ?? new Set<string>();
            const sqlCols = sqlColsByTable.get(table) ?? new Set<string>();
            for (const col of dbCols) {
                if (isTolerated(table, col)) continue;
                if (!manifestCols.has(col) && !sqlCols.has(col)) {
                    columnsRogueInDb.push({
                        table,
                        column: col,
                        resolution: `Add '${col}' to manifest+init.sql, OR add a toleratedColumns entry with reason+expiry, OR DROP COLUMN from the database.`,
                    });
                }
            }
        }

        const expiredColumnTolerations: ToleratedColumnEntry[] = SCHEMA_MANIFEST.toleratedColumns
            .filter(t => t.expiresOn < today)
            .map(t => ({
                table: t.table,
                column: t.column,
                reason: t.reason,
                expiresOn: t.expiresOn,
                owner: t.owner,
            }));

        const sumSizes = (m: Map<string, Set<string>>): number => {
            let n = 0;
            for (const set of m.values()) n += set.size;
            return n;
        };

        return {
            missingFromDb,
            missingFromSql,
            missingFromManifest,
            rogueInDb,
            expiredTolerations,
            expectedFromManifest: [...expectedFromManifest].sort(),
            declaredInSql: [...declaredInSql].sort(),
            presentInDb: [...presentInDb].sort(),
            columnsMissingFromDb,
            columnsMissingFromSql,
            columnsMissingFromManifest,
            columnsRogueInDb,
            expiredColumnTolerations,
            columnTotals: {
                manifest: sumSizes(manifestColsByTable),
                sql: sumSizes(sqlColsByTable),
                db: sumSizes(dbColsByTable),
            },
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
    logInfo(`📊 Column census — manifest:${report.columnTotals.manifest}  sql:${report.columnTotals.sql}  db:${report.columnTotals.db}`);

    const totalTableIssues =
        report.missingFromDb.length +
        report.missingFromSql.length +
        report.missingFromManifest.length +
        report.rogueInDb.length +
        report.expiredTolerations.length;

    const totalColumnIssues =
        report.columnsMissingFromDb.length +
        report.columnsMissingFromSql.length +
        report.columnsMissingFromManifest.length +
        report.columnsRogueInDb.length +
        report.expiredColumnTolerations.length;

    const totalIssues = totalTableIssues + totalColumnIssues;

    if (totalIssues === 0) {
        logInfo('');
        logInfo('✅ Three-way Verification: PASSED');
        logInfo('   manifest ↔ init.sql ↔ database — all aligned at table AND column grain.');
        if (SCHEMA_MANIFEST.tolerated.length > 0) {
            logInfo('');
            logInfo(`   ⚠ ${SCHEMA_MANIFEST.tolerated.length} active table toleration(s) — expiring soon should be acted on:`);
            for (const t of SCHEMA_MANIFEST.tolerated) {
                logInfo(`     - ${t.name}  expires ${t.expiresOn}  (${t.owner})`);
            }
        }
        if (SCHEMA_MANIFEST.toleratedColumns.length > 0) {
            logInfo('');
            logInfo(`   ⚠ ${SCHEMA_MANIFEST.toleratedColumns.length} active column toleration(s):`);
            for (const t of SCHEMA_MANIFEST.toleratedColumns) {
                logInfo(`     - ${t.table}.${t.column}  expires ${t.expiresOn}  (${t.owner})`);
            }
        }
        return true;
    }

    logError('');
    logError('❌ SCHEMA GOVERNANCE BREACH: drift detected across surfaces.');

    // ─── Table-level findings (existing v13 surface) ──────────────────────
    if (report.missingFromDb.length > 0) {
        logError('');
        logError('⚠ Missing TABLE in database (declared in manifest):');
        for (const f of report.missingFromDb) {
            logError(`   - ${f.table}  [domain: ${f.domain}]`);
            logError(`     ► ${f.resolution}`);
        }
    }

    if (report.missingFromSql.length > 0) {
        logError('');
        logError('⚠ Missing TABLE in init.sql/migrations (declared in manifest):');
        for (const f of report.missingFromSql) {
            logError(`   - ${f.table}  [domain: ${f.domain}]`);
            logError(`     ► ${f.resolution}`);
        }
    }

    if (report.missingFromManifest.length > 0) {
        logError('');
        logError('⚠ TABLE declared in init.sql but NOT in manifest:');
        for (const f of report.missingFromManifest) {
            logError(`   - ${f.table}`);
            logError(`     ► ${f.resolution}`);
        }
    }

    if (report.rogueInDb.length > 0) {
        logError('');
        logError('⚠ TABLE present in database but unknown to manifest/init.sql:');
        for (const f of report.rogueInDb) {
            logError(`   - ${f.table}`);
            logError(`     ► ${f.resolution}`);
        }
    }

    if (report.expiredTolerations.length > 0) {
        logError('');
        logError('🕒 EXPIRED table tolerations:');
        for (const t of report.expiredTolerations) {
            logError(`   - ${t.name}  expired ${t.expiresOn}  (owner: ${t.owner})`);
            logError(`     ► reason: ${t.reason}`);
            logError(`     ► author the DROP migration NOW or extend with explicit re-approval.`);
        }
    }

    // ─── Column-level findings (v14 surface) ──────────────────────────────
    if (report.columnsMissingFromDb.length > 0) {
        logError('');
        logError('⚠ Missing COLUMN in database (declared in manifest):');
        for (const f of report.columnsMissingFromDb) {
            logError(`   - ${f.table}.${f.column}`);
            logError(`     ► ${f.resolution}`);
        }
    }

    if (report.columnsMissingFromSql.length > 0) {
        logError('');
        logError('⚠ Missing COLUMN in init.sql/migrations (declared in manifest):');
        for (const f of report.columnsMissingFromSql) {
            logError(`   - ${f.table}.${f.column}`);
            logError(`     ► ${f.resolution}`);
        }
    }

    if (report.columnsMissingFromManifest.length > 0) {
        logError('');
        logError('⚠ COLUMN declared in SQL but NOT in manifest:');
        for (const f of report.columnsMissingFromManifest) {
            logError(`   - ${f.table}.${f.column}`);
            logError(`     ► ${f.resolution}`);
        }
    }

    if (report.columnsRogueInDb.length > 0) {
        logError('');
        logError('⚠ COLUMN present in database but unknown to manifest+SQL:');
        for (const f of report.columnsRogueInDb) {
            logError(`   - ${f.table}.${f.column}`);
            logError(`     ► ${f.resolution}`);
        }
    }

    if (report.expiredColumnTolerations.length > 0) {
        logError('');
        logError('🕒 EXPIRED column tolerations:');
        for (const t of report.expiredColumnTolerations) {
            logError(`   - ${t.table}.${t.column}  expired ${t.expiresOn}  (owner: ${t.owner})`);
            logError(`     ► reason: ${t.reason}`);
            logError(`     ► author the DROP / ALTER migration NOW or extend with explicit re-approval.`);
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
            const anyExpired =
                report.expiredTolerations.length > 0
                || report.expiredColumnTolerations.length > 0;
            const exitCode = anyExpired ? EXIT_EXPIRED_TOLERATION : EXIT_DRIFT;
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
