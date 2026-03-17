import { spawn, execSync, ChildProcess } from 'child_process';
import path from 'path';
import * as net from 'net';

const BACKEND_DIR = path.resolve(__dirname, '../backend');
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');

const children: ChildProcess[] = [];

/**
 * Forcefully terminates any process listening on a specific port.
 */
function nukePort(port: number) {
    if (process.platform !== 'win32') return;

    try {
        const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' }) || '';
        const lines = output.split('\n').filter(line => line.includes('LISTENING'));

        const pids = new Set<string>();
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') pids.add(pid);
        });

        if (pids.size > 0) {
            console.log(`[NUKE] Port ${port} occupied by PID(s): ${Array.from(pids).join(', ')}. Terminating...`);
            pids.forEach(pid => {
                try {
                    execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
                } catch { }
            });
            // Socket release delay
            execSync('powershell -Command "Start-Sleep -Milliseconds 500"');
        }
    } catch { }
}

function cleanup() {
    console.log('\n[ORCHESTRATOR] Shutting down all processes...');
    children.forEach(child => {
        if (!child.killed) {
            if (process.platform === 'win32' && child.pid) {
                try { execSync(`taskkill /pid ${child.pid} /f /t`, { stdio: 'ignore' }); } catch { }
            } else {
                child.kill('SIGINT');
            }
        }
    });
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}

async function waitForPort(port: number, timeoutMs = 10000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await isPortAvailable(port)) return;
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

async function start() {
    console.log('\n=========================================');
    console.log('   HAEMI LIFE INSTUTIONAL ORCHESTRATOR   ');
    console.log('=========================================\n');

    // 0. Port Hygiene
    console.log('[STEP 0] Port Hygiene (Nuke Mode)...');
    nukePort(5000); 
    nukePort(5173); 
    await waitForPort(5000);
    console.log('[SUCCESS] Environment is clear.\n');

    // 1. Serialization Gates
    console.log('[STEP 1] Serialized Environment Activation...');
    try {
        console.log('   -> Preflight integrity check...');
        execSync('npm run preflight', { cwd: BACKEND_DIR, stdio: 'inherit' });
        
        console.log('   -> Database health check...');
        try {
            execSync('npm run db:health', { cwd: BACKEND_DIR, stdio: 'inherit' });
        } catch (dbErr) {
            console.error('\n⚠️  [WARN] Database health check failed. Retrying in 2 seconds...');
            execSync('powershell -Command "Start-Sleep -Seconds 2"');
            execSync('npm run db:health', { cwd: BACKEND_DIR, stdio: 'inherit' });
        }
    } catch (err) {
        console.error('\n[FATAL] Gating failure. Environment configuration is invalid.');
        console.error('Action: Verify .env variables and database availability.');
        process.exit(1);
    }
    console.log('[SUCCESS] Environment gates passed.\n');

    // 2. High-Performance FullStack Launch
    console.log('[STEP 2] Launching Deterministic Dev Environment...');
    const concurrentlyArgs = [
        '--kill-others',
        '--prefix', 'name',
        '-n', 'BACKEND,FRONTEND',
        '-c', 'green,cyan',
        '\"npm --prefix backend run dev\"',
        '\"npm --prefix frontend run dev\"'
    ];

    const orchestrator = spawn('npx', ['concurrently', ...concurrentlyArgs], {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
        shell: true
    });

    children.push(orchestrator);

    orchestrator.on('exit', (code) => {
        if (code !== 0) cleanup();
    });
}

start().catch(err => {
    console.error(`\n[FATAL] Orchestrator crashed: ${err.message}`);
    cleanup();
});
