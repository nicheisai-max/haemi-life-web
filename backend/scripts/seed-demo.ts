/**
 * Seed Demo Data Script
 * Populates database with Botswana-specific demo data for investor presentations
 */

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import pool from '../src/config/db';

const DEMO_PASSWORD = 'Demo@2026';

async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

async function seedDemoData() {
    console.log('🌱 Starting demo data seeding...\n');

    try {
        // Use process.cwd() to resolve paths relative to the project root
        const sqlPath = path.resolve(process.cwd(), 'src/utils/seed-demo-data.sql');

        if (!fs.existsSync(sqlPath)) {
            throw new Error(`SQL seed file not found at: ${sqlPath}`);
        }

        let sql = fs.readFileSync(sqlPath, 'utf8');

        // Hash the demo password
        const passwordHash = await hashPassword(DEMO_PASSWORD);
        console.log('🔐 Generated password hash for demo accounts\n');

        // Replace placeholder with actual hash
        sql = sql.replace(/\$2b\$10\$YourHashedPasswordHere/g, passwordHash);

        // Execute SQL
        console.log('📊 Executing seed SQL...');
        await pool.query(sql);

        console.log('\n✅ Demo data seeded successfully!\n');
        console.log('🔑 Login with: any demo account + password "Demo@2026"');
        console.log('   See DEMO_CREDENTIALS.md for full list\n');

    } catch (error) {
        console.error('❌ Error seeding demo data:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run seeding
seedDemoData();
