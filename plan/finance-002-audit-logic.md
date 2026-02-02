# Plan: Finance Audit Logic & SaaS Integration (finance-002)

## Goal
Implement a robust audit logging system and a multi-stage transaction verification workflow (Draft -> Verified -> Locked -> Post) that supports multi-tenancy (SaaS).

## Workflow Description
1. **DRAFT**: Default state. Entry is active and reflected in real-time balances but can be edited or deleted.
2. **VERIFIED**: Entry has been reviewed for accuracy. Tracking `verifiedById`.
3. **LOCKED**: Entry is frozen. No further edits or deletions allowed. Ensures data integrity for audit.
4. **POSTED**: Entry is formalized in the ledger.

> [!IMPORTANT]
> All states (Draft, Verified, Locked, Post) contribute to live balances to ensure "Real Version" visibility as requested.

## Technical Tasks
- [ ] Update `AuditLogger` to handle mandatory `organizationId`.
- [ ] Implement `lockTransaction` and `postTransaction` logic in `ledger.ts`.
- [ ] Enforce immutability in `updateJournalEntry` and `deleteJournalEntry` based on `status = LOCKED` or `status = POSTED`.
- [ ] Standardize server actions to pass `organizationId` from session/context.
- [ ] Create Audit Log viewer frontend (placeholder for now, focus on logic).

## Verification
- Create a transaction -> Verify -> Lock -> Attempt to Edit (Should Fail).
- Check `AuditLog` table for correct action records and field changes.
