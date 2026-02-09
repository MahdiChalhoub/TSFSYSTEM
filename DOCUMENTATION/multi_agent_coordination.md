# Multi-Agent Coordination System

## Goal
Prevent conflicts when two or more AI agents work on the same codebase simultaneously.

## Components

### 1. `/agent-sync` Workflow (`.agent/workflows/agent-sync.md`)
- Step-by-step protocol every agent must follow
- Git pull/push at session start, during work, and at session end
- File locking before editing

### 2. Active Locks File (`.agent/ACTIVE_LOCKS.md`)
- Real-time file ownership registry
- Agents claim files before editing, release when done
- Push lock changes immediately so other agents see them

### 3. Agent Sync Rule (`.agent/rules/agent-sync.md`)
- Enforces the protocol — agents read this rule automatically
- Short summary of the 4-step process

### 4. Work-In-Progress Log (`.agent/WORK_IN_PROGRESS.md`)
- Session handoff log — what each agent did, what they discovered
- Warnings for the next agent

## How It Works

```
Agent A starts                    Agent B starts
    │                                  │
    ▼                                  ▼
git pull                           git pull
    │                                  │
    ▼                                  ▼
Read ACTIVE_LOCKS.md              Read ACTIVE_LOCKS.md
    │                                  │
    ▼                                  ▼
Lock: models.py, views.py        Lock: page.tsx, actions.ts
    │                                  │
    ▼                                  ▼
Push lock → GitHub                Push lock → GitHub
    │                                  │
    ▼                                  ▼
Edit models.py                    Edit page.tsx
    │                                  │
    ▼                                  ▼
Commit + push                     Commit + push
    │                                  │
    ▼                                  ▼
Release locks                     Release locks
```

## Data Flow
- **READ**: Agents read `ACTIVE_LOCKS.md` before any edit
- **WRITE**: Agents write to `ACTIVE_LOCKS.md` to claim/release files
- **SYNC**: Git serves as the single source of truth

## Files Created
- `.agent/workflows/agent-sync.md` — Full workflow
- `.agent/ACTIVE_LOCKS.md` — Lock registry
- `.agent/rules/agent-sync.md` — Enforcement rule
