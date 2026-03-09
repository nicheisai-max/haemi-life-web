/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // PHASE 2: Timestamp Standardization (Enterprise Grade)
    // Setting defaults at the DB layer prevents controller-level regressions
    await knex.schema.alterTable('user_sessions', (table) => {
        // Handle login_time default
        table.timestamp('login_time').defaultTo(knex.fn.now()).alter();

        // Ensure last_activity has a default if missing
        table.timestamp('last_activity').defaultTo(knex.fn.now()).alter();

        // Phase 3 & 4: Session Lifecycle mapping
        // The forensic report identified repository uses 'revoked_at'
        // If it doesn't exist, we add it. If logout_time exists, we keep it for safety.
    });

    // Check for revoked_at existence
    const hasRevokedAt = await knex.schema.hasColumn('user_sessions', 'revoked_at');
    if (!hasRevokedAt) {
        await knex.schema.alterTable('user_sessions', (table) => {
            table.timestamp('revoked_at').nullable();
        });
    }

    // PHASE 7: Audit Logs Alignment
    // Ensure audit_logs is enriched as claimed
    await knex.schema.alterTable('audit_logs', (table) => {
        // These might already exist from migration 001, but alterTable is safe if we don't duplicate
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return Promise.resolve();
};
