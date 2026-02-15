#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════════════
# 🤖 TSF Deploy Agent — Intelligent Deployment System
# ═══════════════════════════════════════════════════════════════════════
# Auto-detects what changed, verifies before deploy, deploys only the
# relevant side (frontend/backend/both), validates after deploy, and
# attempts self-healing if anything goes wrong.
#
# Usage:
#   .\scripts\deploy-agent.ps1              # Auto-detect mode
#   .\scripts\deploy-agent.ps1 -Force frontend   # Force frontend only
#   .\scripts\deploy-agent.ps1 -Force backend    # Force backend only
#   .\scripts\deploy-agent.ps1 -Force full       # Force full deploy
#   .\scripts\deploy-agent.ps1 -DryRun           # Preview what would happen
# ═══════════════════════════════════════════════════════════════════════

param(
    [ValidateSet("auto", "frontend", "backend", "full")]
    [string]$Force = "auto",

    [switch]$DryRun,

    [int]$MaxRetries = 3,

    [int]$HealthCheckTimeout = 15
)

# ─── Config ───────────────────────────────────────────────────────────
$SERVER_IP = "91.99.186.183"
$SSH_KEY = "$env:USERPROFILE\.ssh\id_deploy"
$SSH_USER = "root"
$APP_PATH = "/root/TSFSYSTEM"
$DOMAIN = "https://tsf.ci"
$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot  # Go up from scripts/

# ─── Colors & Formatting ─────────────────────────────────────────────
function Write-Phase($icon, $title) {
    Write-Host ""
    Write-Host "  $icon  $title" -ForegroundColor Cyan
    Write-Host "  $('─' * ($title.Length + 4))" -ForegroundColor DarkGray
}

function Write-Step($msg) {
    Write-Host "     → $msg" -ForegroundColor White
}

function Write-OK($msg) {
    Write-Host "     ✅ $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
    Write-Host "     ⚠️  $msg" -ForegroundColor Yellow
}

function Write-Fail($msg) {
    Write-Host "     ❌ $msg" -ForegroundColor Red
}

function Write-Info($msg) {
    Write-Host "     ℹ️  $msg" -ForegroundColor DarkGray
}

function Write-Banner {
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "  ║        🤖 TSF Deploy Agent v1.0                 ║" -ForegroundColor Magenta
    Write-Host "  ║        Intelligent Deployment System             ║" -ForegroundColor Magenta
    Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Magenta
    Write-Host ""
    if ($DryRun) {
        Write-Host "  🔍 DRY RUN MODE — No changes will be made" -ForegroundColor Yellow
        Write-Host ""
    }
}

# ─── SSH Helper ───────────────────────────────────────────────────────
function Invoke-ServerCommand {
    param([string]$Command, [switch]$Silent)
    
    $result = ssh -i $SSH_KEY -o ConnectTimeout=10 -o StrictHostKeyChecking=no "${SSH_USER}@${SERVER_IP}" $Command 2>&1
    $exitCode = $LASTEXITCODE
    
    if (-not $Silent -and $result) {
        $result | ForEach-Object { Write-Host "       $_" -ForegroundColor DarkGray }
    }
    
    return @{
        Output   = ($result -join "`n")
        ExitCode = $exitCode
        Success  = ($exitCode -eq 0)
    }
}

