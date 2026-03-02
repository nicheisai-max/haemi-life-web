import * as z from 'zod';
import { Pool } from 'pg';
import * as net from 'net';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env explicitly for the preflight script
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
    PORT: z.string().default('5000'),
    DB_USER: z.string(),
    DB_PASSWORD: z.string(),
    DB_HOST: z.string(),
    DB_PORT: z.string().default('5432'),
    DB_NAME: z.string(),
    JWT_SECRET: z.string(),
    GEMINI_API_KEY: z.string(),
    ENCRYPTION_KEY: z.string(),
});

async function checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err: { code: string }) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false);
            } else {
                resolve(true);
            }
        });
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}

async function runPreflight() {
    console.log('\n--- HAEMI LIFE PRE-RUNTIME INTEGRITY GATE ---');

    // 1. Validate ENV
    console.log('\n[PREFLIGHT] INFO: Validating environment variables...');
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error('[PREFLIGHT] ERROR: Invalid or missing environment variables:');
        result.error.issues.forEach(issue => {
            console.error(` - ${issue.path.join('.')}: ${issue.message}`);
        });
        process.exit(1);
    }
    console.log('[PREFLIGHT] SUCCESS: Environment variables validated.');

    // 2. Validate DB
    const config = result.data;
    console.log(`[PREFLIGHT] INFO: Validating DB connection to ${config.DB_NAME} on ${config.DB_HOST}...`);
    const pool = new Pool({
        user: config.DB_USER,
        password: config.DB_PASSWORD,
        host: config.DB_HOST,
        port: parseInt(config.DB_PORT),
        database: config.DB_NAME,
        connectionTimeoutMillis: 5000,
    });

    try {
        await pool.query('SELECT 1');
        console.log('[PREFLIGHT] SUCCESS: Database connectivity verified.');
    } catch (err: unknown) {
        const error = err as Error;
        console.error(`[PREFLIGHT] ERROR: Database connection failed: ${error.message}`);
        process.exit(1);
    } finally {
        await pool.end();
    }

    // 3. Check Port
    const portNum = parseInt(config.PORT);
    console.log(`[PREFLIGHT] INFO: Checking if port ${portNum} is available...`);
    const isAvailable = await checkPort(portNum);
    if (!isAvailable) {
        console.error(`[PREFLIGHT] ERROR: Port ${portNum} is already in use. Please stop any conflicting processes.`);
        process.exit(1);
    }
    console.log('[PREFLIGHT] SUCCESS: Port availability verified.');

    console.log('\n[PREFLIGHT] STATUS: PASS - All integrity checks successful.\n');
}

runPreflight().catch(err => {
    console.error('[PREFLIGHT] FATAL CRASH during preflight:', err);
    process.exit(1);
});
