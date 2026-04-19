# Agent Bootstrap — paste-by-reference

**For the user**: at the start of any AI-agent session, paste this single line:

> Read and follow `.agent/BOOTSTRAP.md` before anything else.

---

## For the agent: what to do

### 1. Read these files in order

1. `.agent/rules/architecture.md`
2. `.agent/rules/kernel-os-v2.md`
3. `.agent/rules/isolation.md`
4. `.agent/rules/security.md`
5. `.agent/rules/code-quality.md`
6. `.agent/rules/data-integrity.md`
7. `.agent/rules/cleanup.md`
8. `.agent/rules/module-mode.md`
9. `.agent/rules/plan.md`
10. `.agent/WORK_IN_PROGRESS.md` — what the last session did
11. `.agent/WORKMAP.md` — what's open

### 2. Workflow — every task, no exceptions

1. **UNDERSTAND** — ask clarifying questions before touching code. No assumptions.
2. **RESEARCH** — read relevant source; cite `file:line` for claims.
3. **PROPOSE** — offer 2–3 options with tradeoffs. Wait for the user to pick.
4. **PLAN** — write a detailed plan (Goal / Files / Migrations / Tests / Risk / Out of scope). Save multi-step plans to `task and plan/{module}_{name}_{NNN}.md`.
5. **IMPLEMENT** — only after plan approval.
6. **VALIDATE** — check against the rules; run relevant tests.
7. **REVIEW** — append a session entry to `.agent/WORK_IN_PROGRESS.md` (files changed, discoveries, warnings for next agent); mark `.agent/WORKMAP.md` items DONE with date.

### 3. Hard rules (non-negotiable)

- Files **≤ 300 lines**. Refactor existing violations before adding to them.
- **No hardcoded configurable values** — use `kernel.config.get_config`.
- **Tenant-scoped models**: `AuditLogMixin, TenantOwnedModel` (that order).
- **Mutating endpoints**: `@require_permission`. Reads too unless public by design.
- **No direct cross-module imports** — use `emit_event` / Django signals / ConnectorEngine.
- **Archive, don't delete** — move deprecated files to `/ARCHIVE` preserving structure.
- **Commit subjects**: `[type] MODULE: description` (present-tense imperative). Examples: `[fix] FINANCE: reverse journal entry locks fiscal year`, `[refactor] SAAS: split OrgDialogs`.
- **Never** `--force` push. **Never** `--no-verify`. **Never** skip failing tests to make CI green.
- **Ask before destructive or shared-state-changing actions** (deletes, schema drops, shared-infra edits, external messages, force-anything).
- **Only confirm having read files you actually `Read`.** Don't fake acknowledgements.

### 4. Conflict resolution

If a hard rule conflicts with the user's explicit instruction in the same session, **the user's instruction wins** — but flag the conflict once so it's on the record.

### 5. First reply

Start by telling the user:
- What the last session left open (from `WORK_IN_PROGRESS.md`).
- Which `WORKMAP.md` item you recommend tackling first and why.
- Any blockers you notice immediately (missing files, stale references, env prerequisites).

Do not start implementing until the user picks a task.

---

## Maintenance

Update this file when:
- A new rules file is added under `.agent/rules/` — add it to the reading list.
- A workflow step is added, removed, or changed.
- A hard rule changes.

Do **not** put transient task state here. Session logs go in `WORK_IN_PROGRESS.md`; the backlog goes in `WORKMAP.md`.
