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

# 2. Institutional Pre-Push Backup
Write-Host "   -> Initiating Pre-Push Backup..."
$pgDumpPath = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
$archiveDir = Join-Path (Get-Location) "institutional_archives"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$archiveFile = Join-Path $archiveDir "haemi_prepush_backup_$($timestamp).sql"

if (-not (Test-Path $archiveDir)) { New-Item -ItemType Directory -Path $archiveDir -Force }

# Load credentials
$dbUser = "postgres"
$dbName = "digital_health_pharmacy_hub"
if (Test-Path ".env") {
    $envContent = Get-Content ".env" | ConvertFrom-StringData
    if ($envContent.DB_PASSWORD) { $env:PGPASSWORD = $envContent.DB_PASSWORD }
}

try {
    & $pgDumpPath -U $dbUser -h localhost -p 5432 -d $dbName -f $archiveFile 2>&1 | Out-Null
    if (Test-Path $archiveFile) {
        $size = (Get-Item $archiveFile).Length
        Write-Host "✅ [BACKUP] Corporate image created: haemi_prepush_backup_$($timestamp).sql ($([math]::Round($size / 1MB, 2)) MB)" -ForegroundColor Green
    } else {
        throw "Backup file generation failed."
    }
} catch {
    Write-Host "❌ [CRITICAL] Backup Failure: Push operation ABORTED for data safety." -ForegroundColor Red
    exit 1
}

# 3. Institutional Quality Gates (OFFLOADED TO CI)
# Canonical state and branch policy verified.

Write-Host "✅ [SAFE PUSH] Security gates passed. Pushing to remote..." -ForegroundColor Green
git push origin $Branch
