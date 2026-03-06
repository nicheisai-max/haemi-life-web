const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIST_DIR = path.join(__dirname, '../frontend/dist/assets');
const STATS_FILE = path.join(__dirname, '../.ci-stats-bundle.json');

const MAX_GZIP_SIZE_FAIL_KB = 1024; // 1MB Hard failure
const WARNING_SIZE_KB = 600; // Warning only
const GROWTH_WARNING_THRESHOLD = 0.15; // 15%

if (!fs.existsSync(DIST_DIR)) {
    console.warn(`[BUNDLE GUARD] Dist directory not found: ${DIST_DIR}. Skipping bundle check.`);
    process.exit(0);
}

const files = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.js') || f.endsWith('.css'));
let totalSize = 0;
let hasError = false;

const currentStats = {};

function getChunkGroup(filename) {
    // Strips out the vite hash e.g. index-DjkdqtN7.js -> index.js
    return filename.replace(/-[a-zA-Z0-9_-]+\.(js|css)$/, '.$1');
}

files.forEach(file => {
    const filePath = path.join(DIST_DIR, file);
    const content = fs.readFileSync(filePath);
    const gzipped = zlib.gzipSync(content);
    const sizeKB = gzipped.length / 1024;

    const chunkGroup = getChunkGroup(file);
    if (!currentStats[chunkGroup]) currentStats[chunkGroup] = 0;
    currentStats[chunkGroup] += sizeKB;
    totalSize += sizeKB;

    if (sizeKB > MAX_GZIP_SIZE_FAIL_KB) {
        console.error(`::error file=${filePath}::[BUNDLE GUARD] FAIL: ${file} is ${sizeKB.toFixed(2)}KB (gzipped), exceeding strict limit of ${MAX_GZIP_SIZE_FAIL_KB}KB`);
        hasError = true;
    } else if (sizeKB > WARNING_SIZE_KB) {
        console.warn(`::warning file=${filePath}::[BUNDLE GUARD] WARNING: ${file} is ${sizeKB.toFixed(2)}KB (gzipped), exceeding the ${WARNING_SIZE_KB}KB threshold, but under 1MB limit`);
    } else {
        console.log(`[BUNDLE GUARD] ${file}: ${sizeKB.toFixed(2)}KB (gzipped) - OK`);
    }
});

let previousStats = {};
if (fs.existsSync(STATS_FILE)) {
    try {
        previousStats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
    } catch (e) {
        console.warn('[BUNDLE GUARD] Failed to parse previous stats.');
    }
}

Object.keys(currentStats).forEach(chunkGroup => {
    if (previousStats[chunkGroup]) {
        const prevSize = previousStats[chunkGroup];
        const currentSize = currentStats[chunkGroup];
        const growth = (currentSize - prevSize) / prevSize;
        if (growth > GROWTH_WARNING_THRESHOLD) {
            console.warn(`::warning::[BUNDLE GUARD] WARNING: Module group ${chunkGroup} grew by ${(growth * 100).toFixed(2)}% (from ${prevSize.toFixed(2)}KB to ${currentSize.toFixed(2)}KB)`);
        }
    }
});

fs.writeFileSync(STATS_FILE, JSON.stringify(currentStats, null, 2));

console.log(`[BUNDLE GUARD] Total GZIP size: ${totalSize.toFixed(2)}KB`);

if (hasError) {
    console.error(`[BUNDLE GUARD] One or more bundles exceeded the maximum allowed strict size of ${MAX_GZIP_SIZE_FAIL_KB}KB.`);
    process.exit(1);
}
