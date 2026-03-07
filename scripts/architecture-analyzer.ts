import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const FRONTEND_SRC = 'frontend/src';
const REPORT_DIR = '.ai-system/reports';

interface Metrics {
    cyclomaticComplexity: number;
    dependencies: string[];
    lineCount: number;
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
        } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
            results.push(filePath);
        }
    });
    return results;
}

function analyzeAST(file: string): Metrics {
    const sourceCode = fs.readFileSync(file, 'utf-8');
    const sourceFile = ts.createSourceFile(file, sourceCode, ts.ScriptTarget.Latest, true);

    let complexity = 1;
    const dependencies: string[] = [];

    function visit(node: ts.Node) {
        // Cyclomatic Complexity markers
        if (ts.isIfStatement(node) ||
            ts.isForStatement(node) ||
            ts.isForInStatement(node) ||
            ts.isForOfStatement(node) ||
            ts.isWhileStatement(node) ||
            ts.isDoStatement(node) ||
            ts.isCaseClause(node) ||
            ts.isCatchClause(node) ||
            ts.isConditionalExpression(node)) {
            complexity++;
        }

        if (ts.isBinaryExpression(node)) {
            if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
                complexity++;
            }
        }

        if (ts.isImportDeclaration(node)) {
            const moduleSpecifier = node.moduleSpecifier.getText().replace(/['"]/g, '');
            dependencies.push(moduleSpecifier);
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    return {
        cyclomaticComplexity: complexity,
        dependencies: Array.from(new Set(dependencies)),
        lineCount: sourceCode.split('\n').length
    };
}

async function runAnalysis() {
    console.log('📐 Running Enhanced AST Architecture Analysis...');
    const files = getFiles(FRONTEND_SRC);
    const results: Record<string, Metrics> = {};
    let totalViolations = 0;

    files.forEach(file => {
        const metrics = analyzeAST(file);
        results[file] = metrics;

        // Enterprise thresholds
        if (metrics.cyclomaticComplexity > 15 || metrics.lineCount > 300) {
            totalViolations++;
        }
    });

    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORT_DIR, 'architecture-report.json'), JSON.stringify({
        timestamp: new Date().toISOString(),
        totalFiles: files.length,
        violations: totalViolations,
        analysis: results
    }, null, 2));

    console.log(`✅ AST Analysis complete. ${totalViolations} components flagged for complexity/size.`);
}

runAnalysis().catch(err => {
    console.error('❌ AST Architecture Analyzer failed:', err);
    process.exit(1);
});
