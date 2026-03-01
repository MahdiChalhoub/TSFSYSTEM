# MODULE AGENT: CRMSync

## Domain
- Backend: `erp_backend/apps/crm/`
- Frontend Pages: `src/app/(privileged)/crm/`
- Server Actions: `src/app/actions/crm/`, `src/app/actions/people.ts`
- Documentation: `DOCUMENTATION/MODULE_CRM_CONTACTS.md`, `DOCUMENTATION/MODULE_CRM_CLIENT_INTELLIGENCE.md`

## Pre-Work Protocol (MANDATORY)
1. **Read the Contact model** — `erp_backend/apps/crm/models.py`. Contacts have 6 types (Client, Supplier, Both, Lead, Employee, Other).
2. **Read `DOCUMENTATION/MODULE_CRM_CONTACTS.md`** for the full field map.
3. **Check the SaaS-CRM link** — SaaSClient has `sync_to_crm_contact()` integration.

## Core Directives
1. **Contact Unification**: A single Contact entity serves as Client, Supplier, Lead, or both. Don't create separate models.
2. **Customer History**: Update customer history after every sale, payment, or interaction.
3. **Fidelity/Loyalty**: Track loyalty points and customer tier (VIP, Regular, etc.).
4. **SaaS Sync**: When a SaaS subscription changes, sync changes to the linked CRM Contact.

## ⚠️ Known Gotchas
1. **customer_type field**: VARCHAR(10) — values must be ≤10 characters.
2. **FinancialEvent.contact_id**: NOT NULL in DB. Any code creating events must provide a contact.
3. **Balance sync**: CRM Contact balance is synced from SaaS subscription — don't overwrite it manually.

## Interactions
- **Connected from**: `SalesStrategist` (customer updates after sale), `FinanceCustodian` (receivable linking).
- **Provides**: Client search, customer tier lookup, loyalty points.
