import { pool } from '../config/db';

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('🚀 Migrating user initials system...');
        await client.query('BEGIN');

        // 1. Add column if it doesn't exist
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='initials') THEN
                    ALTER TABLE users ADD COLUMN initials VARCHAR(4);
                END IF;
            END $$;
        `);

        // 2. Create/Update Function
        await client.query(`
            CREATE OR REPLACE FUNCTION fn_generate_initials(p_name TEXT) 
            RETURNS TEXT AS $$
            DECLARE
                parts TEXT[];
                v_clean_name TEXT;
                v_first TEXT;
                v_last TEXT;
            BEGIN
                -- Clean the name (remove titles and extra spaces)
                v_clean_name := trim(regexp_replace(p_name, '^(Dr\\.|Dr|Prof\\.|Prof|Mr\\.|Mr|Mrs\\.|Mrs|Ms\\.|Ms)\\s+', '', 'i'));
                parts := regexp_split_to_array(v_clean_name, '\\s+');
                
                IF array_length(parts, 1) = 0 THEN
                    RETURN 'U';
                ELSIF array_length(parts, 1) = 1 THEN
                    RETURN LEFT(UPPER(parts[1]), 2);
                ELSE
                    v_first := LEFT(UPPER(parts[1]), 1);
                    v_last := LEFT(UPPER(parts[array_length(parts, 1)]), 1);
                    RETURN v_first || v_last;
                END IF;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // 3. Create/Update Trigger Function
        await client.query(`
            CREATE OR REPLACE FUNCTION fn_update_user_initials()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.initials := fn_generate_initials(NEW.name);
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // 4. Create Trigger
        await client.query(`
            DROP TRIGGER IF EXISTS tr_user_initials ON users;
            CREATE TRIGGER tr_user_initials
            BEFORE INSERT OR UPDATE OF name ON users
            FOR EACH ROW
            EXECUTE FUNCTION fn_update_user_initials();
        `);

        // 5. Update Existing Records
        console.log('🔄 Updating initials for existing users...');
        await client.query(`
            UPDATE users 
            SET initials = fn_generate_initials(name)
            WHERE initials IS NULL OR initials = '';
        `);

        await client.query('COMMIT');
        console.log('✅ Migration successful: Initials populated and trigger active.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', e);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
