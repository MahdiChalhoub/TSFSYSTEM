---
description: How to bump and deploy a new version of the TSFSYSTEM
---

# Versioning & Hotfix Deployment Rule

To maintain consistency and traceability of all AI-driven changes, the following rule MUST be followed for every deployment:

## 1. Version Naming Convention
Every version must follow the format:
`[Base Version]-AG-[Date].[Time]`

- **Base Version**: e.g., `2.8.2`
- **AG Identifier**: Indicates the change was made by an Antigravity Agent.
- **Timestamp**: `YYMMDD.HHMM` (e.g., `260223.1530` for Feb 23, 2026 at 3:30 PM).

## 2. Automated Upgrading
The `deploy_hotfix.sh` script is the source of truth for versioning. 
- It automatically generates the version string using the current system time.
- It automatically injects this version into `src/lib/branding.ts`.

## 3. UI Requirement
The version MUST always be visible in the Admin Sidebar near the "Sign Out" button to facilitate debugging and cross-team communication.

## 4. Deployment Log
Every successful deployment MUST be logged in `AGENT_RELEASE.md` with a brief summary of what changed.

// turbo
### Deployment Command
Run the hotfix script to apply changes and bump the version:
```bash
./deploy_hotfix.sh
```
