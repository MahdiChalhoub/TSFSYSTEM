# Deploy Agent Script Documentation

## Goal
Provide an intelligent, automated deployment system that prevents backend crashes from frontend-only deploys and self-heals common server errors.

## Script Location
`scripts/deploy-agent.ps1`

## How It Works

### Phase 1: Change Detection
- Uses `git diff` against `origin/main` to identify changed files
- Classifies files as **frontend** (`src/`, `public/`, `next.*`, `package*`, `tsconfig*`), **backend** (`erp_backend/`, `requirements*`), or **other**
- Auto-selects the lightest deploy target needed

### Phase 2: Pre-Deploy Verification
- Checks for uncommitted/unpushed changes
- Runs `npm run build` for frontend changes
- Runs `python manage.py check` for backend changes
- Tests SSH connectivity to server
- Takes a pre-deploy health snapshot (HTTP status codes)

### Phase 3: Targeted Deploy
- **Frontend only**: `npm install` → `npm run build` → `pm2 restart nextjs`
- **Backend only**: `pip install -r requirements.txt` → `migrate` → `collectstatic` → `pm2 restart django`
- **Full**: Both of the above
- Uses `git stash` (NEVER `git clean -fd`) to handle conflicts safely

### Phase 4: Post-Deploy Verification
- Waits for services to boot
- Checks PM2 process status (no errored processes)
- HTTP health check: Frontend (expects 200), Backend (expects 200/401/403)
- Hits `/api/health/` endpoint

### Phase 5: Self-Healing
Detects and fixes up to 5 common error patterns with up to 3 retry attempts:

| Error Pattern | Detection | Fix |
|---|---|---|
| Missing venv | `No such file or directory.*venv` | `python3 -m venv venv && pip install -r requirements.txt` |
| Missing DB tables | `no such table` / `relation.*does not exist` | `python manage.py migrate --no-input` |
| Missing Python module | `ModuleNotFoundError` / `ImportError` | `pip install -r requirements.txt` |
| Port conflict | `Address already in use` | `fuser -k 8000/tcp` |
| Permission denied | `Permission denied` | `chmod -R 755` |
| Missing .next build | `Could not find.*\.next` | `npm run build` |
| Missing node_modules | `Cannot find module` | `npm install` |

## Usage Examples
```powershell
# Auto-detect and deploy (recommended)
.\scripts\deploy-agent.ps1

# Preview what would happen
.\scripts\deploy-agent.ps1 -DryRun

# Force deploy specific target
.\scripts\deploy-agent.ps1 -Force frontend
.\scripts\deploy-agent.ps1 -Force backend
.\scripts\deploy-agent.ps1 -Force full
```

## Variables User Interacts With
- `-Force`: Override auto-detection (`auto`, `frontend`, `backend`, `full`)
- `-DryRun`: Preview mode, no changes made
- `-MaxRetries`: Max self-healing attempts (default: 3)
- `-HealthCheckTimeout`: Seconds to wait for services to boot (default: 15)

## Data Flow
- **Reads from**: Git diff, server PM2 logs, HTTP health endpoints
- **Writes to**: Server filesystem (code pull, npm install, pip install)
- **Restarts**: PM2 services (nextjs, django)
