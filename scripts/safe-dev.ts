import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const BACKEND_DIR = path.resolve(__dirname, '../backend');
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');

function runCommand(command: string, args: string[], cwd: string, name: string): ChildProcess {
    console.log(`[ORCHESTRATOR] Starting ${name} in ${process.env.NODE_ENV || 'development'} mode...`);
    const child = spawn(command, args, {
        cwd,
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, FORCE_COLOR: 'true' }
    });

    child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
            console.error(`[ORCHESTRATOR] ${name} exited with code ${code}`);
            process.exit(code);
        }
    });

    return child;
}

async function start() {
    console.log('\n--- HAEMI LIFE SAFE-DEV ORCHESTRATOR ---\n');

    // Step 1: Preflight
    console.log('[STEP 1] Running Preflight Integrity Gate...');
    const preflight = spawn('npm', ['run', 'preflight'], { cwd: BACKEND_DIR, stdio: 'inherit', shell: true });

    const preflightExitCode = await new Promise((resolve) => preflight.on('exit', resolve));
    if (preflightExitCode !== 0) {
        console.error('[FATAL] Preflight failed. Startup aborted.');
        process.exit(1);
    }

    // Step 2: Start Backend
    console.log('[STEP 2] Starting Backend Server...');
    runCommand('npm', ['run', 'dev'], BACKEND_DIR, 'Backend');

    // Step 3: Wait for Health
    console.log('[STEP 3] Waiting for Backend to stabilize...');
    const waiter = spawn('npm', ['run', 'wait-for-backend'], { cwd: BACKEND_DIR, stdio: 'inherit', shell: true });
    const waiterExitCode = await new Promise((resolve) => waiter.on('exit', resolve));

    if (waiterExitCode !== 0) {
        console.error('[FATAL] Backend failed to stabilize. Startup aborted.');
        process.exit(1);
    }

    // Step 4: Start Frontend
    console.log('[STEP 4] Starting Frontend Server...');
    runCommand('npm', ['run', 'dev'], FRONTEND_DIR, 'Frontend');
}

start().catch(err => {
    console.error(`[FATAL] Orchestrator crashed: ${err.message}`);
    process.exit(1);
});
