const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, '../.ci-stats-build.json');
const WARNING_THRESHOLD = 0.40; // 40%

const startTime = Date.now();

console.log('[PERFORMANCE GUARD] Starting enterprise build...');

const result = spawnSync('npm', ['run', 'build'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: true
});

const endTime = Date.now();
const durationMs = endTime - startTime;
const durationSec = durationMs / 1000;

console.log(`[PERFORMANCE GUARD] Build completed in ${durationSec.toFixed(2)}s`);

if (result.status !== 0) {
    console.error(`[PERFORMANCE GUARD] Build failed with exit code ${result.status}`);
    process.exit(result.status);
}

let previousDuration = null;
if (fs.existsSync(STATS_FILE)) {
    try {
        const stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
        previousDuration = stats.durationMs;
    } catch (e) {
        console.warn('[PERFORMANCE GUARD] Failed to parse previous build stats.');
    }
}

if (previousDuration) {
    const growth = (durationMs - previousDuration) / previousDuration;
    if (growth > WARNING_THRESHOLD) {
        console.warn(`::warning::[PERFORMANCE GUARD] Build time increased by ${(growth * 100).toFixed(2)}%! Previously: ${(previousDuration / 1000).toFixed(2)}s, Now: ${durationSec.toFixed(2)}s`);
    } else {
        console.log(`[PERFORMANCE GUARD] Build time change: ${(growth * 100).toFixed(2)}% compared to previous runs.`);
    }
}

fs.writeFileSync(STATS_FILE, JSON.stringify({ durationMs, timestamp: new Date().toISOString() }, null, 2));
