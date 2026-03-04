import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import checkFile from "eslint-plugin-check-file";

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
        },
        plugins: {
            "check-file": checkFile,
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "error",
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
