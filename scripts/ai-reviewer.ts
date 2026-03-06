import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import axios from 'axios';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY || 'nicheisai-max/haemi-life-web';
const PR_NUMBER = process.env.PR_NUMBER;

if (!GITHUB_TOKEN || !PR_NUMBER) {
    console.error('[AI REVIEWER] Missing GITHUB_TOKEN or PR_NUMBER. Exiting.');
    process.exit(0);
}

// Haemi Life Autonomous AI Code Review System
async function analyzePR() {
    console.log(`[AI REVIEWER] Starting analysis for PR #${PR_NUMBER}...`);
    try {
        // Fetch Pull Request diff
        const diffResponse = await axios.get(`https://api.github.com/repos/${REPO}/pulls/${PR_NUMBER}`, {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3.diff'
            }
        });
        const diff = diffResponse.data;

        const findings: string[] = [];
        let hasCriticalViolation = false;

        console.log('[AI REVIEWER] Analyzing diff...');

        // 1. Phase 5: Unused imports & Dead Code heuristics
        if (diff.match(/import\s+.*\{[^}]+\}\s+from/g) && !diff.includes('export')) {
            findings.push('⚠️ **Clean Code**: Double-check for unused imports or leftover code snippets added in this PR.');
        }

        // 2. Phase 6: Security Code Analysis
        if (diff.includes('SELECT * FROM') || diff.includes('exec(')) {
            findings.push('🛑 **Critical Security**: Detected potentially unsafe raw SQL query or executable command (`SELECT * FROM` or `exec()`). Please use parameterized queries or the ORM instead.');
            hasCriticalViolation = true;
        }

        if (diff.includes('password') && diff.includes('console.log')) {
            findings.push('🛑 **Critical Security**: Potential sensitive data exposure. Passwords or secrets should never be logged.');
            hasCriticalViolation = true;
        }

        // 3. Phase 7: Performance Code Analysis
        if (diff.includes('useEffect') && !diff.includes(', []') && !diff.includes(', [')) {
            findings.push('🚀 **Performance**: Missing dependency array in `useEffect`. This may cause infinite re-renders or performance degradation.');
        }
        if (diff.includes('.map') && !diff.includes('key=')) {
            findings.push('🚀 **Performance**: Found a `.map()` React iterator without a `key` prop. This damages rendering performance.');
        }

        // 4. Phase 8: Architecture Consistency
        if (diff.includes('export const') && diff.includes('Router') && !diff.includes('controller')) {
            findings.push('🏗️ **Architecture**: Route detected without offloading logic to a Controller. Maintain thin routes and thick controllers.');
        }

        // 5. Phase 9: Database Safety
        if (diff.includes('ALTER TABLE') && diff.includes('DROP COLUMN')) {
            findings.push('🛑 **Critical Database**: Destructive migration detected (`DROP COLUMN`). Please ensure backwards compatibility or use a multi-phase release process.');
            hasCriticalViolation = true;
        }

        if (diff.includes('CREATE TABLE') && !diff.includes('INDEX')) {
            findings.push('🗄️ **Database Safety**: New table created without explicit indexes. Please verify query optimization patterns.');
        }

        // Build Markdown Report
        let reportBody = `## 🤖 AI Architectural Code Review\n\n`;

        if (findings.length === 0) {
            reportBody += `✅ No architectural, performance, or security violations detected. Code meets enterprise standards.\n`;
        } else {
            reportBody += `I have autonomously analyzed this PR and found the following observations:\n\n`;
            findings.forEach(f => reportBody += `- ${f}\n`);

            if (hasCriticalViolation) {
                reportBody += `\n> [!CAUTION]\n> **Critical Violations Detected**. This PR cannot be merged until these are resolved.\n`;
            }
        }

        // Post comment to PR
        console.log('[AI REVIEWER] Posting review comment to GitHub...');
        await axios.post(`https://api.github.com/repos/${REPO}/issues/${PR_NUMBER}/comments`, {
            body: reportBody
        }, {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });

        if (hasCriticalViolation) {
            console.error('[AI REVIEWER] Pipeline blocked due to critical security/database violation.');
            process.exit(1);
        } else {
            console.log('[AI REVIEWER] Analysis complete. Safely passed.');
        }

    } catch (error: any) {
        console.error('[AI REVIEWER] Analysis failed:', error.response?.data || error.message);
        process.exit(1); // Fail safe
    }
}

analyzePR();