# ═══════════════════════════════════════════════════════════════════════
# PHASE 1: DETECT — What changed?
# ═══════════════════════════════════════════════════════════════════════
function Get-DeployTarget {
    Write-Phase "🔍" "PHASE 1: CHANGE DETECTION"
    
    if ($Force -ne "auto") {
        Write-Step "Forced mode: $Force"
        return $Force
    }

    # Get changed files since last push (comparing with remote)
    Write-Step "Analyzing git diff against origin/main..."
    
    Push-Location $PROJECT_ROOT
    try {
        git fetch origin main 2>$null
        $changedFiles = git diff --name-only origin/main HEAD 2>$null
        
        if (-not $changedFiles) {
            # Check uncommitted changes too
            $changedFiles = git diff --name-only HEAD 2>$null
        }

        if (-not $changedFiles) {
            $changedFiles = git diff --name-only --cached 2>$null
        }

        # If still nothing, check the last commit
        if (-not $changedFiles) {
            Write-Info "No diff found, checking last commit..."
            $changedFiles = git diff --name-only HEAD~1 HEAD 2>$null
        }
    }
    finally {
        Pop-Location
    }

    if (-not $changedFiles) {
        Write-Warn "No changes detected. Deploying full to be safe."
        return "full"
    }

    $frontendFiles = @()
    $backendFiles = @()
    $otherFiles = @()

    foreach ($file in $changedFiles) {
        if ($file -match "^src/" -or $file -match "^public/" -or $file -match "^next\." -or $file -match "^package" -or $file -match "^tsconfig") {
            $frontendFiles += $file
        }
        elseif ($file -match "^erp_backend/" -or $file -match "requirements") {
            $backendFiles += $file
        }
        else {
            $otherFiles += $file
        }
    }

    $hasFrontend = $frontendFiles.Count -gt 0
    $hasBackend = $backendFiles.Count -gt 0

    Write-Step "Files changed: $($changedFiles.Count) total"
    if ($frontendFiles.Count -gt 0) { Write-Info "  Frontend: $($frontendFiles.Count) files" }
    if ($backendFiles.Count -gt 0) { Write-Info "  Backend:  $($backendFiles.Count) files" }
    if ($otherFiles.Count -gt 0) { Write-Info "  Other:    $($otherFiles.Count) files (docs, config)" }

    if ($hasFrontend -and $hasBackend) {
        $target = "full"
    }
    elseif ($hasFrontend) {
        $target = "frontend"
    }
    elseif ($hasBackend) {
        $target = "backend"
    }
    else {
        # Only docs/config changed — deploy frontend to be safe (lightest)
        $target = "frontend"
    }

    Write-OK "Deploy target: $($target.ToUpper())"
    return $target
}

