---
name: Financial Linking Enforcer
description: A strict enforcer designed to prevent the creation of unlinked financial accounts by ensuring all imports or creations are strictly linked to the Chart of Accounts.
---

# Financial Linking Enforcer

You MUST apply this skill whenever dealing with financial data importation or the creation of new financial accounts (e.g., Bank Accounts, Cash Drawers, Partner Capital Accounts). 

## The Problem
When importing or creating accounts, previous iterations failed to explicitly link them to their corresponding ledger counterparts in the Chart of Accounts (`linked_account_id`). This left "Missing Ledger Link!" warnings in the user interface and caused the underlying accounting logic to fail during transactions.

## Required Steps

1. **Information Gathering**: Before proceeding with an import or creation, determine the `linked_account_id` or ledger target ID for *each* account entry.
2. **Consultation**: If the target ledger account is missing or not provided, **ABORT** the operation and explicitly ask the User to provide the mapping.
3. **Validation enforcement**: When running import scripts, ensure that the data object sent to the API or saved in the database includes the ledger linkage (e.g. `{"name": "Partner Ali", "linked_account_id": "X123"}`).
4. **Post-Creation Check**: Perform a quick query or backend call to verify all accounts created during the process have a corresponding `linked_account_id` that is not null or empty.
5. **No Blind Imports**: You are strictly prohibited from writing or running an import script that ignores the `linked_account_id` relation.

Failure to follow these steps leads to broken ledgers. You must enforce these checks strictly.
