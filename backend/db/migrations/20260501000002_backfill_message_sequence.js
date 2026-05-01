/**
 * Backfill `messages.sequence_number` for rows where it is NULL.
 *
 * Background: `chatReliabilityService.getNextSequence` is the only sanctioned
 * path for assigning sequence numbers on insert (chat.controller.ts:472).
 * Seed scripts and ad-hoc fixtures inserted historical rows with NULL
 * sequence_number, which broke two invariants:
 *
 *   1. Pagination cursor `m.sequence_number < $cursor::bigint` evaluates to
 *      NULL for these rows — they silently disappear from "load older"
 *      queries.
 *   2. Frontend comparators that key on sequence_number (with `|| 0`
 *      coercion) sink them to the top of an ascending sort, rendering the
 *      newest messages as the oldest in the chat thread.
 *
 * Strategy: per-conversation, walk the NULL-sequence rows in `created_at`
 * order and assign monotonic numbers continuing from the existing
 * MAX(sequence_number) for that conversation. This preserves the
 * invariant that sequence_number agrees with created_at within a thread,
 * so pagination cursors and gap-detection logic continue to work.
 *
 * Idempotent: only updates rows where sequence_number IS NULL.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.raw(`
        WITH per_conversation_floor AS (
            SELECT conversation_id,
                   COALESCE(MAX(sequence_number), 0) AS max_seq
              FROM messages
             WHERE sequence_number IS NOT NULL
          GROUP BY conversation_id
        ),
        ranked_nulls AS (
            SELECT m.id,
                   m.conversation_id,
                   ROW_NUMBER() OVER (
                       PARTITION BY m.conversation_id
                       ORDER BY m.created_at, m.id
                   ) AS rn
              FROM messages m
             WHERE m.sequence_number IS NULL
        )
        UPDATE messages m
           SET sequence_number = COALESCE(f.max_seq, 0) + r.rn
          FROM ranked_nulls r
     LEFT JOIN per_conversation_floor f ON f.conversation_id = r.conversation_id
         WHERE m.id = r.id
           AND m.sequence_number IS NULL
    `);
};

/**
 * Down is intentionally a no-op: backfilled sequence numbers carry no
 * information that can be losslessly reverted, and re-introducing NULLs
 * would re-trigger the pagination and ordering bugs the up-migration
 * fixed.
 *
 * @param { import("knex").Knex } _knex
 * @returns { Promise<void> }
 */
exports.down = function () {
    return Promise.resolve();
};
