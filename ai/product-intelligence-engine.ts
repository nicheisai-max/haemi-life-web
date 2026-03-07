import fs from 'fs';
import path from 'path';

const FRONTEND_SRC = 'frontend/src';
const REPORT_DIR = '.ai-system/reports';

// Phase 2: Design Token Enforcement
const ALLOWED_COLORS = [
    'var(--primary)', 'var(--secondary)', 'var(--accent)', 'var(--destructive)',
    'var(--background)', 'var(--foreground)', 'var(--muted)', 'var(--border)',
    'var(--input)', 'var(--card)', 'var(--popover)', 'var(--sidebar)'
];

const HEX_REGEX = /#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/g;
const PX_REGEX = /\d+px/g;

function getFiles(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(filePath));
        } else if (file.match(/\.(tsx|ts|css)$/)) {
            results.push(filePath);
        }
    });
    return results;
}

async function runIntelligence() {
    console.log('🧠 Running AI Product Intelligence Engine...');
    const files = getFiles(FRONTEND_SRC);
    const insights: any[] = [];

    files.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');

        // 1. Detect Design System Drift (Hex codes)
        const hexMatches = content.match(HEX_REGEX);
        if (hexMatches && !file.endsWith('index.css') && !file.endsWith('variables.css')) {
            insights.push({
                type: 'DESIGN_SYSTEM_DRIFT',
                file,
                severity: 'medium',
                message: `Hardcoded hex values found: ${hexMatches.join(', ')}. Use CSS variables instead.`
            });
        }

        // 2. Performance: useEffect without deps (simplistic check)
        if (content.includes('useEffect(() => {') && !content.includes('}, [])')) {
            // This is a naive check but good for demonstration
            insights.push({
                type: 'PERFORMANCE_HINT',
                file,
                severity: 'low',
                message: 'Potential missing dependency array in useEffect.'
            });
        }
    });

    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORT_DIR, 'product-intelligence.json'), JSON.stringify({
        timestamp: new Date().toISOString(),
        totalInsights: insights.length,
        insights
    }, null, 2));

    console.log(`✅ Intelligence analysis complete. ${insights.length} insights generated.`);
}

runIntelligence().catch(err => {
    console.error('❌ Product Intelligence Engine failed:', err);
    process.exit(1);
});
