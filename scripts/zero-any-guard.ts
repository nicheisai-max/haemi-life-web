import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 🩺 HAEMI LIFE — ZERO ANY GUARD (Cross-Platform TS)
 * Blocks commits containing 'any' in TypeScript/JavaScript files.
 */

function main() {
    try {
        const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
            .split('\n')
            .map(f => f.trim())
            .filter(f => f.match(/\.(ts|tsx|js|mjs|cjs)$/) && !f.startsWith('node_modules/'));

        if (stagedFiles.length === 0) {
            process.exit(0);
        }

        let violations = 0;
        const pattern = /:\s*any\b|<\s*any\s*>|\bas\s+any\b|=\s*any\b/;

        for (const file of stagedFiles) {
            if (!fs.existsSync(file)) continue;
            
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            
            lines.forEach((line, index) => {
                if (pattern.test(line)) {
                    console.log(`🚨 ZERO ANY POLICY VIOLATION detected in: ${file}:${index + 1}`);
                    console.log(`   Line: ${line.trim()}`);
                    console.log('─────────────────────────────────────────────────────────');
                    violations++;
                }
            });
        }

        if (violations > 0) {
            console.error(`❌ COMMIT BLOCKED: ${violations} violation(s) found.`);
            console.error("Enterprise Policy: All 'any' types must be replaced with strong types or 'unknown'.");
            process.exit(1);
        }

        console.log('✅ Zero Any Policy satisfied.');
        process.exit(0);
    } catch (err) {
        console.error('⚠️ Infrastructure error in Zero Any Guard:', err);
        process.exit(0); // Fail open for infrastructure issues to avoid blocking dev
    }
}

main();
