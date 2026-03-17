# 🩺 HAEMI LIFE: SAFE PUSH SYSTEM
# "Institutional Main Branch Protection"

$Branch = git rev-parse --abbrev-ref HEAD

if ($Branch -eq "main") {
    Write-Host "🛑 [SECURITY] PUSH BLOCKED: Direct push to 'main' is strictly prohibited." -ForegroundColor Red
    Write-Host "Action: Use 'git checkout -b ai-sandbox/<task>' and submit a Pull Request." -ForegroundColor Yellow
    exit 1
}

if (-not $Branch.StartsWith("ai-sandbox/")) {
    Write-Host "🛑 [POLICY] PUSH BLOCKED: Active branch '$Branch' does not follow 'ai-sandbox/*' naming convention." -ForegroundColor Red
    exit 1
}

Write-Host "🚀 [VALIDATION] Initiating Google-Grade Pre-Push Lifecycle..." -ForegroundColor Cyan

# 1. Identity & Schema Guards
Write-Host "   -> Verifying Canonical Identity..."
npm run identity:guard -- --staged
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "   -> Verifying Schema Lock..."
npm run schema:guard
if ($LASTEXITCODE -ne 0) { exit 1 }

# 2. Institutional Quality Gates (OFFLOADED TO CI)
# Canonical state and branch policy verified.

Write-Host "✅ [SAFE PUSH] Security gates passed. Pushing to remote..." -ForegroundColor Green
git push origin $Branch
