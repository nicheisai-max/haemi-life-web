const { Pool } = require('pg');
const pool = new Pool({ 
    connectionString: 'postgres://postgres:Deepti%408143@localhost:5432/digital_health_pharmacy_hub' 
});

async function extract() {
    const report = {
        tables: {},
        relationships: {},
        drift_issues: [],
        duplicate_conversations: [],
        presence_status: {},
        risk_level: "P0"
    };

    try {
        // 1. ALL TABLES & COLUMNS (TASK 1.1, 1.2)
        const colRes = await pool.query(`
            SELECT table_name, column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
        `);
        
        colRes.rows.forEach(row => {
            if (!report.tables[row.table_name]) report.tables[row.table_name] = { columns: [], constraints: [], indexes: [], samples: [] };
            report.tables[row.table_name].columns.push({
                name: row.column_name,
                type: row.data_type,
                nullable: row.is_nullable,
                default: row.column_default
            });
        });

        // 2. CONSTRAINTS & RELATIONSHIPS (TASK 1.3, 2.3)
        const conRes = await pool.query(`
            SELECT
                tc.table_name, 
                tc.constraint_name, 
                tc.constraint_type,
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            LEFT JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            WHERE tc.table_schema = 'public'
        `);
        
        conRes.rows.forEach(row => {
            if (report.tables[row.table_name]) {
                report.tables[row.table_name].constraints.push({
                    name: row.constraint_name,
                    type: row.constraint_type,
                    column: row.column_name,
                    foreign_table: row.foreign_table_name,
                    foreign_column: row.foreign_column_name
                });
            }
        });

        // 3. INDEXES (TASK 1.4)
        const idxRes = await pool.query(`
            SELECT
                t.relname as table_name,
                i.relname as index_name,
                a.attname as column_name
            FROM
                pg_class t,
                pg_class i,
                pg_index ix,
                pg_attribute a
            WHERE
                t.oid = ix.indrelid
                AND i.oid = ix.indexrelid
                AND a.attrelid = t.oid
                AND a.attnum = ANY(ix.indkey)
                AND t.relkind = 'r'
                AND t.relname NOT LIKE 'pg_%'
                AND t.relname NOT LIKE 'sql_%'
            ORDER BY
                t.relname,
                i.relname;
        `);
        idxRes.rows.forEach(row => {
            if (report.tables[row.table_name]) {
                report.tables[row.table_name].indexes.push({
                    name: row.index_name,
                    column: row.column_name
                });
            }
        });

        // 4. FOCUS TABLES SAMPLES (TASK 2)
        const focusTables = ['users', 'conversations', 'conversation_participants', 'messages', 'active_connections'];
        for (const table of focusTables) {
            if (report.tables[table]) {
                const cols = report.tables[table].columns
                    .filter(c => c.type !== 'bytea' && !c.name.includes('data'))
                    .map(c => c.name)
                    .join(', ');
                
                if (cols) {
                    const sampleRes = await pool.query(`SELECT ${cols} FROM ${table} LIMIT 5`);
                    report.tables[table].samples = sampleRes.rows;
                }
            }
        }

        // 5. CONVERSATION DUPLICATION ANALYSIS (TASK 4)
        const dupRes = await pool.query(`
            WITH ParticipantLists AS (
                SELECT 
                    conversation_id, 
                    string_agg(user_id::text, ',' ORDER BY user_id) as p_list
                FROM conversation_participants
                GROUP BY conversation_id
            )
            SELECT p_list, array_agg(conversation_id) as conv_ids, COUNT(*) as thread_count
            FROM ParticipantLists
            GROUP BY p_list
            HAVING COUNT(*) > 1
        `);
        report.duplicate_conversations = dupRes.rows;

        // 6. PRESENCE SYSTEM VALIDATION (TASK 5)
        const presenceTableRes = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'active_connections'
            );
        `);
        report.presence_status.exists = presenceTableRes.rows[0].exists;
        
        if (report.presence_status.exists) {
            const presSample = await pool.query(`SELECT * FROM active_connections LIMIT 5`);
            report.presence_status.samples = presSample.rows;
        } else {
            report.drift_issues.push("MISSING_TABLE: active_connections (Critical infrastructure gap detected)");
        }

        console.log(JSON.stringify(report, null, 2));

    } catch (err) {
        console.error("Forensic Extraction Error:", err);
    } finally {
        pool.end();
    }
}

extract();
