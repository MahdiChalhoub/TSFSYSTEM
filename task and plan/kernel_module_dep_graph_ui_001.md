# Kernel — Module Dependency Resolution UI (001)

## Context

WORKMAP 🟢 LOW item. Originally deferred backlog from `workflows/engine.md`.

Today, module dependencies are:
- Declared per app in `erp_backend/apps/{module}/manifest.json` under `dependencies: [<module_code>, ...]`.
- Resolved implicitly at install time (no visible graph; if a dep is missing, install fails with a text error).

Example real dependencies (as of this plan):
- `client_portal` → `core`, `workspace`
- `ecommerce` → `client_portal`, `inventory`
- `mcp` → `finance`, `inventory`
- `pos` → `inventory`
- `supplier_portal` → `core`, `workspace`
- `workspace` → `core`

A visual dep graph in the Kernel management UI lets admins see impact before disabling a module, and lets new users understand which modules pull in others.

## Goal

Kernel management page shows an interactive module dependency graph. Clicking a node highlights its direct + transitive dependencies and dependents.

## Options

### Option 1 — Backend endpoint + react-flow / cytoscape on the frontend (recommended)
- Add Django endpoint `GET /api/kernel/modules/dependency-graph/`:
    - Response: `{ nodes: [{ code, name, required, installed }], edges: [{ from: code, to: code }] }`.
    - Source of truth: iterate `apps/*/manifest.json`. Cross-reference with `OrganizationModule` to mark installed.
- Frontend: new page `src/app/(privileged)/(saas)/kernel/dependencies/page.tsx` using `react-flow` (already in `package.json`?) or `cytoscape`.
- Add sidebar entry in kernel nav.

### Option 2 — Static server-rendered graph
- Render graphviz via a Python helper, return SVG.
- Simpler but not interactive; clicking a node would require server round-trips.

### Option 3 — Defer
- Document the dep info better in module manifests page; skip the graph until there's clear demand.

**Recommended: Option 1.** Interactive, self-contained, no server rendering dependencies.

## Files to change

### Backend
- `erp_backend/kernel/modules/views.py` — add `dependency_graph` view (or view action).
- `erp_backend/kernel/modules/urls.py` — register route.
- `erp_backend/kernel/modules/services.py` — helper `build_dependency_graph(organization_id=None)` that reads manifests + optionally annotates install state.

### Frontend
- `src/app/(privileged)/(saas)/kernel/dependencies/page.tsx` — new page. Thin (<30 lines).
- `src/app/(privileged)/(saas)/kernel/dependencies/DependencyGraph.tsx` — renders the graph.
- `src/app/actions/kernel/modules.ts` — add `getModuleDependencyGraph(organizationId?)`.
- `src/components/admin/Sidebar.tsx` — add link under Kernel section (if that section exists; otherwise propose sidebar addition here).

### Dependencies
- Check `package.json` for `reactflow` or `@xyflow/react`. Install if absent.

## Data model (no DB changes)

Pure read. Manifests are already the source of truth. No migration.

## Validation (per `.agent/rules/`)

- `architecture.md` rule 3: module communication. New endpoint reads manifests — no cross-module import violation.
- `isolation.md` rule 1: per-org scoping. Endpoint accepts optional `organization_id` to annotate install state; default is unscoped (manifest-only view).
- `code-quality.md`: keep each file <300 lines. Graph component may need splitting into nodes + edges helpers.
- `security.md` rule 1: endpoint requires authentication; SaaS admin only (no multi-tenant leakage risk since manifests are global).

## Risk / rollback

Low. Additive feature, no mutation, no existing endpoints touched. Rollback by deleting new files.

## Tests

- Backend: `test_dependency_graph_view.py` — mock manifests, assert node/edge structure, assert install flags.
- Frontend: component test for `DependencyGraph` with a fixture graph (mock react-flow if it complicates testing).

## Out of scope

- Auto-suggest fixes on disable ("X requires Y, enable Y first"). That belongs in the install/disable flow, not the graph view.
- Version constraints on dependencies. Manifests currently don't express version ranges.

## Estimated effort

1–2 days.
