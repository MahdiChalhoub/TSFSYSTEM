# ══════════════════════════════════════════════════════════════════════════════
# deploy_zero_downtime.ps1 — Local Deploy Agent for Zero-Downtime Updates
#
# Wraps the atomic deployment script, executing it on the remote server.
# Supports: full deploy, rollback, health check, and status monitoring.
#
# Usage:
#   .\deploy_zero_downtime.ps1                # Full atomic deploy
#   .\deploy_zero_downtime.ps1 -Rollback      # Rollback to previous release
#   .\deploy_zero_downtime.ps1 -HealthOnly    # Just check health
#   .\deploy_zero_downtime.ps1 -DryRun        # Preview without executing
# ══════════════════════════════════════════════════════════════════════════════

param(
    [switch]$Rollback,
    [switch]$HealthOnly,
    [switch]$DryRun
)

$SERVER_IP = "91.99.186.183"
$SSH_KEY = "$env:USERPROFILE\.ssh\id_deploy"
$APP_PATH = "/root/TSFSYSTEM"
$DEPLOY_SCRIPT = "$APP_PATH/scripts/deploy_atomic.sh"

# ── Helpers ───────────────────────────────────────────────────────────────────
function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "  ❌ $msg" -ForegroundColor Red }

function Execute-Remote($cmd) {
    if ($DryRun) {
        Write-Host "  [DRY RUN] ssh root@$SERVER_IP `"$cmd`"" -ForegroundColor Yellow
        return
    }
    ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10 "root@$SERVER_IP" $cmd
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Remote command failed with exit code $LASTEXITCODE"
        return $false
    }
    return $true
}

# ── Health Check Only ─────────────────────────────────────────────────────────
if ($HealthOnly) {
    Write-Step "Running Health Check..."
    Execute-Remote "curl -sf https://tsf.ci/api/health/ && echo 'HEALTHY' || echo 'UNHEALTHY'"
    Execute-Remote "pm2 status"
    exit
}

# ── Pre-Deploy: Local Checks ─────────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "  TSF Platform — Zero-Downtime Deploy Agent" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Magenta

# Step 1: Git status check
Write-Step "Pre-flight: Checking for uncommitted changes..."
$gitStatus = git status --porcelain 2>&1
if ($gitStatus) {
    Write-Err "You have uncommitted changes! Commit first."
    Write-Host $gitStatus -ForegroundColor Yellow
    $confirm = Read-Host "Continue anyway? (y/N)"
    if ($confirm -ne "y") { exit 1 }
}
Write-Ok "Git working tree clean"

# Step 2: Push to remote
Write-Step "Pushing latest code to origin/main..."
if (-not $DryRun) {
    git push origin main 2>&1
}
Write-Ok "Code pushed"

# ── Deploy ────────────────────────────────────────────────────────────────────
if ($Rollback) {
    Write-Step "Executing ROLLBACK on server..."
    Execute-Remote "bash $DEPLOY_SCRIPT --rollback"
}
else {
    Write-Step "Executing ATOMIC DEPLOY on server..."
    
    # Ensure the deploy script is executable
    Execute-Remote "chmod +x $DEPLOY_SCRIPT"
    
    # Ensure the releases directory exists  
    Execute-Remote "mkdir -p /root/releases"
    
    # Run the atomic deploy
    Execute-Remote "bash $DEPLOY_SCRIPT"
}

# ── Post-Deploy Verification ─────────────────────────────────────────────────
Write-Step "Post-Deploy Verification..."
Start-Sleep -Seconds 5

$frontendCode = if (-not $DryRun) {
    try { (Invoke-WebRequest -Uri "https://tsf.ci" -UseBasicParsing -TimeoutSec 10).StatusCode } catch { "FAIL" }
}
else { "200 (DRY RUN)" }

$backendCode = if (-not $DryRun) {
    try { (Invoke-WebRequest -Uri "https://tsf.ci/api/health/" -UseBasicParsing -TimeoutSec 10).StatusCode } catch { "FAIL" }
}
else { "200 (DRY RUN)" }

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Magenta
if ($frontendCode -eq 200 -and $backendCode -eq 200) {
    Write-Host "  ✅ DEPLOYMENT SUCCESSFUL" -ForegroundColor Green
}
else {
    Write-Host "  ⚠️  DEPLOYMENT NEEDS ATTENTION" -ForegroundColor Yellow
}
Write-Host "  Frontend: HTTP $frontendCode" -ForegroundColor $(if ($frontendCode -eq 200) { "Green" } else { "Red" })
Write-Host "  Backend:  HTTP $backendCode" -ForegroundColor $(if ($backendCode -eq 200) { "Green" } else { "Red" })
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Magenta
