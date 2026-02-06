# TSF OS Engine - Frontend Kernel Packager
# Creates a distributable .frontend.zip for production deployment

param(
    [string]$Version = "1.2.8"
)

$OUTPUT_DIR = ".\releases"
$OUTPUT_FILE = "$OUTPUT_DIR\v$Version.frontend.zip"
$STAGING_DIR = ".\tmp\frontend_packaging_$Version"

Write-Host "[PACKAGING] TSF OS Engine - Frontend Kernel v$Version" -ForegroundColor Cyan

# 1. Build the frontend
Write-Host "[BUILD] Running npm run build..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build failed!" -ForegroundColor Red
    exit 1
}

# 2. Clean staging
if (Test-Path $STAGING_DIR) {
    Remove-Item -Recurse -Force $STAGING_DIR
}
New-Item -ItemType Directory -Path $STAGING_DIR -Force | Out-Null

# 3. Copy built files
Write-Host "[COPY] Copying frontend files..."
Copy-Item -Path ".\.next" -Destination "$STAGING_DIR\.next" -Recurse
Copy-Item -Path ".\public" -Destination "$STAGING_DIR\public" -Recurse -ErrorAction SilentlyContinue
Copy-Item -Path ".\package.json" -Destination "$STAGING_DIR\package.json"
Copy-Item -Path ".\next.config.ts" -Destination "$STAGING_DIR\next.config.ts" -ErrorAction SilentlyContinue
Copy-Item -Path ".\next.config.js" -Destination "$STAGING_DIR\next.config.js" -ErrorAction SilentlyContinue

# 4. Create manifest
$manifest = @{
    version = $Version
    type = "frontend"
    name = "Blanc Engine - Frontend Kernel"
    changelog = "Frontend kernel update v$Version"
    release_date = (Get-Date -Format "yyyy-MM-dd")
    requires_restart = $true
    included_dirs = @(".next", "public")
    node_version = "18+"
}
$manifest | ConvertTo-Json -Depth 3 | Out-File -FilePath "$STAGING_DIR\frontend_update.json" -Encoding utf8

# 5. Create output directory
if (!(Test-Path $OUTPUT_DIR)) {
    New-Item -ItemType Directory -Path $OUTPUT_DIR -Force | Out-Null
}

# 6. Create the ZIP
Write-Host "[ZIP] Creating ZIP package..."
if (Test-Path $OUTPUT_FILE) {
    Remove-Item $OUTPUT_FILE -Force
}
Compress-Archive -Path "$STAGING_DIR\*" -DestinationPath $OUTPUT_FILE -Force

# 7. Cleanup
Remove-Item -Recurse -Force $STAGING_DIR

# 8. Report
$SIZE = (Get-Item $OUTPUT_FILE).Length / 1MB
$SIZE_MB = [math]::Round($SIZE, 2)
Write-Host "[SUCCESS] Frontend Kernel v$Version packaged successfully!" -ForegroundColor Green
Write-Host "   Output: $OUTPUT_FILE ($SIZE_MB MB)"
Write-Host ""
Write-Host "[NEXT STEPS]" -ForegroundColor Yellow
Write-Host "   1. Go to SaaS Admin -> Packages"
Write-Host "   2. Upload the ZIP file"
Write-Host "   3. Click 'Apply' to deploy"
