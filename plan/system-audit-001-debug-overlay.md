# Plan: System Audit & Integration Debugging (system-audit-001)

## Overview
This plan focuses on implementing a diagnostic and review system to ensure cross-module logic consistency (e.g., Finance settings being correctly applied in Purchase/Inventory).

## Goals
1. Provide a developer-only "Context Panel" (Debug Overlay) on every page.
2. Explain the current page logic (active settings, view scope, data sources).
3. Allow for integration verification (e.g., "Is this Purchase order using the global Finance tax setting?").

## Tasks
1. **[system-audit-001-setup-panel]**: Create a floating `DebugOverlay` component.
2. **[system-audit-001-global-state]**: Fetch and display global `FinancialSettings` in the panel.
3. **[system-audit-001-ledger-visibility]**: Add a "Recent Ledger" tab to show how transactions are hitting the books.
4. **[system-audit-001-page-context]**: Implement page-specific logic explanations.
5. **[system-audit-001-integrate]**: Inject the panel into the root layout (development mode only).
