import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import checkFile from "eslint-plugin-check-file";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";

/**
 * 🛡️ HAEMI LIFE — Backend ESLint Configuration (Iron Curtain Layer 2)
 *
 * This config enforces the institutional engineering protocol declared
 * in HAEMI_PROTOCOL.md. The forbidden patterns listed there (F1–F13)
 * are mechanically rejected here; nobody — human or AI — can write code
 * that bypasses these rules without explicitly editing this file, which
 * requires CODEOWNERS approval.
 */
export default tseslint.config(
    { ignores: ["dist", "node_modules", "logs"] },
    // ─── TypeScript + General Rules (all .ts files) ───────────────────────
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ["**/*.ts"],
        languageOptions: {
            ecmaVersion: 2022,
            globals: {
                ...globals.node,
                ...globals.jest,
            },
            // Type-aware linting: required for rules that read TS type
            // information (e.g. @typescript-eslint/no-unnecessary-type-assertion).
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            "check-file": checkFile,
            "@eslint-community/eslint-comments": eslintComments,
        },
        rules: {
            // ─── HAEMI PROTOCOL §1: Forbidden Patterns ───────────────────
            // F6 / F7 / F8: any in any form
            "@typescript-eslint/no-explicit-any": "error",
            // F1 / F2 / F3 / F4: every @ts-* directive
            "@typescript-eslint/ban-ts-comment": ["error", {
                "ts-ignore": true,
                "ts-nocheck": true,
                "ts-expect-error": true,
                "ts-check": true,
                minimumDescriptionLength: 99999,
            }],
            // F9: unnecessary type assertions (catches redundant `as` casts
            // and many `as unknown as` flavors at the redundancy boundary)
            "@typescript-eslint/no-unnecessary-type-assertion": "error",
            // F13: non-null assertion (`x!`) — use a type guard or early return
            "@typescript-eslint/no-non-null-assertion": "error",
            // F5: every form of eslint-disable
            "@eslint-community/eslint-comments/no-use": ["error", { allow: [] }],
            "@eslint-community/eslint-comments/no-unlimited-disable": "error",
            "@eslint-community/eslint-comments/no-unused-disable": "error",
            "@eslint-community/eslint-comments/no-aggregating-enable": "error",
            "@eslint-community/eslint-comments/no-duplicate-disable": "error",

            // ─── Quality of Life ────────────────────────────────────────
            "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
            "no-console": "off",
            // Filename: kebab-case for all .ts source files
            // ignoreMiddleExtensions allows foo.middleware.ts, foo.test.ts etc.
            "check-file/filename-naming-convention": [
                "error",
                {
                    "src/**/*.ts": "KEBAB_CASE",
                },
                {
                    ignoreMiddleExtensions: true,
                },
            ],
        },
    },
    // ─── Folder Naming Rule (excludes __tests__ — Jest naming convention) ─
    {
        files: ["src/**/*.ts"],
        // Exclude the Jest __tests__ directory from folder naming enforcement.
        // __tests__ is the community-standard name and uses double underscores
        // by convention (not a valid kebab-case pattern by design).
        ignores: ["src/__tests__/**"],
        plugins: {
            "check-file": checkFile,
        },
        rules: {
            "check-file/folder-naming-convention": [
                "error",
                {
                    "src/**/": "KEBAB_CASE",
                },
            ],
        },
    }
);
