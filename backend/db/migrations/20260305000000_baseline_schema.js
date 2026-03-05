/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    // Baseline migration: This migration registers the current schema version
    // but does not execute any SQL, ensuring existing data remains untouched.
    return Promise.resolve();
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return Promise.resolve();
};
