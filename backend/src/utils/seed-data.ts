import { pool } from '../config/db';
import fs from 'fs';
import path from 'path';

async function seedBotswanaData() {
    console.log('🇧🇼 Seeding Botswana specific data...\n');

    try {
        const sqlPath = path.join(__dirname, 'seed-botswana-data.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await pool.query(sql);

        console.log('✅ Locations seeded (Cities, Towns, Villages)');
        console.log('✅ Medicines seeded');
        console.log('✅ Pharmacies seeded');
        console.log('\n✨ Botswana data seeding completed successfully!\n');
    } catch (error) {
        console.error('❌ Error seeding data:', error);
    } finally {
        await pool.end();
    }
}

seedBotswanaData();
