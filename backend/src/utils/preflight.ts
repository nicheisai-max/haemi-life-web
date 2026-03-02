import { z } from 'zod';
import { Pool } from 'pg';
import net from 'net';
import path from 'path';
import dotenv from 'dotenv';

// Load .env explicitly for the preflight script
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
    PORT: z.string().default('5000'),
    DB_USER: z.string(),
    DB_PASSWORD: z.string(),
    DB_HOST: z.string(),
    DB_PORT: z.string(),
    DB_NAME: z.string(),
    JWT_SECRET: z.string(),
    GEMINI_API_KEY: z.string(),
    ENCRYPTION_KEY: z.string(),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

type EnvConfig = z.infer<typeof envSchema>;

const logger = {
    info: (msg: string) => console.log(`[PREFLIGHT] INFO: ${msg}`),
    error: (msg: string) => console.error(`[PREFLIGHT] ERROR: ${msg}`),
    success: (msg: string) => console.log(`[PREFLIGHT] SUCCESS: ${msg}`),
};

async function checkEnv(): Promise<EnvConfig> {
    logger.info('Validating environment variables...');
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        logger.error('Invalid environment configuration:');
        result.error.issues.forEach((issue) => {
            logger.error(`  - ${issue.path.join('.')}: ${issue.message}`);
        });
        process.exit(1);
    }
    logger.success('Environment variables validated.');
    return result.data;
}

async function checkDatabase(config: EnvConfig) {
    logger.info(`Validating DB connection to ${config.DB_NAME} on ${config.DB_HOST}...`);
    const pool = new Pool({
        user: config.DB_USER,
        host: config.DB_HOST,
        database: config.DB_NAME,
        password: config.DB_PASSWORD,
        port: parseInt(config.DB_PORT),
        connectionTimeoutMillis: 5000,
    });

    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        await pool.end();
        logger.success('Database connectivity verified.');
    } catch (err: any) {
        logger.error(`Database connection failed: ${err.message}`);
        process.exit(1);
    }
}

async function checkPort(port: number) {
    logger.info(`Checking if port ${port} is available...`);
    return new Promise<void>((resolve) => {
        const server = net.createServer();

        server.once('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                logger.error(`Port ${port} is already in use. Please stop any conflicting processes.`);
                process.exit(1);
            }
            logger.error(`Error checking port ${port}: ${err.message}`);
            process.exit(1);
        });

        server.once('listening', () => {
            server.close();
            logger.success(`Port ${port} is available.`);
            resolve();
        });

        server.listen(port);
    });
}

async function runPreflight() {
    console.log('\n--- HAEMI LIFE PRE-RUNTIME INTEGRITY GATE ---\n');
    
    const config = await checkEnv();
    await checkDatabase(config);
    await checkPort(parseInt(config.PORT));

    console.log('\n--- ALL SYSTEMS NOMINAL. STARTING BACKEND... ---\n');
}

runPreflight().catch((err) => {
    logger.error(`Preflight crashed: ${err.message}`);
    process.exit(1);
});
