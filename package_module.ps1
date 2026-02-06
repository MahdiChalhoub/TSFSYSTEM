# TSF OS Engine - Module Packager
# Creates distributable .module.zip for each module

param(
    [string]$ModuleName = "",
    [string]$Version = "1.0.0"
)

$APPS_DIR = ".\erp_backend\apps"
$OUTPUT_DIR = ".\releases\modules"

# Create output directory
if (!(Test-Path $OUTPUT_DIR)) {
    New-Item -ItemType Directory -Path $OUTPUT_DIR -Force | Out-Null
}

# Get modules to package
if ($ModuleName -eq "") {
    $modules = Get-ChildItem -Path $APPS_DIR -Directory | Where-Object { $_.Name -ne "__pycache__" -and $_.Name -ne "core" }
}
else {
    $modules = @(Get-Item "$APPS_DIR\$ModuleName")
}

foreach ($module in $modules) {
    $name = $module.Name
    $source = $module.FullName
    $output = "$OUTPUT_DIR\$name.module.zip"
    $staging = ".\tmp\module_$name"
    
    Write-Host "[PACKAGING] Module: $name" -ForegroundColor Cyan
    
    # Clean staging
    if (Test-Path $staging) {
        Remove-Item -Recurse -Force $staging
    }
    New-Item -ItemType Directory -Path $staging -Force | Out-Null
    
    # Copy module files
    Copy-Item -Path $source -Destination "$staging\apps\$name" -Recurse -Exclude "__pycache__", "*.pyc"
    
    # Create manifest if not exists
    $manifestPath = "$staging\manifest.json"
    $manifest = @{
        name         = $name
        version      = $Version
        type         = "module"
        package_date = (Get-Date -Format "yyyy-MM-dd")
    }
    $manifest | ConvertTo-Json -Depth 3 | Out-File -FilePath $manifestPath -Encoding utf8
    
    # Create ZIP
    if (Test-Path $output) {
        Remove-Item $output -Force
    }
    Compress-Archive -Path "$staging\*" -DestinationPath $output -Force
    
    # Cleanup
    Remove-Item -Recurse -Force $staging
    
    $size = (Get-Item $output).Length / 1KB
    Write-Host "   -> $output ($([math]::Round($size, 1)) KB)" -ForegroundColor Green
}

Write-Host ""
Write-Host "[DONE] All modules packaged to $OUTPUT_DIR" -ForegroundColor Green
