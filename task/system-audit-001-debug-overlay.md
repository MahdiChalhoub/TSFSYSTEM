# Task: system-audit-001-debug-overlay

## Objective
Implement a diagnostic overlay to explain page logic and verify cross-module integration.

## Requirements
- Floating UI element (toggleable).
- Show current `viewScope` (Official vs Internal).
- Show Global Financial Settings (Basis: TTC/HT, VAT Recoverable, etc.).
- Allow "Review Mode" where logic hints are shown.

## Steps
1. Create `src/components/dev/DebugOverlay.tsx`.
2. Update `src/context/AdminContext.tsx` or create a new `DevContext` if needed (better to keep it in a separate Dev component to avoid bloating production context).
3. Fetch `FinancialSettings` via an action or API.
4. Add the component to `src/app/admin/layout.tsx`.
