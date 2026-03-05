# Haemi Life — Automated Database Backup Script (Enterprise Governance)
# This script performs a full logical backup of the PostgreSQL database.

$pgDumpPath = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
$dbName = "digital_health_pharmacy_hub"
$dbUser = "postgres"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path (Get-Location) "backups"
$backupFile = Join-Path $backupDir "haemi_life_backup_$($timestamp).sql"

# Load environment password if present
if (Test-Path ".env") {
    $envContent = Get-Content ".env" | ConvertFrom-StringData
    if ($envContent.DB_PASSWORD) {
        $env:PGPASSWORD = $envContent.DB_PASSWORD
    }
}

# Ensure backups directory exists
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force
}

Write-Host ">>> Starting Database Backup for: $dbName" -ForegroundColor Cyan

& $pgDumpPath -U $dbUser -h localhost -p 5432 -d $dbName -f $backupFile 2>&1

if (Test-Path $backupFile) {
    $size = (Get-Item $backupFile).Length
    Write-Host ">>> SUCCESS: Backup created at $backupFile" -ForegroundColor Green
    Write-Host ">>> Size: $([math]::Round($size / 1MB, 2)) MB" -ForegroundColor Green
} else {
    Write-Error ">>> FAILED: Backup generation failed."
    exit 1
}

# Cleanup: Optional logic to rotate backups can be added here
