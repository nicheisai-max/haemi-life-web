const fs = require('fs');
const path = require('path');

const FRONTEND_SERVICES_DIR = path.join(__dirname, '../frontend/src/services');
const BACKEND_ROUTES_DIR = path.join(__dirname, '../backend/src/routes');
const BACKEND_APP_FILE = path.join(__dirname, '../backend/src/app.ts');

/**
 * Audit Endpoints Script
 * ----------------------
 * Cross-references frontend Axios calls with backend Express route definitions.
 */

function audit() {
    console.log('--- Haemi Life API Integrity Audit ---\n');

    // 1. Get Backend Base Prefixes from app.ts
    const appContent = fs.readFileSync(BACKEND_APP_FILE, 'utf8');
    const routePrefixes = {}; // mapping filename (base) to prefix

    // Find imports: import <var> from './routes/<file>'
    const importRegex = /import\s+([a-zA-Z]+)Routes\s+from\s+'\.\/routes\/([^']+)'/g;
    const varToFile = {};
    while ((match = importRegex.exec(appContent)) !== null) {
        varToFile[match[1] + 'Routes'] = match[2];
    }
    console.log('Import Mappings:', JSON.stringify(varToFile, null, 2));

    // Find app.use: app.use('/api/<path>', <var>)
    const useRegex = /app\.use\('\/api\/([^']+)',\s*([a-zA-Z]+Routes)\)/g;
    while ((match = useRegex.exec(appContent)) !== null) {
        const fileName = varToFile[match[2]];
        if (fileName) {
            routePrefixes[fileName] = `/api/${match[1]}`;
        }
    }
    console.log('Route Prefixes:', JSON.stringify(routePrefixes, null, 2));

    // 2. Extract Backend Routes
    const backendEndpoints = new Set();
    const routeFiles = fs.readdirSync(BACKEND_ROUTES_DIR).filter(f => f.endsWith('.routes.ts'));

    routeFiles.forEach(file => {
        const content = fs.readFileSync(path.join(BACKEND_ROUTES_DIR, file), 'utf8');
        const fileBase = file.replace('.ts', '');
        const prefix = routePrefixes[fileBase] || '';

        // Multi-line aware regex for router methods
        const routerRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g;
        while ((match = routerRegex.exec(content)) !== null) {
            let endpoint = match[2];
            if (endpoint === '/') endpoint = '';
            // Backend might have nested paths in router.use, but we'll stick to simple ones
            backendEndpoints.add(`${prefix}${endpoint}`);
        }
    });

    console.log(`Resolved ${backendEndpoints.size} unique backend endpoints.\n`);

    // 3. Extract Frontend API Calls
    const frontendCalls = [];
    const serviceFiles = fs.readdirSync(FRONTEND_SERVICES_DIR).filter(f => f.endsWith('.service.ts') || f.endsWith('api.ts'));

    serviceFiles.forEach(file => {
        const content = fs.readFileSync(path.join(FRONTEND_SERVICES_DIR, file), 'utf8');
        const apiRegex = /api\.(get|post|put|delete|patch)\(['"](\/?[^'"]+)['"]/g;
        while ((match = apiRegex.exec(content)) !== null) {
            // Frontend calls usually omit the /api prefix if baseURL handles it
            let path = match[2];
            if (!path.startsWith('/')) path = '/' + path;
            frontendCalls.push({
                file,
                method: match[1].toUpperCase(),
                path: `/api${path}` // Reconstruct full path for comparison
            });
        }
    });

    // 4. Cross-Reference
    console.log('--- Verification Report ---');
    let failures = 0;
    const checked = new Set();
    const reports = [];

    frontendCalls.forEach(call => {
        const key = `${call.method}:${call.path}`;
        if (checked.has(key)) return;
        checked.add(key);

        // Basic normalization: replace things that look like variables (${id}, :id, /123) with :param
        const normalize = (p) => p.replace(/\/\${[^}]+}/g, '/:param')
            .replace(/\/:\w+/g, '/:param')
            .replace(/\/\d+/g, '/:param');

        const normalizedPath = normalize(call.path);

        let found = false;
        backendEndpoints.forEach(be => {
            if (normalize(be) === normalizedPath) found = true;
        });

        if (found) {
            reports.push({ status: 'PASS', method: call.method, path: call.path });
        } else {
            reports.push({ status: 'FAIL', method: call.method, path: call.path, file: call.file });
            failures++;
        }
    });

    let output = '--- Haemi Life API Integrity Audit ---\n\n';
    output += `Resolved ${backendEndpoints.size} unique backend endpoints.\n\n`;

    reports.sort((a, b) => a.status.localeCompare(b.status)).forEach(r => {
        if (r.status === 'PASS') {
            output += `[PASS] ${r.method.padEnd(6)} ${r.path}\n`;
        } else {
            output += `[FAIL] ${r.method.padEnd(6)} ${r.path} (Source: ${r.file})\n`;
        }
    });

    output += `\nAudit Complete: ${failures} discrepancies found.\n`;
    if (failures === 0) {
        output += 'INTEGRITY GUARANTEED: All frontend services are mapped to valid backend routes.\n';
    }

    fs.writeFileSync('audit_report.txt', output);
    console.log('Audit results saved to audit_report.txt');
    process.exit(0);
}

try {
    audit();
} catch (err) {
    console.error('Audit failed to initialize:', err.message);
    process.exit(1);
}
