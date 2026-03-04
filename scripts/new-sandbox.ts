#!/usr/bin/env tsx
/**
 * Enterprise Sandbox Branch Helper
 * Usage: npm run sandbox -- <task-name>
 * Creates: ai/sandbox-<task-name>-<YYYY-MM-DD>
 *
 * This script follows the enterprise AI development workflow:
 * All work must occur in isolated sandbox branches, never on main.
 */

import { execSync } from "child_process";

const taskArg = process.argv[2];

if (!taskArg) {
    console.error("\n❌ Missing task name.\n");
    console.error("Usage: npm run sandbox -- <task-name>");
    console.error("Example: npm run sandbox -- auth-fix\n");
    process.exit(1);
}

// Sanitize to kebab-case
const task = taskArg
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Date in YYYY-MM-DD format
const now = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

const branchName = `ai/sandbox-${task}-${date}`;

console.log(`\n🚀 Creating sandbox branch: ${branchName}\n`);

try {
    // Ensure we're not on a dirty tree
    const status = execSync("git status --porcelain", { encoding: "utf-8" });
    if (status.trim()) {
        console.warn("⚠️  Working tree has uncommitted changes. Sandbox branch will include them.");
    }

    // Enterprise safe start: always branch from latest origin/main
    execSync("git fetch origin", { stdio: "inherit" });
    execSync("git checkout main", { stdio: "inherit" });
    execSync("git reset --hard origin/main", { stdio: "inherit" });

    // Create and checkout the branch
    execSync(`git checkout -b ${branchName}`, { stdio: "inherit" });

    console.log(`\n✅ Sandbox branch ready: ${branchName}`);
    console.log("─────────────────────────────────────────");
    console.log("ENTERPRISE WORKFLOW:");
    console.log("  1. Implement your changes in this branch");
    console.log("  2. npm run type-check");
    console.log("  3. npm run lint");
    console.log("  4. npm run test:ci");
    console.log("  5. npm run build");
    console.log("  6. When all pass → COMMIT (user approval)");
    console.log("  7. PUSH → open PR → CI gate runs → merge");
    console.log("─────────────────────────────────────────\n");
} catch (error) {
    console.error(`\n❌ Failed to create branch: ${branchName}`);
    console.error("Tip: Does this branch already exist? Try a different task name.\n");
    process.exit(1);
}
