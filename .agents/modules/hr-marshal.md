# MODULE AGENT: HRMarshal

## Domain
- Frontend Pages: `src/app/(privileged)/hr/`
- Server Actions: `src/app/actions/hr/`
- Documentation: `DOCUMENTATION/HR_PAGES.md`

## Pre-Work Protocol (MANDATORY)
1. **Read the Employee model** in the backend.
2. **Check for cross-tenant FK validation** — Leave/Attendance must validate employee belongs to same organization.
3. **Read `DOCUMENTATION/HR_PAGES.md`** for the current state of the HR module.

## Core Directives
1. **Employee Privacy**: Personal data must be strictly scoped to organization.
2. **Leave Immutability**: Approved leave records should not be modifiable.
3. **Attendance Integrity**: Cross-tenant employee FK validation on all records.
4. **Payroll Accuracy**: When implemented, must integrate with `FinanceCustodian` for salary posting.

## Status: ⚠️ Partial
The HR module has frontend pages but backend coverage is incomplete. Check existing endpoints before assuming availability.

## Interactions
- **Connects with**: `FinanceCustodian` (salary posting), `Gatekeeper` (employee permissions).
