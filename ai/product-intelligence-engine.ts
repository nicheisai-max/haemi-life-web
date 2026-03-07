import fs from 'fs';
import path from 'path';

const FRONTEND_SRC = 'frontend/src';
const REPORT_DIR = '.ai-system/reports';

interface Insight {
    type: 'ux' | 'design-system' | 'performance';
    file: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
}

interface ProductIntelligenceReport {
    timestamp: string;
    insights: Insight[];
}

function getFiles(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(filePath));
        } else if (filePath.endsWith('.tsx') || filePath.endsWith('.css')) {
            results.push(filePath);
        }
    });
    return results;
}

const DESIGN_TOKENS = {
    primary: ['#083E44', '#0E6B74', '#148C8B', '#1BA7A6', '#3FC2B5', '#6ED3C4', '#A7E6DB', '#D5F6F1', '#ECFCFA'],
    radius: ['12px', '8px', '999px']
};

function analyzeFile(file: string): Insight[] {
    const insights: Insight[] = [];
    const content = fs.readFileSync(file, 'utf-8');

    // Design System Drift
    const hexMatch = content.match(/#[0-9A-Fa-f]{6}/g);
    if (hexMatch) {
        hexMatch.forEach(hex => {
            if (!DESIGN_TOKENS.primary.includes(hex.toUpperCase())) {
                insights.push({
                    type: 'design-system',
                    file,
                    message: `Potential color token misuse: ${hex}`,
                    severity: 'medium'
                });
            }
        });
    }

    if (content.includes('border-radius:')) {
        const radiusMatch = content.match(/border-radius:\s*([^;]+)/g);
        radiusMatch?.forEach(m => {
            const value = m.split(':')[1].trim();
            if (!DESIGN_TOKENS.radius.includes(value)) {
                insights.push({
                    type: 'design-system',
                    file,
                    message: `Non-standard border radius: ${value}`,
                    severity: 'low'
                });
            }
        });
    }

    // UX Inconsistency
    if (content.includes('font-family:') && !content.includes('Roboto Flex') && !content.includes('Roboto Variable') && !content.includes('var(--font-roboto)')) {
        insights.push({
            type: 'ux',
            file,
            message: 'Non-standard font family detected.',
            severity: 'high'
        });
    }

    // Performance hints
    if (content.includes('useEffect') && !content.includes('[]')) {
        // Very basic hint
        insights.push({
            type: 'performance',
            file,
            message: 'Effect might be missing dependency array (potential re-render loop).',
            severity: 'medium'
        });
    }

    return insights;
}

async function runAnalysis() {
    console.log('🧠 Running AI Product Intelligence Engine...');
    const report: ProductIntelligenceReport = {
        timestamp: new Date().toISOString(),
        insights: []
    };

    const files = getFiles(FRONTEND_SRC);
    files.forEach(file => {
        report.insights.push(...analyzeFile(file));
    });

    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORT_DIR, 'product-intelligence.json'), JSON.stringify(report, null, 2));

    console.log(`✅ Intelligence analysis complete. ${report.insights.length} insights generated.`);
}

runAnalysis().catch(err => {
    console.error('❌ Product Intelligence Engine failed:', err);
    process.exit(1);
});
