/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    // Phase 1: Add the capability flag (Non-destructive)
    const hasColumn = await knex.schema.hasColumn('doctor_profiles', 'can_video_consult');
    if (!hasColumn) {
        await knex.schema.alterTable('doctor_profiles', (table) => {
            table.boolean('can_video_consult').defaultTo(true).index();
        });
    }

    // Phase 2: Forensic Data Update for Physical-Only specialties
    // Using ILIKE ANY for robust matching across common specialty patterns
    await knex('doctor_profiles')
        .whereRaw("specialization ILIKE ANY (ARRAY['%eye%', '%ophthalm%', '%ortho%', '%dental%', '%ent%', '%surgeon%', '%surgery%', '%dentist%'])")
        .update({ can_video_consult: false });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    const hasColumn = await knex.schema.hasColumn('doctor_profiles', 'can_video_consult');
    if (hasColumn) {
        await knex.schema.alterTable('doctor_profiles', (table) => {
            table.dropColumn('can_video_consult');
        });
    }
};
