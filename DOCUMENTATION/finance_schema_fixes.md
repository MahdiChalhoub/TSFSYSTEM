# Finance Module Schema Fixes

## Goal
Align Django models with actual PostgreSQL database schema in the finance module. Missing fields caused NOT NULL constraint violations when creating records.

## Problem
20 database columns existed in PostgreSQL but were missing from Django model definitions. Any INSERT through Django ORM would fail on NOT NULL columns.

## Tables Affected

### JournalEntry — 5 fields added
| Field | Type | Purpose |
|---|---|---|
| `fiscal_period` | FK → FiscalPeriod | Links entry to accounting period |
| `is_locked` | boolean (default False) | Prevents editing after approval |
| `is_verified` | boolean (default False) | Audit trail flag |
| `posted_at` | timestamp (nullable) | When entry was posted |
| `updated_at` | timestamp (auto_now) | Last modification time |

### JournalEntryLine — 2 fields added
| Field | Type | Purpose |
|---|---|---|
| `contact` | FK → Contact (nullable) | Links line to CRM contact |
| `employee` | FK → User (nullable) | Links line to employee |

### Transaction — 3 fields added
| Field | Type | Purpose |
|---|---|---|
| `scope` | varchar (default 'OFFICIAL') | Official vs draft scope |
| `reference_id` | varchar (nullable) | External reference ID |
| `site` | FK → Site (nullable) | Multi-site support |

### TransactionSequence — 2 fields added
| Field | Type | Purpose |
|---|---|---|
| `padding` | integer (default 6) | Zero-padding for sequence numbers |
| `suffix` | varchar (nullable) | Suffix for generated numbers |

### LoanInstallment — 3 fields added
| Field | Type | Purpose |
|---|---|---|
| `paid_amount` | decimal (default 0) | Amount paid so far |
| `status` | varchar (default 'PENDING') | Installment status |
| `paid_at` | timestamp (nullable) | When payment was received |

### FinancialEvent — 5 fields added/fixed
| Field | Type | Purpose |
|---|---|---|
| `currency` | varchar (default 'USD') | Event currency |
| `transaction` | FK → Transaction (nullable) | Links to cash movement |
| `created_at` | timestamp (auto_now_add) | Creation time |
| `updated_at` | timestamp (auto_now) | Last modification |
| `contact` | FK → Contact (**NOT NULL**) | Fixed: was nullable in Django but NOT NULL in DB |

## Data Flow
- **READ**: All finance pages read from these tables via DRF ViewSets
- **WRITE**: Ledger page, Events page, Loans page write journal entries, transactions, events

## Note: BarcodeSettings
`BarcodeSettings` model has 2 missing columns (`is_enabled`, `length`) but belongs to the **inventory module**, not finance. These will be fixed separately.

## Files Modified
- `erp_backend/apps/finance/models.py` — all 20 fields added
