# PowerShell script to remove PageTransition wrappers from all page files

$files = @(
    "frontendisrc\pages\profile\Profile.tsx",
    "frontend\src\pages\settings\Settings.tsx",
    "frontend\src\pages\admin\VerifyDoctors.tsx",
    "frontend\src\pages\admin\UserManagement.tsx",
    "frontend\src\pages\admin\SystemLogs.tsx",
    "frontend\src\pages\doctor\DoctorScheduleManagement.tsx",
    "frontend\src\pages\appointments\BookAppointment.tsx",
    "frontend\src\pages\support\Help.tsx"
)

foreach ($file in $files) {
    $fullPath = Join-Path "c:\Users\91989\Desktop\Deepak\haemi-life-web" $file
    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath -Raw
        
        # Remove import statement
        $content = $content -replace "import \{ PageTransition \} from.*PageTransition';\r?\n", ""
        
        # Remove opening PageTransition tag (with or without indentation)
        $content = $content -replace "\s*<PageTransition>\r?\n", ""
        
        # Remove closing PageTransition tag (with or without indentation)
        $content = $content -replace "\s*</PageTransition>\r?\n", ""
        
        # Save the file
        Set-Content -Path $fullPath -Value $content -NoNewline
        
        Write-Host "Processed: $file"
    }
    else {
        Write-Host "File not found: $file"
    }
}

Write-Host "Done!"