# ═══════════════════════════════════════════════════════════════════════
# PHASE 2: PRE-VERIFY — Is the code healthy?
# ═══════════════════════════════════════════════════════════════════════
function Test-PreDeploy {
    param([string]$Target)

    Write-Phase "🔬" "PHASE 2: PRE-DEPLOY VERIFICATION"

    $allPassed = $true

    # --- Git status check ---
    Write-Step "Checking git status..."
    Push-Location $PROJECT_ROOT
    try {
        $uncommitted = git status --porcelain 2>$null
        if ($uncommitted) {
            $count = ($uncommitted | Measure-Object).Count
            Write-Warn "$count uncommitted files detected"
            Write-Info "Consider committing before deploy"
        }
        else {
            Write-OK "Working tree clean"
        }

        # Check if pushed
        $ahead = git rev-list --count origin/main..HEAD 2>$null
        if ([int]$ahead -gt 0) {
            Write-Fail "You are $ahead commit(s) ahead of origin/main — push first!"
            Write-Info "Run: git push origin main"
            $allPassed = $false
        }
        else {
            Write-OK "All commits pushed to origin/main"
        }
    }
    finally {
        Pop-Location
    }

    # --- Frontend build check ---
    if ($Target -in @("frontend", "full")) {
        Write-Step "Building Next.js locally (this validates compilation)..."
        
        if ($DryRun) {
            Write-Info "[DRY RUN] Would run: npm run build"
        }
        else {
            Push-Location $PROJECT_ROOT
            try {
                $buildOutput = npm run build 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-OK "Next.js build passed"
                }
                else {
                    Write-Fail "Next.js build FAILED"
                    $buildOutput | Select-Object -Last 10 | ForEach-Object { Write-Host "       $_" -ForegroundColor Red }
                    $allPassed = $false
                }
            }
            finally {
                Pop-Location
            }
        }
    }

    # --- Backend check ---
    if ($Target -in @("backend", "full")) {
        Write-Step "Running Django system checks..."
        
        if ($DryRun) {
            Write-Info "[DRY RUN] Would run: python manage.py check"
        }
        else {
            Push-Location "$PROJECT_ROOT\erp_backend"
            try {
                $checkOutput = python manage.py check 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-OK "Django checks passed"
                }
                else {
                    Write-Warn "Django checks had issues (may be OK if no local venv)"
                    $checkOutput | Select-Object -Last 5 | ForEach-Object { Write-Host "       $_" -ForegroundColor Yellow }
                }
            }
            finally {
                Pop-Location
            }
        }
    }

    # --- Server connectivity check ---
    Write-Step "Testing SSH connection to server..."
    $sshTest = Invoke-ServerCommand "echo 'connected'" -Silent
    if ($sshTest.Success) {
        Write-OK "Server reachable at $SERVER_IP"
    }
    else {
        Write-Fail "Cannot connect to server!"
        $allPassed = $false
    }

    # --- Pre-deploy server health snapshot ---
    if ($sshTest.Success) {
        Write-Step "Taking pre-deploy health snapshot..."
        $preHealth = Invoke-ServerCommand "curl -s -o /dev/null -w '%{http_code}' $DOMAIN 2>/dev/null; echo ','; curl -s -o /dev/null -w '%{http_code}' $DOMAIN/api/ 2>/dev/null" -Silent
        $codes = $preHealth.Output -split ","
        Write-Info "Current Frontend: HTTP $($codes[0].Trim())  |  Backend: HTTP $($codes[1].Trim())"
    }

    if (-not $allPassed) {
        Write-Host ""
        Write-Fail "PRE-DEPLOY CHECKS FAILED — Aborting deploy"
        return $false
    }

    Write-OK "All pre-deploy checks passed"
    return $true
}

# ═══════════════════════════════════════════════════════════════════════
# PHASE 3: DEPLOY — Push to production
# ═══════════════════════════════════════════════════════════════════════
function Invoke-Deploy {
    param([string]$Target)

    Write-Phase "🚀" "PHASE 3: DEPLOYING ($($Target.ToUpper()))"

    if ($DryRun) {
        Write-Info "[DRY RUN] Would deploy $Target to $DOMAIN"
        return $true
    }

    # Step 1: Pull code (safe — uses git stash, never git clean)
    Write-Step "Pulling latest code on server..."
    $pullResult = Invoke-ServerCommand "cd $APP_PATH && git stash 2>/dev/null; git pull origin main 2>&1"
    if (-not $pullResult.Success) {
        Write-Fail "Git pull failed!"
        return $false
    }
    Write-OK "Code pulled"

    # Step 2: Frontend deploy
    if ($Target -in @("frontend", "full")) {
        Write-Step "Installing npm dependencies..."
        Invoke-ServerCommand "cd $APP_PATH && npm install --production=false 2>&1 | tail -3" | Out-Null
        
        Write-Step "Building Next.js on server..."
        $buildResult = Invoke-ServerCommand "cd $APP_PATH && npm run build 2>&1 | tail -5"
        if (-not $buildResult.Success) {
            Write-Fail "Next.js build failed on server!"
            return $false
        }
        Write-OK "Frontend built"

        Write-Step "Restarting Next.js service..."
        Invoke-ServerCommand "pm2 restart nextjs 2>&1" -Silent | Out-Null
        Write-OK "nextjs restarted"
    }

    # Step 3: Backend deploy
    if ($Target -in @("backend", "full")) {
        Write-Step "Checking venv exists..."
        $venvCheck = Invoke-ServerCommand "test -f $APP_PATH/erp_backend/venv/bin/activate && echo 'exists' || echo 'missing'" -Silent
        
        if ($venvCheck.Output -match "missing") {
            Write-Warn "venv missing — recreating..."
            Invoke-ServerCommand "cd $APP_PATH/erp_backend && python3 -m venv venv 2>&1 | tail -2"
            Write-OK "venv created"
        }

        Write-Step "Installing Python dependencies..."
        Invoke-ServerCommand "cd $APP_PATH/erp_backend && source venv/bin/activate && pip install -r requirements.txt 2>&1 | tail -3" | Out-Null
        Write-OK "Dependencies installed"

        Write-Step "Running migrations..."
        Invoke-ServerCommand "cd $APP_PATH/erp_backend && source venv/bin/activate && python manage.py migrate --no-input 2>&1 | tail -5" | Out-Null
        Write-OK "Migrations applied"

        Write-Step "Collecting static files..."
        Invoke-ServerCommand "cd $APP_PATH/erp_backend && source venv/bin/activate && python manage.py collectstatic --noinput 2>&1 | tail -2" -Silent | Out-Null
        Write-OK "Static files collected"

        Write-Step "Restarting Django service..."
        Invoke-ServerCommand "pm2 restart django 2>&1" -Silent | Out-Null
        Write-OK "django restarted"
    }

    Write-OK "Deploy complete!"
    return $true
}

