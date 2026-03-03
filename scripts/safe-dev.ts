import { spawn, execSync, ChildProcess } from 'child_process';
import path from 'path';
import * as net from 'net';

const BACKEND_DIR = path.resolve(__dirname, '../backend');
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');

const children: ChildProcess[] = [];

/**
 * Forcefully terminates any process listening on a specific port.
 * (Windows implementation using netstat and taskkill)
 */
function nukePort(port: number) {
    if (process.platform !== 'win32') return;

    try {
        const output = execSync(`netstat -ano | findstr :${port}`).toString();
        const lines = output.split('\n').filter(line => line.includes('LISTENING'));

        const pids = new Set<string>();
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') pids.add(pid);
        });

        if (pids.size > 0) {
            console.log(`[NUKE] Port ${port} is occupied by PID(s): ${Array.from(pids).join(', ')}. Terminating...`);
            pids.forEach(pid => {
                try {
                    execSync(`taskkill /F /PID ${pid} /T`);
                } catch {
                    // Ignore errors if process already exited
                }
            });
        }
    } catch {
        // execSync throws if findstr finds nothing; this is normal
    }
}

function cleanup() {
    console.log('\n[ORCHESTRATOR] Shutting down all processes...');
    children.forEach(child => {
        if (!child.killed) {
            if (process.platform === 'win32' && child.pid) {
                try {
                    execSync(`taskkill /pid ${child.pid} /f /t`);
                } catch { }
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

async function waitForPort(port: number, timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await isPortAvailable(port)) return;
        process.stdout.write('.');
        await new Promise(resolve => setTimeout(resolve, 200));
    }
}

function runCommand(command: string, args: string[], cwd: string, name: string): ChildProcess {
    console.log(`[ORCHESTRATOR] Starting ${name}...`);
    const child = spawn(command, args, {
        cwd,
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, FORCE_COLOR: 'true' }
    });

    child.on('exit', (code) => {
        if (code !== 0 && code !== null && !child.killed) {
            console.error(`[ORCHESTRATOR] ${name} exited with code ${code}`);
            cleanup();
        }
    });

    children.push(child);
    return child;
}

async function start() {
    console.log('\n=========================================');
    console.log('   HAEMI LIFE ROBUST DEV ORCHESTRATOR   ');
    console.log('=========================================\n');

    // Step 0: Initial Nuke
    console.log('[STEP 0] Ensuring clean slate (Nuke Mode)...');
    nukePort(5000); // Backend
    nukePort(5173); // Frontend
    console.log('[SUCCESS] Environment is clear.\n');

    // Step 1: Preflight
    console.log('[STEP 1] Running Preflight Integrity Gate...');
    const preflight = spawn('npm', ['run', 'preflight'], { cwd: BACKEND_DIR, stdio: 'inherit', shell: true });
    const preflightExitCode = await new Promise((resolve) => preflight.on('exit', resolve));

    if (preflightExitCode !== 0) {
        console.error('\n[FATAL] Preflight failed. Please check your .env and Database connection.');
        process.exit(1);
    }
    console.log('[SUCCESS] Integrity Gate passed.\n');

    // Step 2: Start Backend (Hidden for polling)
    console.log('[STEP 2] Initializing Backend Server...');
    const backendProcess = spawn('npm', ['run', 'dev'], {
        cwd: BACKEND_DIR,
        stdio: 'pipe',
        shell: true
    });
    children.push(backendProcess);

    // Step 3: Wait for Health
    console.log('[STEP 3] Waiting for Backend to stabilize (Health Check)...');
    const waiter = spawn('npm', ['run', 'wait-for-backend'], { cwd: BACKEND_DIR, stdio: 'inherit', shell: true });
    const waiterExitCode = await new Promise((resolve) => waiter.on('exit', resolve));

    if (waiterExitCode !== 0) {
        console.error('\n[FATAL] Backend failed to stabilize.');
        cleanup();
    }
    console.log('[SUCCESS] Backend is healthy.\n');

    // HARDENING PHASE: Ensure clean transition
    console.log('[HARDENING] Finalizing transition for FullStack mode...');

    const exitPromise = new Promise(resolve => backendProcess.on('exit', resolve));
    backendProcess.kill();
    if (process.platform === 'win32' && backendProcess.pid) {
        try { execSync(`taskkill /pid ${backendProcess.pid} /f /t`); } catch { }
    }
    await exitPromise;

    // Nuke port 5000 again just to be 100% sure before concurrently takes over
    nukePort(5000);

    process.stdout.write('[PORT GUARD] Waiting for OS release');
    await waitForPort(5000);
    console.log('\n[SUCCESS] Systems ready.\n');

    // Step 4: Final Phase
    console.log('[STEP 4] Launching High-Performance Dev Mode...');
    console.log('--------------------------------------------------');
    console.log('FRONTEND UI: http://localhost:5173');
    console.log('BACKEND API: http://localhost:5000');
    console.log('--------------------------------------------------\n');

    const finalArgs = [
        '--kill-others',
        '--prefix', 'name',
        '-n', 'BACKEND,FRONTEND',
        '-c', 'green,cyan',
        '\"npm --prefix backend run dev\"',
        '\"npm --prefix frontend run dev\"'
    ];

    runCommand('npx', ['concurrently', ...finalArgs], path.resolve(__dirname, '..'), 'FullStack');
}

start().catch(err => {
    console.error(`\n[FATAL] Orchestrator crashed: ${err.message}`);
    cleanup();
});

