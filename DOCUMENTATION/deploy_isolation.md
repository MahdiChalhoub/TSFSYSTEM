# Deploy Isolation Documentation

## Problem (2026-02-15)
A frontend-only deploy crashed the backend because:
1. `git pull` conflicted with untracked server files
2. `git clean -fd` was used to resolve the conflict
3. `git clean -fd` deleted the `venv/` directory (not in `.gitignore`)
4. Without venv, `start_django.sh` failed → Django crashed

## Root Cause
`venv/` was not listed in `.gitignore`, making it vulnerable to `git clean`.

## Fix
- Added `venv/`, `*/venv/`, `.venv/` to `.gitignore`

## Isolation Strategy: 3 Deploy Workflows

| Workflow | Command | What it restarts | When to use |
|---|---|---|---|
| `/deploy` | Full deploy | Both nextjs + django | Changes in both `src/` and `erp_backend/` |
| `/deploy-frontend` | Frontend only | Only nextjs | Changes only in `src/` (pages, components, styles) |
| `/deploy-backend` | Backend only | Only django | Changes only in `erp_backend/` (models, views, APIs) |

## Safety Rules
- **NEVER** run `git clean -fd` on the server
- Use `git stash` instead for untracked file conflicts
- Always restart only the service that changed (`pm2 restart nextjs` or `pm2 restart django`)
- The `venv/` directory is protected via `.gitignore`

## Workflow Locations
- `/.agent/workflows/deploy.md` — Full deploy
- `/.agent/workflows/deploy-frontend.md` — Frontend only
- `/.agent/workflows/deploy-backend.md` — Backend only
