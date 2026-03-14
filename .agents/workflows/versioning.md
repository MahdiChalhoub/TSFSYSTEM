---
description: How to bump and deploy a new version of the TSFSYSTEM
---

# Versioning & Hotfix Deployment Rule

To maintain consistency and traceability of all AI-driven changes, the following rule MUST be followed for every deployment:

## 1. Version Naming Convention
Every version must follow the format:
`[Base Version]-AG-[Date].[Time]`

- **Base Version**: e.g., `3.5.0`
- **AG Identifier**: Indicates the change was made by an Antigravity Agent.
- **Timestamp**: `YYMMDD.HHMM` (e.g., `260223.1530` for Feb 23, 2026 at 3:30 PM).

## 2. Automated Upgrading
The `deploy_safe.sh` script is the source of truth for versioning.
- It automatically generates the version string using the current system time.
- It automatically injects this version into `src/lib/branding.ts`.
- ⚠️ `deploy_hotfix.sh` is **DEPRECATED** — use `deploy_safe.sh` instead.

## 3. Multi-Agent Deploy Safety (CRITICAL)
`deploy_safe.sh` prevents server crashes from concurrent deployments:
- **Atomic Lock**: Only ONE deploy runs at a time (mkdir-based, race-proof).
- **Queue System**: If another deploy is running, your files ARE synced and queued.
- **Auto-Batching**: After a deploy finishes, the queue is drained with ONE cycle.
- **Memory Protection**: Celery/MCP are stopped before frontend build to prevent OOM.
- **Rsync --update**: Newer files always win (prevents overwrites between agents).
- **Cooldown**: 3-minute cooldown between deploys.

### Agent experience when queued:
```
✅ Files synced to server.
⏳ Deploy in progress by Agent X (started 2m ago).
📋 Your changes are queued (position #1).
🔄 They will be included in the next deploy cycle automatically.
```

## 4. GitHub Backup (CRITICAL)
Every deployment MUST create a GitHub backup:
- **Step 0**: Before ANY changes, the script commits and pushes the CURRENT server state to GitHub as a safety snapshot.
- **Post-deploy**: After changes are applied, the script commits and pushes the DEPLOYED state to GitHub.
- **If GitHub push fails**: The deploy is PAUSED and asks for confirmation before continuing. This ensures the user knows their backup isn't safe.

### Restoring from a backup:
```bash
# On the server:
git log --oneline -20                              # Find the version to restore
git checkout <commit_hash> -- src/ erp_backend/    # Restore those folders
docker-compose build --no-cache frontend && docker-compose up -d frontend && docker restart tsf_gateway
```

## 5. UI Requirement
The version MUST always be visible in the Admin Sidebar near the "Sign Out" button to facilitate debugging and cross-team communication.

## 6. Deployment Log
Every successful deployment MUST be logged in `AGENT_RELEASE.md` with a brief summary of what changed.

## 7. Deploy History
All deployments (successful, failed, queued) are logged in `/root/.deploy/history.log` on the server:
```bash
# View deploy history on server:
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "cat /root/.deploy/history.log"
```

// turbo
### Deployment Command
Run the safe deploy script to apply changes and bump the version:
```bash
./deploy_safe.sh
```

⚠️ **NEVER** use `./deploy_hotfix.sh` — it is deprecated and does NOT protect against concurrent deploys.
