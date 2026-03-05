#!/usr/bin/env pwsh

# HAEMI LIFE — PRE-COMMIT SECRET & SIZE GUARD
# Blocks secrets (JWT, Hex keys) and oversized files (>50MB)

$MAX_FILE_SIZE = 50 * 1024 * 1024 # 50 MB
$REJECTED = $false

Write-Host "`n[SECURITY GUARD] Scanning staged files..." -ForegroundColor Cyan

# 1. Size Check
$stagedFiles = git diff --cached --name-only
foreach ($file in $stagedFiles) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        if ($size -gt $MAX_FILE_SIZE) {
            Write-Host "[ERROR] Over-sized file detected: $file ($([math]::round($size/1MB, 2)) MB). Limit is 50MB." -ForegroundColor Red
            $REJECTED = $true
        }
    }
}

# 2. Secret Check (Basic Entropy/Pattern Matching)
$stagedDiff = git diff --cached
$patterns = @(
    "AIza[0-9A-Za-z-_]{35}",           # Gemini/Google API Kay
    "ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*", # JWT
    "[0-9a-fA-F]{64}"                   # 64-char Hex (Encryption Keys)
)

foreach ($pattern in $patterns) {
    if ($stagedDiff -match $pattern) {
        Write-Host "[ERROR] Potential secret detected in commit! (Pattern: $pattern)" -ForegroundColor Red
        Write-Host "Please remove the secret from your code and use .env files instead." -ForegroundColor Yellow
        $REJECTED = $true
        break
    }
}

# 3. .env File Check
if ($stagedFiles -contains ".env") {
    Write-Host "[ERROR] .env file detected in staged changes! DO NOT COMMIT SECRETS." -ForegroundColor Red
    $REJECTED = $true
}

if ($REJECTED) {
    Write-Host "`n[FAIL] Commit blocked by security policy.`n" -ForegroundColor Red
    exit 1
}

Write-Host "[SUCCESS] Security guard passed.`n" -ForegroundColor Green
exit 0
