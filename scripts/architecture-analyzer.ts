import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const COMPONENTS_DIR = 'frontend/src';
const REPORT_DIR = '.ai-system/reports';
const LINE_THRESHOLD = 300;

interface ArchitectureReport {
    timestamp: string;
    violations: number;
    oversizedComponents: string[];
    potentialDuplicates: string[];
    unusedModules: string[];
}

function getFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(filePath));
        } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
            results.push(filePath);
        }
    });
    return results;
}

function analyzeFile(filePath: string): { lines: number; isComponent: boolean } {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    const isComponent = filePath.includes('components') || content.includes('React') || content.includes('export const');
    return { lines, isComponent };
}

async function runAnalysis() {
    console.log('📐 Running AI Architecture Analysis...');
    const report: ArchitectureReport = {
        timestamp: new Date().toISOString(),
        violations: 0,
        oversizedComponents: [],
        potentialDuplicates: [],
        unusedModules: []
    };

    const files = getFiles(COMPONENTS_DIR);

    files.forEach(file => {
        const { lines, isComponent } = analyzeFile(file);

        if (isComponent && lines > LINE_THRESHOLD) {
            report.oversizedComponents.push(`${file} (${lines} lines)`);
            report.violations++;
        }

        // Basic duplication detection (very primitive)
        // In a real scenario, we'd use AST hashes
    });

    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORT_DIR, 'architecture-report.json'), JSON.stringify(report, null, 2));

    console.log(`✅ Analysis complete. ${report.violations} violations found.`);
    console.log(`📄 Report saved to ${path.join(REPORT_DIR, 'architecture-report.json')}`);
}

runAnalysis().catch(err => {
    console.error('❌ Architecture Analyzer failed:', err);
    process.exit(1);
});
