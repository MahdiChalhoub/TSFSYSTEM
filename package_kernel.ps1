# TSF OS Engine - Kernel Packager
# Creates a distributable .kernel.zip for production deployment

$VERSION = "1.0.0"
$OUTPUT_DIR = ".\releases"
$OUTPUT_FILE = "$OUTPUT_DIR\v$VERSION.kernel.zip"
$BACKEND_DIR = ".\erp_backend"
$STAGING_DIR = ".\tmp\kernel_packaging_$VERSION"

Write-Host "[PACKAGING] TSF OS Engine - Kernel v$VERSION" -ForegroundColor Cyan

# 1. Clean staging
if (Test-Path $STAGING_DIR) {
    Remove-Item -Recurse -Force $STAGING_DIR
}
New-Item -ItemType Directory -Path $STAGING_DIR -Force | Out-Null

# 2. Copy core kernel files (The Brain)
Write-Host "[COPY] Copying Kernel files..."
Copy-Item -Path "$BACKEND_DIR\erp" -Destination "$STAGING_DIR\erp" -Recurse -Exclude "__pycache__", "*.pyc"
Copy-Item -Path "$BACKEND_DIR\manage.py" -Destination "$STAGING_DIR\manage.py"
Copy-Item -Path "$BACKEND_DIR\update.json" -Destination "$STAGING_DIR\update.json"
Copy-Item -Path "$BACKEND_DIR\requirements.txt" -Destination "$STAGING_DIR\requirements.txt"

# 2b. Copy lib/ if exists (Shared engine libraries)
if (Test-Path "$BACKEND_DIR\lib") {
    Copy-Item -Path "$BACKEND_DIR\lib" -Destination "$STAGING_DIR\lib" -Recurse -Exclude "__pycache__", "*.pyc"
}

# 3. Create output directory
if (!(Test-Path $OUTPUT_DIR)) {
    New-Item -ItemType Directory -Path $OUTPUT_DIR -Force | Out-Null
}

# 4. Create the ZIP
Write-Host "[ZIP] Creating ZIP package..."
Compress-Archive -Path "$STAGING_DIR\*" -DestinationPath $OUTPUT_FILE -Force

# 5. Cleanup
Remove-Item -Recurse -Force $STAGING_DIR

# 6. Report
$SIZE = (Get-Item $OUTPUT_FILE).Length / 1MB
$SIZE_MB = [math]::Round($SIZE, 2)
Write-Host "[SUCCESS] Kernel v$VERSION packaged successfully!" -ForegroundColor Green
Write-Host "   Output: $OUTPUT_FILE ($SIZE_MB MB)"
Write-Host ""
Write-Host "[NEXT STEPS]" -ForegroundColor Yellow
Write-Host "   1. Deploy this ZIP to your target server."
Write-Host "   2. In SaaS Admin -> Kernel Updates, upload the ZIP."
Write-Host "   3. Click Apply Update and restart services."