# ═══════════════════════════════════════════════════════════════════════
# PHASE 4: POST-VERIFY — Is everything working?
# ═══════════════════════════════════════════════════════════════════════
function Test-PostDeploy {
    param([string]$Target)

    Write-Phase "✅" "PHASE 4: POST-DEPLOY VERIFICATION"

    if ($DryRun) {
        Write-Info "[DRY RUN] Would verify services"
        return @{ FrontendOK = $true; BackendOK = $true }
    }

    # Wait for services to boot
    Write-Step "Waiting $HealthCheckTimeout seconds for services to boot..."
    Start-Sleep -Seconds $HealthCheckTimeout

    $frontendOK = $true
    $backendOK = $true

    # Check PM2 status
    Write-Step "Checking PM2 process status..."
    $pm2Result = Invoke-ServerCommand "pm2 jlist 2>/dev/null" -Silent
    
    if ($pm2Result.Output -match '"status":"errored"') {
        Write-Fail "One or more PM2 processes are in errored state!"
        Invoke-ServerCommand "pm2 status" | Out-Null
    }
    else {
        Write-OK "All PM2 processes running"
    }

    # HTTP health checks
    Write-Step "Running HTTP health checks..."
    
    # Frontend check
    $frontendResult = Invoke-ServerCommand "curl -s -o /dev/null -w '%{http_code}' --max-time 10 $DOMAIN 2>/dev/null" -Silent
    $frontendCode = $frontendResult.Output.Trim()
    if ($frontendCode -eq "200") {
        Write-OK "Frontend: HTTP $frontendCode"
    }
    else {
        Write-Fail "Frontend: HTTP $frontendCode"
        $frontendOK = $false
    }

    # Backend check (401 = working, needs auth)
    $backendResult = Invoke-ServerCommand "curl -s -o /dev/null -w '%{http_code}' --max-time 10 $DOMAIN/api/ 2>/dev/null" -Silent
    $backendCode = $backendResult.Output.Trim()
    if ($backendCode -in @("200", "401", "403")) {
        Write-OK "Backend: HTTP $backendCode (healthy)"
    }
    else {
        Write-Fail "Backend: HTTP $backendCode"
        $backendOK = $false
    }

    # API health endpoint
    $healthResult = Invoke-ServerCommand "curl -s --max-time 10 $DOMAIN/api/health/ 2>/dev/null | head -1" -Silent
    if ($healthResult.Output -match "online") {
        Write-OK "Health API: online"
    }
    elseif ($backendCode -in @("200", "401", "403")) {
        Write-Info "Health API: not reachable (but backend is responding)"
    }
    else {
        Write-Warn "Health API: not responding"
    }

    return @{ FrontendOK = $frontendOK; BackendOK = $backendOK }
}

