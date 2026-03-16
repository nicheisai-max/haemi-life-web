#!/bin/bash

# 🩺 HAEMI LIFE — ZERO ANY GUARD (Institutional Grade)
# Blocks commits containing 'any' in TypeScript/JavaScript files.

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|mjs|cjs)$')

if [ -z "$STAGED_FILES" ]; then
    exit 0
fi

VIOLATIONS=0

for file in $STAGED_FILES; do
    # Only scan source files, ignore node_modules
    if [[ $file == node_modules/* ]]; then continue; fi
    
    # Grep for ': any', 'as any', or '<any>'
    # We use a strict regex to avoid matching words like 'company' or comments
    MATCHES=$(grep -nE ':\s*any\b|<\s*any\s*>|\bas\s+any\b|=\s*any\b' "$file")
    
    if [ ! -z "$MATCHES" ]; then
        echo "🚨 ZERO ANY POLICY VIOLATION detected in: $file"
        echo "$MATCHES"
        echo "─────────────────────────────────────────────────────────"
        VIOLATIONS=$((VIOLATIONS + 1))
    fi
done

if [ $VIOLATIONS -gt 0 ]; then
    echo "❌ COMMIT BLOCKED: $VIOLATIONS file(s) violate the Zero Any Policy."
    echo "Enterprise Policy: All 'any' types must be replaced with strong types or 'unknown'."
    exit 1
fi

exit 0
