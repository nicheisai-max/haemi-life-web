#!/usr/bin/env node
/**
 * LARGE FILE GUARD — HAEMI LIFE ENTERPRISE GIT GOVERNANCE
 *
 * Blocks staged files larger than the configured thresholds from being committed.
 * Also blocks known forbidden file patterns (binaries, backups, archives).
 *
 * Rule 9: Prevent large file commits.
 * Policy: No single file >1MB. Warning at >500KB.
 *
 * Usage: node scripts/large-file-guard.js (run by pre-commit hook)
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Configuration ─────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;   // 1 MB — hard block
const WARN_FILE_SIZE_BYTES = 500 * 1024;        // 500 KB — warning

const FORBIDDEN_PATTERNS = [
  /node_modules\//,
  {
    pattern: /\.sql$/i,
    // Exception: Allow init.sql and migrations which are canonical schema sources
    isAllowed: (file) => file.includes('init.sql') || file.includes('migrations/')
  },
  /\.dump$/i,
  /\.zip$/i,
  /\.tar\.gz$/i,
  /\.tar\.bz2$/i,
  /\.rar$/i,
  /dist\//,
  /build\//,
  /coverage\//,
];

// ─── Main ──────────────────────────────────────────────────────────────────
function main() {
  let stagedFiles;

  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
    });
    stagedFiles = output.trim().split('\n').filter(Boolean);
  } catch {
    // Not inside a git repo or no staged files — safe to pass
    process.exit(0);
  }

  if (stagedFiles.length === 0) {
    process.exit(0);
  }

  console.log(`\n🔍 Haemi CI — Large File & Forbidden Pattern Guard`);
  console.log(`   Scanning ${stagedFiles.length} staged file(s)...`);
  console.log(`─────────────────────────────────────────────────────────`);

  const violations = [];
  const warnings = [];

  for (const file of stagedFiles) {
    // Check forbidden patterns
    for (const p of FORBIDDEN_PATTERNS) {
      const isRegex = p instanceof RegExp;
      const pattern = isRegex ? p : p.pattern;
      
      if (pattern.test(file)) {
        // If it's a whitelisting object, check the exception
        if (!isRegex && p.isAllowed && p.isAllowed(file)) {
          continue; 
        }

        violations.push({
          file,
          reason: `Forbidden path pattern matched: ${pattern}`,
        });
        break;
      }
    }

    // Check file size
    const absolutePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(absolutePath)) {
      const stats = fs.statSync(absolutePath);
      const sizeKB = (stats.size / 1024).toFixed(1);

      if (stats.size > MAX_FILE_SIZE_BYTES) {
        violations.push({
          file,
          reason: `File size ${sizeKB}KB exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / 1024}KB`,
        });
      } else if (stats.size > WARN_FILE_SIZE_BYTES) {
        warnings.push(`  ⚠  ${file} (${sizeKB}KB) — large file, consider using Git LFS`);
      }
    }
  }

  // Report warnings (non-blocking)
  if (warnings.length > 0) {
    console.warn(`\n⚠  Large file warnings (non-blocking):`);
    warnings.forEach((w) => console.warn(w));
  }

  // Report violations (blocking)
  if (violations.length > 0) {
    console.error(`\n🚨 COMMIT BLOCKED — Large file or forbidden pattern detected:`);
    console.error(`─────────────────────────────────────────────────────────`);
    violations.forEach((v) => {
      console.error(`  ✗ ${v.file}`);
      console.error(`    Reason: ${v.reason}`);
    });
    console.error(`\nEnterprise Policy: No files >1MB, no archives, no build artifacts, no node_modules.`);
    console.error(`If large assets are required, use GitHub Large File Storage (LFS).`);
    console.error(`─────────────────────────────────────────────────────────\n`);
    process.exit(1);
  }

  console.log(`✅ All staged files pass size and pattern checks.\n`);
  process.exit(0);
}

main();