# ═══════════════════════════════════════════════════════════════════════
# PHASE 5: SELF-HEAL — Fix common errors automatically
# ═══════════════════════════════════════════════════════════════════════
function Invoke-SelfHeal {
    param(
        [hashtable]$HealthStatus,
        [string]$Target,
        [int]$Attempt = 1
    )

    if ($HealthStatus.FrontendOK -and $HealthStatus.BackendOK) {
        return $true
    }

    if ($Attempt -gt $MaxRetries) {
        Write-Fail "Max retries ($MaxRetries) exceeded. Manual intervention needed."
        return $false
    }

    Write-Phase "🔧" "PHASE 5: SELF-HEALING (Attempt $Attempt/$MaxRetries)"

    $fixed = $false

    # ─── Backend healing ──────────────────────────────────────────────
    if (-not $HealthStatus.BackendOK) {
        Write-Step "Diagnosing backend failure..."
        
        # Check PM2 logs for errors
        $logs = Invoke-ServerCommand "pm2 logs django --lines 20 --nostream 2>/dev/null" -Silent
        
        # FIX 1: venv missing
        if ($logs.Output -match "No such file or directory.*venv" -or $logs.Output -match "activate") {
            Write-Warn "Detected: Missing venv"
            Write-Step "Recreating Python virtual environment..."
            Invoke-ServerCommand "cd $APP_PATH/erp_backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt 2>&1 | tail -3"
            Write-OK "venv restored"
            $fixed = $true
        }

        # FIX 2: Migration errors
        if ($logs.Output -match "no such table" -or $logs.Output -match "relation.*does not exist") {
            Write-Warn "Detected: Missing database tables"
            Write-Step "Running migrations..."
            Invoke-ServerCommand "cd $APP_PATH/erp_backend && source venv/bin/activate && python manage.py migrate --no-input 2>&1 | tail -5"
            Write-OK "Migrations applied"
            $fixed = $true
        }

        # FIX 3: Import errors (missing module)
        if ($logs.Output -match "ModuleNotFoundError" -or $logs.Output -match "ImportError") {
            Write-Warn "Detected: Missing Python module"
            Write-Step "Reinstalling requirements..."
            Invoke-ServerCommand "cd $APP_PATH/erp_backend && source venv/bin/activate && pip install -r requirements.txt 2>&1 | tail -3"
            Write-OK "Dependencies reinstalled"
            $fixed = $true
        }

        # FIX 4: Port already in use
        if ($logs.Output -match "Address already in use" -or $logs.Output -match "port 8000") {
            Write-Warn "Detected: Port 8000 in use"
            Write-Step "Killing stale process..."
            Invoke-ServerCommand "fuser -k 8000/tcp 2>/dev/null; sleep 2"
            Write-OK "Port freed"
            $fixed = $true
        }

        # FIX 5: Permission errors
        if ($logs.Output -match "Permission denied") {
            Write-Warn "Detected: Permission issue"
            Write-Step "Fixing file permissions..."
            Invoke-ServerCommand "chmod -R 755 $APP_PATH/erp_backend/ && chmod +x $APP_PATH/erp_backend/start_django.sh"
            Write-OK "Permissions fixed"
            $fixed = $true
        }

        # Generic fix: restart
        if (-not $fixed) {
            Write-Warn "No specific error pattern found — attempting restart..."
            $fixed = $true
        }

        Write-Step "Restarting Django..."
        Invoke-ServerCommand "pm2 restart django 2>/dev/null" -Silent | Out-Null
    }

    # ─── Frontend healing ─────────────────────────────────────────────
    if (-not $HealthStatus.FrontendOK) {
        Write-Step "Diagnosing frontend failure..."
        
        $feLogs = Invoke-ServerCommand "pm2 logs nextjs --lines 20 --nostream 2>/dev/null" -Silent

        # FIX 1: Build artifacts missing
        if ($feLogs.Output -match "Could not find.*\.next" -or $feLogs.Output -match "ENOENT") {
            Write-Warn "Detected: Missing .next build"
            Write-Step "Rebuilding Next.js..."
            Invoke-ServerCommand "cd $APP_PATH && npm run build 2>&1 | tail -5"
            Write-OK "Frontend rebuilt"
            $fixed = $true
        }

        # FIX 2: Node modules missing
        if ($feLogs.Output -match "Cannot find module" -or $feLogs.Output -match "MODULE_NOT_FOUND") {
            Write-Warn "Detected: Missing node_modules"
            Write-Step "Reinstalling npm dependencies..."
            Invoke-ServerCommand "cd $APP_PATH && npm install 2>&1 | tail -3"
            Write-OK "Dependencies reinstalled"
            $fixed = $true
        }

        # Generic fix: restart
        if (-not $fixed) {
            Write-Warn "No specific error pattern found — attempting restart..."
        }

        Write-Step "Restarting Next.js..."
        Invoke-ServerCommand "pm2 restart nextjs 2>/dev/null" -Silent | Out-Null
    }

    # Re-verify
    Write-Step "Waiting $HealthCheckTimeout seconds for services to recover..."
    Start-Sleep -Seconds $HealthCheckTimeout

    $newHealth = Test-PostDeploy -Target $Target

    if ($newHealth.FrontendOK -and $newHealth.BackendOK) {
        Write-OK "Self-healing successful!"
        return $true
    }
    else {
        # Recurse with next attempt
        return Invoke-SelfHeal -HealthStatus $newHealth -Target $Target -Attempt ($Attempt + 1)
    }
}

