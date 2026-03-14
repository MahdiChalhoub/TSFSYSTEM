# 🚀 Deploy Coordinator + Queue — Implementation Plan

**Task**: Prevent 5+ agents from deploying simultaneously and crashing the server
**Approach**: Option B — Centralized Deploy Coordinator with Queue + Batching
**Date**: 2026-03-10
**Status**: ✅ IMPLEMENTED

---

## 📋 Problem Summary

- 5 agents deploy at the same time
- Server runs out of RAM (OOM exit 137) during concurrent `docker-compose build`
- Container name conflicts, migration conflicts
- rsync overwrites between agents (Agent B overwrites Agent A's newer files)
- Current lock mechanism is weak (PID-based, 15-min timeout too short)

---

## 🏗️ Architecture

### Components

```
┌──────────────────────────────────────────────────────────────────┐
│                        AGENT MACHINES                            │
│                                                                  │
│  Agent 1          Agent 2          Agent 3         Agent 4/5     │
│  deploy_safe.sh   deploy_safe.sh   deploy_safe.sh  deploy_safe  │
│       │                │                │              │         │
│       └───── rsync ────┴──── rsync ─────┴── rsync ─────┘         │
│                        │                                         │
└────────────────────────┼─────────────────────────────────────────┘
                         │ SSH
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                    PRODUCTION SERVER                              │
│                                                                  │
│  /root/.deploy/                                                  │
│  ├── lock/           ← mkdir-based atomic lock                   │
│  ├── queue.txt       ← queued deploy requests (FIFO)             │
│  ├── cooldown.ts     ← timestamp of last deploy end              │
│  ├── current.info    ← who is currently deploying                │
│  └── history.log     ← deployment history                        │
│                                                                  │
│  /root/TSFSYSTEM/                                                │
│  └── deploy_server.sh  ← server-side build/deploy worker         │
│                                                                  │
│  Docker: backend, frontend, celery, gateway, db                  │
└──────────────────────────────────────────────────────────────────┘
```

### Flow

```
Agent calls deploy_safe.sh
        │
        ▼
  ┌─ Step 1: Sync files to server (rsync --update, newer wins)
  │
  ├─ Step 2: SSH into server, try to acquire lock (mkdir /root/.deploy/lock)
  │     │
  │     ├─ SUCCESS (lock acquired)
  │     │     │
  │     │     ├─ Step 3: Check cooldown (was last deploy < 3 min ago?)
  │     │     │     ├─ YES: Wait remaining cooldown, then continue
  │     │     │     └─ NO: Continue immediately
  │     │     │
  │     │     ├─ Step 4: Run full deploy pipeline (migrations, build, restart)
  │     │     │
  │     │     ├─ Step 5: Deploy complete. Check queue.
  │     │     │     ├─ Queue has entries → Run ONE more deploy cycle
  │     │     │     │   (files already synced by other agents)
  │     │     │     └─ Queue empty → Done
  │     │     │
  │     │     └─ Step 6: Release lock. Write cooldown timestamp.
  │     │
  │     └─ FAIL (lock exists = another deploy in progress)
  │           │
  │           ├─ Check lock age (> 30 min = stale, force-clean)
  │           │
  │           ├─ Read current.info (who is deploying, how long)
  │           │
  │           ├─ Add self to queue.txt  ← "QUEUED: files synced, waiting"
  │           │
  │           └─ Exit with message:
  │               "✅ Files synced to server."
  │               "⏳ Deploy queued (position #2). Agent X is deploying (3m12s)."
  │               "🔄 Your changes will be included in the next deploy cycle."
  │
  └─ Done
```

---

## 📁 Files to Create/Modify

### NEW FILES

| File | Location | Purpose |
|------|----------|---------|
| `deploy_safe.sh` | `/root/.gemini/antigravity/scratch/TSFSYSTEM/deploy_safe.sh` | New entry point for agents (replaces `deploy_hotfix.sh`) |
| `deploy_server.sh` | `/root/.gemini/antigravity/scratch/TSFSYSTEM/scripts/deploy/deploy_server.sh` | Server-side build worker (the actual build/restart logic) |

### MODIFIED FILES

| File | Change |
|------|--------|
| `deploy_hotfix.sh` | Add deprecation warning pointing to `deploy_safe.sh` |

### SERVER-SIDE (created automatically on first run)

| Path | Purpose |
|------|---------|
| `/root/.deploy/lock/` | Atomic directory lock (mkdir = atomic) |
| `/root/.deploy/queue.txt` | FIFO queue of waiting agents |
| `/root/.deploy/cooldown.ts` | Epoch timestamp of last deploy completion |
| `/root/.deploy/current.info` | Info about current deployer (agent ID, start time, PID) |
| `/root/.deploy/history.log` | Append-only log of all deploys |

---

## 🔧 Implementation Details

### 1. `deploy_safe.sh` (Agent Entry Point)

**Responsibilities**:
- Generate unique agent ID: `agent-<PID>-<HOSTNAME>-<TIMESTAMP>`
- Rsync files to server with `--update` flag (newer file wins — solves overwrite problem)
- Stamp version in branding.ts
- SSH to server: attempt lock acquisition
  - If acquired → call `deploy_server.sh` remotely
  - If blocked → add to queue, show status, exit cleanly
- Clean up local lock on exit/interrupt

**Key Rsync Fix** (solves overwrite problem):
```bash
# BEFORE (current - Agent B overwrites Agent A's newer files):
rsync -avz ...

# AFTER (newer file always wins):
rsync -avz --update ...
```

Both the PULL (Step 1) and PUSH (Step 3) use `--update` flag.

### 2. `deploy_server.sh` (Server-Side Worker)

**Responsibilities**:
- Run the actual deploy pipeline:
  1. Git backup (pre-deploy snapshot)
  2. Database migrations (with error tolerance)
  3. Stop memory-hungry services (celery, mcp_agent_pulse)
  4. Frontend build (--no-cache)
  5. Bring all services up
  6. Restart gateway
  7. Cleanup old images
- After completing: check queue.txt
  - If queue has entries → clear queue, run ONE more cycle
  - If empty → release lock, write cooldown timestamp
- Write to history.log

### 3. Lock Mechanism (Atomic mkdir)

```bash
# Acquire lock (atomic — mkdir is atomic on Linux)
if mkdir /root/.deploy/lock 2>/dev/null; then
    echo "Lock acquired"
    echo "agent-$$-$(hostname)-$(date +%s)" > /root/.deploy/current.info
else
    # Lock already held — check for staleness
    LOCK_AGE=$(( $(date +%s) - $(stat -c %Y /root/.deploy/lock) ))
    if [ $LOCK_AGE -gt 1800 ]; then  # 30 min = stale
        echo "Stale lock (${LOCK_AGE}s). Force-cleaning..."
        rm -rf /root/.deploy/lock
        mkdir /root/.deploy/lock  # Re-acquire
    else
        echo "Deploy in progress. Queuing..."
        echo "agent-$$-$(hostname)-$(date +%s)" >> /root/.deploy/queue.txt
    fi
fi
```

### 4. Queue-Drain Logic

```bash
# After deploy completes:
if [ -s /root/.deploy/queue.txt ]; then
    QUEUE_COUNT=$(wc -l < /root/.deploy/queue.txt)
    echo "📋 Queue has $QUEUE_COUNT waiting agent(s). Running batched deploy..."
    > /root/.deploy/queue.txt  # Clear queue
    # Run ONE more deploy cycle (files already synced by queued agents)
    run_deploy_pipeline
fi
```

### 5. Cooldown Logic

```bash
# Check cooldown before deploying
if [ -f /root/.deploy/cooldown.ts ]; then
    LAST_DEPLOY=$(cat /root/.deploy/cooldown.ts)
    ELAPSED=$(( $(date +%s) - LAST_DEPLOY ))
    COOLDOWN=180  # 3 minutes
    if [ $ELAPSED -lt $COOLDOWN ]; then
        WAIT=$(( COOLDOWN - ELAPSED ))
        echo "⏳ Cooldown active. Waiting ${WAIT}s before deploying..."
        sleep $WAIT
    fi
fi
```

### 6. Memory Protection (Service Suspension)

Before frontend build, automatically stop memory-hungry services:
```bash
echo "💾 Freeing memory for build..."
docker-compose stop celery_worker celery_beat mcp_agent_pulse 2>/dev/null || true

# Build frontend
docker-compose build --no-cache frontend

# Bring everything back up
docker-compose up -d
```

---

## 🛡️ Safety Features

| Feature | Description |
|---------|-------------|
| **Atomic lock** | `mkdir` is atomic on Linux — can't race |
| **Stale lock cleanup** | Auto-clean locks older than 30 minutes |
| **Cooldown** | 3-min cooldown between deploys (configurable) |
| **Queue drain** | After deploy, check queue and batch remaining |
| **Rsync --update** | Newer file always wins (no overwrites) |
| **Memory protection** | Auto-stop celery/mcp before build |
| **History log** | Append-only log of all deploys with timestamps |
| **Graceful exit** | trap EXIT/INT/TERM to clean up locks |
| **Git backup** | Pre-deploy GitHub snapshot (existing) |

---

## 🧪 Test Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Agent 1 deploys alone | Normal deploy, no queue |
| Agent 1 + 2 deploy simultaneously | Agent 1 gets lock, Agent 2 gets "queued" message. After Agent 1 finishes, queue-drain runs one more cycle. |
| Agent 1 + 2 + 3 + 4 + 5 deploy simultaneously | Agent 1 gets lock. Agents 2-5 get "queued". After Agent 1 finishes, ONE batched deploy runs for all queued changes. |
| Agent deploys during cooldown | Waits remaining cooldown time, then deploys |
| Lock is stale (>30 min) | Auto-cleaned, new agent proceeds |
| Deploy crashes mid-build | trap cleans up lock. Next agent finds no lock (or stale) and proceeds |
| Agent syncs files but can't deploy | Files are on server (rsync --update). Next deploy cycle includes them. |

---

## 📋 Architecture Compliance

```
☑ No hardcoded values — cooldown/timeout are configurable variables in the script
☑ No cross-module violations — this is infrastructure only (shell scripts)
☑ No model changes — no database modifications
☑ No kernel changes — kernel is locked
☑ Backward compatible — old deploy_hotfix.sh still works (with deprecation warning)
```

---

## ⏱️ Estimated Effort

| Task | Time |
|------|------|
| Create `deploy_safe.sh` | 45 min |
| Create `deploy_server.sh` | 45 min |
| Add deprecation to `deploy_hotfix.sh` | 5 min |
| Testing & verification | 15 min |
| **Total** | **~2 hours** |

---

## 🚀 Deployment

After implementation:
1. All agents switch from `deploy_hotfix.sh` → `deploy_safe.sh`
2. First run auto-creates `/root/.deploy/` directory on server
3. No server-side manual setup needed

---

**STATUS: AWAITING APPROVAL**

Please review and confirm to proceed with implementation.
