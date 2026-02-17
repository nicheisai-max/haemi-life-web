#!/usr/bin/env pwsh
# Script to add PageTransition to all remaining pages

$files = @(
    "frontend/src/pages/admin/VerifyDoctors.tsx",
    "frontend/src/pages/admin/UserManagement.tsx",
    "frontend/src/pages/admin/SystemLogs.tsx",
    "frontend/src/pages/doctor/DoctorScheduleManagement.tsx",
    "frontend/src/pages/pharmacist/PrescriptionQueue.tsx",
    "frontend/src/pages/appointments/BookAppointment.tsx",
    "frontend/src/pages/support/Help.tsx"
)

foreach ($file in $files) {
    $fullPath = Join-Path $PSScriptRoot $file
    
    if (Test-Path $fullPath) {
        Write-Host "Processing: $file" -ForegroundColor Green
        
        $content = Get-Content $fullPath -Raw
        
        # Add import if not present
        if ($content -notmatch "import.*PageTransition.*from.*PageTransition") {
            # Find the last import statement
            $lastImportMatch = [regex]::Match($content, "(?m)^import.*from.*[';]`r?`n")
            if ($lastImportMatch.Success) {
                $insertPos = $lastImportMatch.Index + $lastImportMatch.Length
                $importLine = "import { PageTransition } from '../../components/layout/PageTransition';`r`n"
                $content = $content.Insert($insertPos, $importLine)
                Write-Host "  - Added PageTransition import" -ForegroundColor Yellow
            }
        }
        
        # Replace animate-in patterns with PageTransition wrapper
        # Pattern 1: <div className="...animate-in fade-in duration-500">
        $content = $content -replace '(<\s*div\s+className="[^"]*)(animate-in\s+fade-in\s+duration-\d+)([^"]*"[^>]*>)', '$1$3'
        
        # Pattern 2: <div className="...animate-in fade-in">  
        $content = $content -replace '(<\s*div\s+className="[^"]*)(animate-in\s+fade-in)([^"]*"[^>]*>)', '$1$3'
        
        # Add PageTransition wrapper - find the return statement
        if ($content -match '(?ms)(return\s*\(\s*)(<div[^>]*>)(.*?)(</div>\s*\);?\s*}\s*;?\s*$)') {
            $beforeReturn = $matches[1]
            $openingDiv = $matches[2]
            $innerContent = $matches[3]
            $closingPart = $matches[4]
            
            # Check if PageTransition is already there
            if ($content -notmatch '<PageTransition>') {
                $newContent = $beforeReturn + "`r`n        <PageTransition>`r`n            " + $openingDiv + $innerContent + "</div>`r`n        </PageTransition>`r`n    );" + "`r`n};"
                
                # Replace in content
                $content = $content -replace '(?ms)(return\s*\(\s*)(<div[^>]*>)(.*?)(</div>\s*\);?\s*}\s*;?\s*$)', $newContent
                Write-Host "  - Wrapped content with PageTransition" -ForegroundColor Yellow
            }
        }
        
        # Save the file
        Set-Content -Path $fullPath -Value $content -NoNewline
        Write-Host "  ✓ Updated successfully" -ForegroundColor Green
    } else {
        Write-Host "SKIP: File not found - $file" -ForegroundColor Red
    }
}

Write-Host "`nAll files processed!" -ForegroundColor Cyan
