# TSF OS Engine - Backend Kernel Packager
# Creates a distributable .kernel.zip for production deployment

param(
    [string]$Version = "1.2.9"
)

$OUTPUT_DIR = ".\releases"
$OUTPUT_FILE = "$OUTPUT_DIR\v$Version.kernel.zip"
$BACKEND_DIR = ".\erp_backend"
$STAGING_DIR = ".\tmp\kernel_packaging_$Version"

Write-Host "[PACKAGING] TSF OS Engine - Backend Kernel v$Version" -ForegroundColor Cyan

# 1. Clean staging
if (Test-Path $STAGING_DIR) {
    Remove-Item -Recurse -Force $STAGING_DIR
}
New-Item -ItemType Directory -Path $STAGING_DIR -Force | Out-Null

# 2. Copy core kernel files (The Brain)
Write-Host "[COPY] Copying Kernel files..."
Copy-Item -Path "$BACKEND_DIR\erp" -Destination "$STAGING_DIR\erp" -Recurse -Exclude "__pycache__", "*.pyc"
Copy-Item -Path "$BACKEND_DIR\manage.py" -Destination "$STAGING_DIR\manage.py"
Copy-Item -Path "$BACKEND_DIR\requirements.txt" -Destination "$STAGING_DIR\requirements.txt"

# 2b. Copy lib/ if exists (Shared engine libraries)
if (Test-Path "$BACKEND_DIR\lib") {
    Copy-Item -Path "$BACKEND_DIR\lib" -Destination "$STAGING_DIR\lib" -Recurse -Exclude "__pycache__", "*.pyc"
}

# 3. Generate update.json manifest
$manifest = @{
    version = $Version
    name = "TSF OS Engine - Backend Kernel"
    changelog = "Backend kernel update v$Version - Package Storage & Deployment Center"
    release_date = (Get-Date -Format "yyyy-MM-dd")
    requires_restart = $true
    included_dirs = @("erp", "lib")
    excluded_files = @("*.pyc", "__pycache__", "migrations/*.pyc")
}
$manifest | ConvertTo-Json -Depth 3 | Out-File -FilePath "$STAGING_DIR\update.json" -Encoding utf8

# 4. Create output directory
if (!(Test-Path $OUTPUT_DIR)) {
    New-Item -ItemType Directory -Path $OUTPUT_DIR -Force | Out-Null
}

# 5. Create the ZIP
Write-Host "[ZIP] Creating ZIP package..."
if (Test-Path $OUTPUT_FILE) {
    Remove-Item $OUTPUT_FILE -Force
}
Compress-Archive -Path "$STAGING_DIR\*" -DestinationPath $OUTPUT_FILE -Force

# 6. Cleanup
Remove-Item -Recurse -Force $STAGING_DIR

# 7. Report
$SIZE = (Get-Item $OUTPUT_FILE).Length / 1MB
$SIZE_MB = [math]::Round($SIZE, 2)
Write-Host "[SUCCESS] Backend Kernel v$Version packaged successfully!" -ForegroundColor Green
Write-Host "   Output: $OUTPUT_FILE ($SIZE_MB MB)"
Write-Host ""
Write-Host "[NEXT STEPS]" -ForegroundColor Yellow
Write-Host "   1. Go to SaaS Admin -> Packages"
Write-Host "   2. Upload the ZIP file"
Write-Host "   3. Click 'Apply' to deploy"
