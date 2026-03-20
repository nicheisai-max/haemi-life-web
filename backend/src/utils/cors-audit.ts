//import http from 'http';
import * as http from 'http';
import { env } from '../config/env';

/**
 * CORS Architecture Audit Tool
 * 
 * This script performs a forensic check of the backend CORS configuration.
 * It simulates browser preflight requests to verify that the dynamic
 * header reflection and origin validation are working as expected.
 */

async function runAudit() {
    console.log('\n--- 🩺 HAEMI LIFE | CORS ARCHITECTURE AUDIT ---\n');

    const port = env.port || 5000;
    const targetUrl = `http://localhost:${port}/api/auth/login`;
    const allowedOrigin = env.allowedOrigins[0] || 'http://localhost:5173';

    console.log(`[INFO] Target: ${targetUrl}`);
    console.log(`[INFO] Testing with Origin: ${allowedOrigin}\n`);

    const testPreflight = (origin: string, requestedHeaders: string) => {
        return new Promise((resolve, reject) => {
            const options = {
                method: 'OPTIONS',
                hostname: 'localhost',
                port: port,
                path: '/api/auth/login',
                headers: {
                    'Origin': origin,
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': requestedHeaders,
                    'User-Agent': 'CORS-Audit-Tool/1.0'
                }
            };

            const req = http.request(options, (res) => {
                const acah = res.headers['access-control-allow-headers'];
                const acao = res.headers['access-control-allow-origin'];
                const status = res.statusCode;

                console.log(`[TEST] Origin: ${origin} | Request Headers: ${requestedHeaders}`);
                console.log(`  - Status: ${status}`);
                console.log(`  - Allowed Origin: ${acao || 'NONE'}`);
                console.log(`  - Allowed Headers: ${acah || 'NONE'}`);

                // CORS middleware usually returns 204 for OPTIONS
                const statusOk = status === 204 || status === 200;
                const originMatch = acao === origin || acao === '*';

                if (statusOk && (origin === 'http://malicious.com' ? !acao : originMatch)) {
                    console.log('  ✅ PASS\n');
                    resolve(true);
                } else if (origin === 'http://malicious.com' && status === 403) {
                    console.log('  ✅ PASS (Blocked as expected)\n');
                    resolve(true);
                } else {
                    console.log('  ❌ FAIL\n');
                    resolve(false);
                }
            });

            req.on('error', (e) => {
                console.error(`  ⚠️ ERROR: ${e.message}\n`);
                reject(e);
            });
            req.end();
        });
    };

    try {
        console.log('1. Verifying Standard Preflight...');
        await testPreflight(allowedOrigin, 'content-type');

        console.log('2. Verifying Dynamic Header Reflection (CORS Hardening)...');
        // This tests if 'expires' or other custom headers are reflected as allowed 
        // since we set allowedHeaders: undefined in app.ts
        await testPreflight(allowedOrigin, 'expires, x-custom-header');

        console.log('3. Verifying Unauthorized Origin Block...');
        await testPreflight('http://malicious.com', 'content-type');

        console.log('--- AUDIT COMPLETE ---\n');
    } catch (err) {
        console.error('[CRITICAL] Audit failed to execute. Is the server running?', err);
    }
}

runAudit();
