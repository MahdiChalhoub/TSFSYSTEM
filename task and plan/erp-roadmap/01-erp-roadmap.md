# TSFSYSTEM ERP — Master Development Roadmap

> **Goal**: Complete end-to-end ERP: Setup → Products → Buy → Sell → Financials → Reports
> **Created**: 2026-04-13
> **Status**: Active

---

## Existing Kernel Infrastructure (Already Built)

- ✅ Multi-tenancy (`TenantModel`, `TenantManager`)
- ✅ RBAC Schema (`Role` tenant-scoped + `Permission` global + `User.role` FK)
- ✅ Document Lifecycle Schema (`VerifiableModel`: OPEN→LOCKED→VERIFIED→CONFIRMED)
- ✅ Verification Config (`TransactionVerificationConfig` per-type, amount thresholds)
- ✅ Audit Trail (`TransactionStatusLog` immutable who/what/when/why)
- ✅ Manager Override (`ManagerOverrideLog` + override PINs)
- ✅ Notifications (`Notification` model)
- ✅ Finance Core Models (34 model files: COA, Tax Engine, Posting Rules, Ledger)
- ✅ CounterpartyTaxProfile (CRM ↔ Tax link)

---

## Phase Dependency Chain

```
Phase 0: Finish Finance Core
    ↓
Phase 1: Cross-Cutting Engines (Lifecycle + RBAC + Auto Tasks)
    ↓
Phase 2: Master Data (Products + CRM-Accounting Bridge)
    ↓
Phase 3: Purchase Cycle (PO → Receipt → Invoice → Pay)
    ↓
Phase 4: Sales Cycle (Sale → Invoice → Deliver → Collect)
    ↓
Phase 5: Reconciliation & Reports
```

---

## Design Decisions

1. **RBAC**: Dynamic and customizable — seeded as templates (Admin, Manager, Accountant, Cashier, Viewer) but orgs can clone and customize
2. **Document Lifecycle**: DRAFT → SAVED → LOCKED → VERIFIED (multi-level) → CONFIRMED — with configurable levels per transaction type
3. **Auto Task Engine**: Signal-driven task assignment with configurable rules per org, linked to notifications
4. **CRM ↔ Accounting**: Contacts auto-linked to AR/AP sub-accounts + CounterpartyTaxProfile
5. **User ↔ Accounting**: Users linked via role permissions and audit trail (`performed_by`)