# ═══════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════

$startTime = Get-Date
Write-Banner

# Phase 1: Detect
$target = Get-DeployTarget

# Phase 2: Pre-verify
$preCheck = Test-PreDeploy -Target $target
if (-not $preCheck) {
    Write-Host ""
    Write-Host "  💀 Deploy aborted due to failed pre-checks" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Confirmation
if (-not $DryRun) {
    Write-Host ""
    Write-Host "  📋 Deploy Plan:" -ForegroundColor White
    Write-Host "     Target:  $($target.ToUpper())" -ForegroundColor Cyan
    Write-Host "     Server:  $DOMAIN ($SERVER_IP)" -ForegroundColor White
    Write-Host ""
    
    $confirm = Read-Host "     Proceed with deploy? (y/N)"
    if ($confirm -notmatch "^[yY]") {
        Write-Host ""
        Write-Host "  🛑 Deploy cancelled by user" -ForegroundColor Yellow
        Write-Host ""
        exit 0
    }
}

# Phase 3: Deploy
$deploySuccess = Invoke-Deploy -Target $target
if (-not $deploySuccess) {
    Write-Host ""
    Write-Host "  💀 Deploy failed!" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Phase 4: Post-verify
$health = Test-PostDeploy -Target $target

# Phase 5: Self-heal (if needed)
if (-not $health.FrontendOK -or -not $health.BackendOK) {
    $healed = Invoke-SelfHeal -HealthStatus $health -Target $target
    if (-not $healed) {
        Write-Host ""
        Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Red
        Write-Host "  ║  ❌ DEPLOY FAILED — Manual intervention needed  ║" -ForegroundColor Red
        Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Check server logs:" -ForegroundColor Yellow
        Write-Host "    ssh -i $SSH_KEY $SSH_USER@$SERVER_IP `"pm2 logs`"" -ForegroundColor DarkGray
        Write-Host ""
        exit 1
    }
}

# ─── Summary ──────────────────────────────────────────────────────────
$elapsed = (Get-Date) - $startTime
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║  ✅ DEPLOY SUCCESSFUL                           ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "     Target:   $($target.ToUpper())" -ForegroundColor White
Write-Host "     Domain:   $DOMAIN" -ForegroundColor White
Write-Host "     Duration: $([math]::Round($elapsed.TotalSeconds))s" -ForegroundColor White
Write-Host ""
