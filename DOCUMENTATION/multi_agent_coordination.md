# Multi-Agent Coordination System

## Goal
Prevent conflicts when two or more AI agents work on the same codebase simultaneously.

## Components

### 1. Task Assignments (`.agent/TASK_ASSIGNMENTS.md`)
- Module ownership map — defines which agent works on which module
- Template prompt for starting multi-agent sessions
- Shared files danger zone list

### 2. Active Locks (`.agent/ACTIVE_LOCKS.md`)
- Real-time file ownership registry
- Agents claim files before editing, release when done
- Push lock changes immediately so other agents see them

### 3. Agent Sync Workflow (`.agent/workflows/agent-sync.md`)
- 5-step protocol: pull → read coordination files → claim locks → work → release
- turbo annotations for auto-running git commands
- Stop conditions when conflicts detected

### 4. Agent Sync Rule (`.agent/rules/agent-sync.md`)
- 7 mandatory rules every agent follows automatically
- Includes "never override" policy — check commit messages before reverting

### 5. Work-In-Progress Log (`.agent/WORK_IN_PROGRESS.md`)
- Session handoff log — discoveries, warnings, files modified

## How to Start Two Agents Safely

Tell each agent at session start:
```
Agent 1: "You are Agent 1. Run /agent-sync first. Your assigned modules are: [Finance, Inventory]. Do NOT edit files outside your modules."

Agent 2: "You are Agent 2. Run /agent-sync first. Your assigned modules are: [Frontend SaaS, CRM]. Do NOT edit files outside your modules."
```

## Shared Files (Danger Zone)
- `erp_backend/erp/models.py`
- `erp_backend/erp/views.py`
- `erp_backend/erp/services.py`
- `erp_backend/erp/urls.py`
- `erp_backend/erp_system/settings.py`

Only ONE agent may edit these at a time. Lock first, push lock, then edit.

## Files
- `.agent/TASK_ASSIGNMENTS.md`
- `.agent/ACTIVE_LOCKS.md`
- `.agent/workflows/agent-sync.md`
- `.agent/rules/agent-sync.md`
- `.agent/WORK_IN_PROGRESS.md`
