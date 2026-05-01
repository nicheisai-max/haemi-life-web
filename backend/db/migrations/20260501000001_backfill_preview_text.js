/**
 * Backfill `preview_text` for legacy rows that pre-date migration
 * 20260309000002_chat_preview_upgrade. Without this, the conversation-list
 * sidebar query falls back to "Start a conversation" for every thread whose
 * latest message was sent before the column existed.
 *
 * Strategy:
 *   - messages.preview_text  ← derived from messages.content
 *   - conversations.preview_text ← derived from the latest non-deleted
 *                                  message's resolved preview
 *
 * Encrypted content (the `enc:` prefix indicates the zero-knowledge
 * pass-through path used for end-to-end encrypted messages) is replaced
 * with the same sentinel string the live insert path uses.
 *
 * Idempotent: only updates rows where preview_text IS NULL OR = ''.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.raw(`
        UPDATE messages
           SET preview_text = CASE
                   WHEN content LIKE 'enc:%' THEN '[Encrypted Preview]'
                   ELSE content
               END
         WHERE (preview_text IS NULL OR preview_text = '')
           AND content IS NOT NULL
           AND content <> ''
    `);

    await knex.raw(`
        UPDATE conversations c
           SET preview_text = sub.derived_preview
          FROM (
              SELECT DISTINCT ON (m.conversation_id)
                     m.conversation_id,
                     CASE
                         WHEN m.content LIKE 'enc:%' THEN '[Encrypted Preview]'
                         ELSE COALESCE(NULLIF(m.preview_text, ''), m.content)
                     END AS derived_preview
                FROM messages m
               WHERE m.is_deleted = false
            ORDER BY m.conversation_id, m.created_at DESC
          ) AS sub
         WHERE c.id = sub.conversation_id
           AND (c.preview_text IS NULL OR c.preview_text = '')
           AND sub.derived_preview IS NOT NULL
           AND sub.derived_preview <> ''
    `);
};

/**
 * Backfills are not reversed: the historical NULL state carries no
 * information value and re-clearing the column would only re-trigger the
 * UI regression. Down is intentionally a no-op.
 *
 * @param { import("knex").Knex } _knex
 * @returns { Promise<void> }
 */
exports.down = function () {
    return Promise.resolve();
};
